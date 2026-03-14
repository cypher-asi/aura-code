use std::path::Path;

use serde::{Deserialize, Serialize};
use tracing::{info, error};

use crate::error::EngineError;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum FileOp {
    Create { path: String, content: String },
    Modify { path: String, content: String },
    Delete { path: String },
}

pub fn validate_path(base: &Path, target: &Path) -> Result<(), EngineError> {
    let norm_base = lexical_normalize(base);
    let norm_target = lexical_normalize(target);

    if !norm_target.starts_with(&norm_base) {
        return Err(EngineError::PathEscape(target.display().to_string()));
    }
    Ok(())
}

/// Resolve `.` and `..` components without hitting the filesystem, avoiding
/// Windows `\\?\` extended-path issues that `canonicalize()` introduces.
fn lexical_normalize(path: &Path) -> std::path::PathBuf {
    use std::path::Component;
    let mut out = std::path::PathBuf::new();
    for comp in path.components() {
        match comp {
            Component::ParentDir => { out.pop(); }
            Component::CurDir => {}
            other => out.push(other),
        }
    }
    out
}

pub async fn apply_file_ops(base_path: &Path, ops: &[FileOp]) -> Result<(), EngineError> {
    info!(base = %base_path.display(), count = ops.len(), "applying file operations");

    for op in ops {
        match op {
            FileOp::Create { path, content } | FileOp::Modify { path, content } => {
                let full_path = base_path.join(path);
                if let Err(e) = validate_path(base_path, &full_path) {
                    error!(path = %path, error = %e, "path validation failed");
                    return Err(e);
                }
                if let Some(parent) = full_path.parent() {
                    tokio::fs::create_dir_all(parent)
                        .await
                        .map_err(|e| EngineError::Io(e.to_string()))?;
                }
                tokio::fs::write(&full_path, content)
                    .await
                    .map_err(|e| {
                        error!(path = %path, error = %e, "failed to write file");
                        EngineError::Io(e.to_string())
                    })?;
                info!(path = %path, bytes = content.len(), "wrote file");
            }
            FileOp::Delete { path } => {
                let full_path = base_path.join(path);
                if let Err(e) = validate_path(base_path, &full_path) {
                    error!(path = %path, error = %e, "path validation failed");
                    return Err(e);
                }
                if full_path.exists() {
                    tokio::fs::remove_file(&full_path)
                        .await
                        .map_err(|e| {
                            error!(path = %path, error = %e, "failed to delete file");
                            EngineError::Io(e.to_string())
                        })?;
                    info!(path = %path, "deleted file");
                }
            }
        }
    }

    info!(count = ops.len(), "all file operations applied successfully");
    Ok(())
}

const SKIP_DIRS: &[&str] = &[
    ".git",
    "target",
    "node_modules",
    "__pycache__",
    ".venv",
    "dist",
];

const INCLUDE_EXTENSIONS: &[&str] = &[
    "rs", "ts", "tsx", "js", "jsx", "json", "toml", "md", "css", "html", "yaml", "yml", "py", "sh",
    "sql", "graphql",
];

pub fn read_relevant_files(linked_folder: &str, max_bytes: usize) -> Result<String, EngineError> {
    let base = Path::new(linked_folder);
    let mut output = String::new();
    let mut current_size: usize = 0;
    walk_and_collect(base, base, &mut output, &mut current_size, max_bytes)?;
    Ok(output)
}

fn walk_and_collect(
    base: &Path,
    dir: &Path,
    output: &mut String,
    current_size: &mut usize,
    max_bytes: usize,
) -> Result<(), EngineError> {
    let entries = std::fs::read_dir(dir).map_err(|e| EngineError::Io(e.to_string()))?;

    let mut entries: Vec<_> = entries.filter_map(|e| e.ok()).collect();
    entries.sort_by_key(|e| e.file_name());

    for entry in entries {
        if *current_size >= max_bytes {
            break;
        }

        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        if path.is_dir() {
            if SKIP_DIRS.contains(&file_name.as_str()) {
                continue;
            }
            walk_and_collect(base, &path, output, current_size, max_bytes)?;
        } else if path.is_file() {
            let extension = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or_default();

            if !INCLUDE_EXTENSIONS.contains(&extension) {
                continue;
            }

            let content =
                std::fs::read_to_string(&path).map_err(|e| EngineError::Io(e.to_string()))?;

            let relative = path
                .strip_prefix(base)
                .unwrap_or(&path)
                .display()
                .to_string();

            let section = format!("--- {} ---\n{}\n\n", relative, content);
            if *current_size + section.len() > max_bytes {
                break;
            }
            output.push_str(&section);
            *current_size += section.len();
        }
    }
    Ok(())
}
