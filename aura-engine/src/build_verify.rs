use std::path::Path;
use std::process::Stdio;

use tokio::process::Command;
use tracing::{info, warn};

use aura_core::IndividualTestResult;
use crate::error::EngineError;

#[derive(Debug, Clone)]
pub struct BuildResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

/// Maximum bytes of compiler output to capture and send back to the model.
const MAX_OUTPUT_BYTES: usize = 12_000;

fn truncate_output(s: &str, max: usize) -> String {
    if s.len() <= max {
        return s.to_string();
    }
    let half = max / 2;
    let start = &s[..half];
    let end = &s[s.len() - half..];
    format!("{start}\n\n... (truncated {0} bytes) ...\n\n{end}", s.len() - max)
}

/// Returns true if the command string contains shell operators that require
/// interpretation by a shell (&&, ||, pipes, redirects, semicolons, etc.).
fn needs_shell(cmd: &str) -> bool {
    cmd.contains("&&") || cmd.contains("||") || cmd.contains('|')
        || cmd.contains('>') || cmd.contains('<') || cmd.contains(';')
        || cmd.contains('$') || cmd.contains('`')
}

/// Run a build command in the project directory and capture the result.
///
/// Simple commands are split on whitespace and executed directly. Commands
/// containing shell operators (`&&`, `|`, etc.) are run through the system
/// shell (`cmd /C` on Windows, `sh -c` on Unix).
pub async fn run_build_command(
    project_dir: &Path,
    build_command: &str,
) -> Result<BuildResult, EngineError> {
    if build_command.split_whitespace().next().is_none() {
        return Err(EngineError::Parse("build_command is empty".into()));
    }

    info!(
        dir = %project_dir.display(),
        command = %build_command,
        "running build verification"
    );

    let output = if needs_shell(build_command) {
        #[cfg(target_os = "windows")]
        {
            Command::new("cmd")
                .args(["/C", build_command])
                .current_dir(project_dir)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output()
                .await
        }
        #[cfg(not(target_os = "windows"))]
        {
            Command::new("sh")
                .args(["-c", build_command])
                .current_dir(project_dir)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output()
                .await
        }
    } else {
        let parts: Vec<&str> = build_command.split_whitespace().collect();
        Command::new(parts[0])
            .args(&parts[1..])
            .current_dir(project_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await
    }
    .map_err(|e| EngineError::Io(format!("failed to execute build command `{build_command}`: {e}")))?;

    let stdout_raw = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr_raw = String::from_utf8_lossy(&output.stderr).to_string();

    let result = BuildResult {
        success: output.status.success(),
        stdout: truncate_output(&stdout_raw, MAX_OUTPUT_BYTES),
        stderr: truncate_output(&stderr_raw, MAX_OUTPUT_BYTES),
        exit_code: output.status.code(),
    };

    if result.success {
        info!(command = %build_command, "build verification passed");
    } else {
        warn!(
            command = %build_command,
            exit_code = ?result.exit_code,
            stderr_len = stderr_raw.len(),
            "build verification failed"
        );
    }

    Ok(result)
}

/// Parse test runner output into individual test results and a summary line.
///
/// Supports cargo test and Jest/npm test formats. Falls back to a single
/// aggregate result derived from the exit code when the format is unrecognised.
pub fn parse_test_output(stdout: &str, stderr: &str, success: bool) -> (Vec<IndividualTestResult>, String) {
    let combined = format!("{stdout}\n{stderr}");

    // Try cargo test format: `test module::name ... ok/FAILED/ignored`
    let cargo_results = parse_cargo_test(&combined);
    if !cargo_results.is_empty() {
        let passed = cargo_results.iter().filter(|r| r.status == "passed").count();
        let failed = cargo_results.iter().filter(|r| r.status == "failed").count();
        let ignored = cargo_results.iter().filter(|r| r.status == "skipped").count();
        let summary = format!("{passed} passed, {failed} failed, {ignored} ignored");
        return (cargo_results, summary);
    }

    // Try Jest format: `PASS src/foo.test.ts` / `FAIL src/bar.test.ts`
    let jest_results = parse_jest_output(&combined);
    if !jest_results.is_empty() {
        let passed = jest_results.iter().filter(|r| r.status == "passed").count();
        let failed = jest_results.iter().filter(|r| r.status == "failed").count();
        let summary = format!("{passed} passed, {failed} failed");
        return (jest_results, summary);
    }

    // Fallback: single aggregate result
    let status = if success { "passed" } else { "failed" };
    let summary = if success { "all tests passed".to_string() } else { "tests failed".to_string() };
    let result = IndividualTestResult {
        name: "(aggregate)".to_string(),
        status: status.to_string(),
        message: if !success {
            Some(truncate_output(&combined, 2000))
        } else {
            None
        },
    };
    (vec![result], summary)
}

fn parse_cargo_test(output: &str) -> Vec<IndividualTestResult> {
    let mut results = Vec::new();
    for line in output.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with("test ") {
            continue;
        }
        let rest = &trimmed[5..];
        if let Some(idx) = rest.find(" ... ") {
            let name = rest[..idx].trim().to_string();
            let outcome = rest[idx + 5..].trim();
            let status = match outcome {
                "ok" => "passed",
                "FAILED" => "failed",
                s if s.starts_with("ignored") => "skipped",
                _ => continue,
            };
            let message = if status == "failed" { Some(outcome.to_string()) } else { None };
            results.push(IndividualTestResult { name, status: status.to_string(), message });
        }
    }
    results
}

fn parse_jest_output(output: &str) -> Vec<IndividualTestResult> {
    let mut results = Vec::new();
    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("PASS ") {
            results.push(IndividualTestResult {
                name: trimmed[5..].trim().to_string(),
                status: "passed".to_string(),
                message: None,
            });
        } else if trimmed.starts_with("FAIL ") {
            results.push(IndividualTestResult {
                name: trimmed[5..].trim().to_string(),
                status: "failed".to_string(),
                message: None,
            });
        } else if trimmed.starts_with("\u{2713} ") || trimmed.starts_with("✓ ") {
            results.push(IndividualTestResult {
                name: trimmed[2..].trim().to_string(),
                status: "passed".to_string(),
                message: None,
            });
        } else if trimmed.starts_with("\u{2717} ") || trimmed.starts_with("✕ ") || trimmed.starts_with("✗ ") {
            results.push(IndividualTestResult {
                name: trimmed[3..].trim().to_string(),
                status: "failed".to_string(),
                message: None,
            });
        }
    }
    results
}
