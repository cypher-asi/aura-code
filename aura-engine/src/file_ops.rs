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

/// Compute line-level change stats for each file op before applying them.
/// Must be called before `apply_file_ops` so old file contents are still on disk.
pub fn compute_file_changes(
    base_path: &Path,
    ops: &[FileOp],
) -> Vec<aura_core::FileChangeSummary> {
    ops.iter()
        .map(|op| match op {
            FileOp::Create { path, content } => aura_core::FileChangeSummary {
                op: "create".to_string(),
                path: path.clone(),
                lines_added: content.lines().count() as u32,
                lines_removed: 0,
            },
            FileOp::Modify { path, content } => {
                let old_lines = std::fs::read_to_string(base_path.join(path))
                    .map(|s| s.lines().count() as u32)
                    .unwrap_or(0);
                aura_core::FileChangeSummary {
                    op: "modify".to_string(),
                    path: path.clone(),
                    lines_added: content.lines().count() as u32,
                    lines_removed: old_lines,
                }
            }
            FileOp::Delete { path } => {
                let old_lines = std::fs::read_to_string(base_path.join(path))
                    .map(|s| s.lines().count() as u32)
                    .unwrap_or(0);
                aura_core::FileChangeSummary {
                    op: "delete".to_string(),
                    path: path.clone(),
                    lines_added: 0,
                    lines_removed: old_lines,
                }
            }
        })
        .collect()
}

/// Pre-write validation: scan generated file content for patterns known to cause
/// build failures. Returns a list of warnings; empty means no issues detected.
/// This catches problems *before* a full build cycle, saving significant time.
pub fn validate_file_content(path: &str, content: &str) -> Vec<String> {
    let mut warnings = Vec::new();
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or_default();

    match ext {
        "rs" => validate_rust_content(path, content, &mut warnings),
        "ts" | "tsx" | "js" | "jsx" => validate_js_content(path, content, &mut warnings),
        _ => {}
    }
    warnings
}

fn validate_rust_content(path: &str, content: &str, warnings: &mut Vec<String>) {
    for (line_num, line) in content.lines().enumerate() {
        let ln = line_num + 1;

        // Detect non-ASCII characters that commonly cause "unknown start of token"
        for (col, ch) in line.char_indices() {
            if !ch.is_ascii() && !is_in_rust_comment(line, col) {
                let desc = match ch {
                    '\u{2014}' => "em dash (use '-' instead)",
                    '\u{2013}' => "en dash (use '-' instead)",
                    '\u{201C}' | '\u{201D}' => "smart quotes (use '\"' instead)",
                    '\u{2018}' | '\u{2019}' => "smart single quotes (use '\\'' instead)",
                    '\u{2026}' => "ellipsis (use '...' instead)",
                    _ if ch as u32 > 127 => "non-ASCII character",
                    _ => continue,
                };
                warnings.push(format!(
                    "{path}:{ln}:{col}: {desc} '{}' (U+{:04X})",
                    ch, ch as u32
                ));
            }
        }

        // Detect JSON-like string literals that should use raw strings
        if (line.contains(r#""markdown_contents":"#) || line.contains(r#""content":"#))
            && line.contains("\\n")
            && !line.trim_start().starts_with("//")
            && !line.trim_start().starts_with("r#")
            && !line.trim_start().starts_with("r\"")
        {
            warnings.push(format!(
                "{path}:{ln}: string literal contains \\n escape sequences — \
                 consider using raw string r#\"...\"# or serde_json::json!()"
            ));
        }
    }

    // Detect unbalanced braces in non-string, non-comment context (simple heuristic)
    let mut brace_depth: i32 = 0;
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("//") {
            continue;
        }
        for ch in trimmed.chars() {
            match ch {
                '{' => brace_depth += 1,
                '}' => brace_depth -= 1,
                _ => {}
            }
        }
    }
    if brace_depth != 0 {
        warnings.push(format!(
            "{path}: unbalanced braces (depth delta: {brace_depth})"
        ));
    }
}

fn validate_js_content(path: &str, content: &str, warnings: &mut Vec<String>) {
    for (line_num, line) in content.lines().enumerate() {
        let ln = line_num + 1;
        if (line.contains("from '") || line.contains("from \""))
            && line.contains("from './")
            && !line.contains("..")
        {
            let import_path = line.split("from ").nth(1).unwrap_or_default();
            if import_path.contains('\\') {
                warnings.push(format!(
                    "{path}:{ln}: import path uses backslashes -- use forward slashes"
                ));
            }
        }
    }
}

/// Very rough heuristic: check if a character position is inside a `//` comment.
fn is_in_rust_comment(line: &str, col: usize) -> bool {
    if let Some(comment_start) = line.find("//") {
        col > comment_start
    } else {
        false
    }
}

/// Validate all file ops before writing. Returns a combined report of all
/// warnings, or empty string if everything looks fine.
pub fn validate_all_file_ops(ops: &[FileOp]) -> String {
    let mut all_warnings = Vec::new();
    for op in ops {
        match op {
            FileOp::Create { path, content } | FileOp::Modify { path, content } => {
                all_warnings.extend(validate_file_content(path, content));
            }
            FileOp::Delete { .. } => {}
        }
    }
    if all_warnings.is_empty() {
        String::new()
    } else {
        format!(
            "Pre-write validation found {} issue(s):\n{}",
            all_warnings.len(),
            all_warnings.join("\n")
        )
    }
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
