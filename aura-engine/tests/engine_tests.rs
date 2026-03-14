use aura_core::*;
use aura_engine::*;
use aura_engine::file_ops::Replacement;

// ---------------------------------------------------------------------------
// Path validation tests
// ---------------------------------------------------------------------------

#[test]
fn path_validation_accepts_valid_path() {
    let dir = tempfile::tempdir().unwrap();
    let base = dir.path().canonicalize().unwrap();
    std::fs::write(base.join("test.txt"), "hello").unwrap();

    let result = aura_engine::file_ops::validate_path(&base, &base.join("test.txt"));
    assert!(result.is_ok());
}

#[test]
fn path_validation_rejects_escape() {
    let dir = tempfile::tempdir().unwrap();
    let base = dir.path().canonicalize().unwrap();

    let escape_path = base.join("..").join("..").join("etc").join("passwd");
    let result = aura_engine::file_ops::validate_path(&base, &escape_path);
    assert!(result.is_err());
    match result.unwrap_err() {
        EngineError::PathEscape(_) => {}
        other => panic!("Expected PathEscape, got: {other:?}"),
    }
}

#[test]
fn path_validation_accepts_new_file_in_existing_dir() {
    let dir = tempfile::tempdir().unwrap();
    let base = dir.path().canonicalize().unwrap();

    let result = aura_engine::file_ops::validate_path(&base, &base.join("new_file.rs"));
    assert!(result.is_ok());
}

// ---------------------------------------------------------------------------
// Response parsing tests
// ---------------------------------------------------------------------------

#[test]
fn parse_valid_json_response() {
    let json = r#"
    {
        "notes": "Created the file",
        "file_ops": [
            { "op": "create", "path": "src/main.rs", "content": "fn main() {}" }
        ],
        "follow_up_tasks": []
    }
    "#;

    let result = parse_execution_response(json).unwrap();
    assert_eq!(result.notes, "Created the file");
    assert_eq!(result.file_ops.len(), 1);
    assert!(result.follow_up_tasks.is_empty());
}

#[test]
fn parse_fenced_json_response() {
    let response = r#"
Here is the implementation:

```json
{
    "notes": "Done",
    "file_ops": [
        { "op": "modify", "path": "lib.rs", "content": "pub mod foo;" }
    ],
    "follow_up_tasks": [
        { "title": "Add tests", "description": "Test the foo module" }
    ]
}
```
    "#;

    let result = parse_execution_response(response).unwrap();
    assert_eq!(result.notes, "Done");
    assert_eq!(result.file_ops.len(), 1);
    assert_eq!(result.follow_up_tasks.len(), 1);
    assert_eq!(result.follow_up_tasks[0].title, "Add tests");
}

#[test]
fn parse_malformed_response_fails() {
    let bad = "This is not JSON at all, just plain text";
    let result = parse_execution_response(bad);
    assert!(result.is_err());
    match result.unwrap_err() {
        EngineError::Parse(_) => {}
        other => panic!("Expected Parse error, got: {other:?}"),
    }
}

#[test]
fn parse_response_with_delete_op() {
    let json = r#"{
        "notes": "Cleaned up",
        "file_ops": [
            { "op": "delete", "path": "old_file.rs" }
        ],
        "follow_up_tasks": []
    }"#;

    let result = parse_execution_response(json).unwrap();
    assert_eq!(result.file_ops.len(), 1);
    match &result.file_ops[0] {
        FileOp::Delete { path } => assert_eq!(path, "old_file.rs"),
        _ => panic!("Expected Delete op"),
    }
}

#[test]
fn parse_response_without_follow_up_field() {
    let json = r#"{
        "notes": "Done",
        "file_ops": []
    }"#;

    let result = parse_execution_response(json).unwrap();
    assert!(result.follow_up_tasks.is_empty());
}

// ---------------------------------------------------------------------------
// File operations tests
// ---------------------------------------------------------------------------

#[tokio::test]
async fn apply_file_ops_creates_file() {
    let dir = tempfile::tempdir().unwrap();
    let base = dir.path().canonicalize().unwrap();

    let ops = vec![FileOp::Create {
        path: "hello.txt".into(),
        content: "Hello, world!".into(),
    }];

    file_ops::apply_file_ops(&base, &ops).await.unwrap();
    let content = std::fs::read_to_string(base.join("hello.txt")).unwrap();
    assert_eq!(content, "Hello, world!");
}

#[tokio::test]
async fn apply_file_ops_creates_nested_dirs() {
    let dir = tempfile::tempdir().unwrap();
    let base = dir.path().canonicalize().unwrap();

    let ops = vec![FileOp::Create {
        path: "src/nested/file.rs".into(),
        content: "fn nested() {}".into(),
    }];

    file_ops::apply_file_ops(&base, &ops).await.unwrap();
    assert!(base.join("src/nested/file.rs").exists());
}

#[tokio::test]
async fn apply_file_ops_modifies_file() {
    let dir = tempfile::tempdir().unwrap();
    let base = dir.path().canonicalize().unwrap();
    std::fs::write(base.join("existing.txt"), "old content").unwrap();

    let ops = vec![FileOp::Modify {
        path: "existing.txt".into(),
        content: "new content".into(),
    }];

    file_ops::apply_file_ops(&base, &ops).await.unwrap();
    let content = std::fs::read_to_string(base.join("existing.txt")).unwrap();
    assert_eq!(content, "new content");
}

#[tokio::test]
async fn apply_file_ops_deletes_file() {
    let dir = tempfile::tempdir().unwrap();
    let base = dir.path().canonicalize().unwrap();
    std::fs::write(base.join("doomed.txt"), "bye").unwrap();

    let ops = vec![FileOp::Delete {
        path: "doomed.txt".into(),
    }];

    file_ops::apply_file_ops(&base, &ops).await.unwrap();
    assert!(!base.join("doomed.txt").exists());
}

#[tokio::test]
async fn apply_file_ops_delete_nonexistent_is_ok() {
    let dir = tempfile::tempdir().unwrap();
    let base = dir.path().canonicalize().unwrap();

    let ops = vec![FileOp::Delete {
        path: "nonexistent.txt".into(),
    }];

    file_ops::apply_file_ops(&base, &ops).await.unwrap();
}

// ---------------------------------------------------------------------------
// SearchReplace file operations tests
// ---------------------------------------------------------------------------

#[tokio::test]
async fn apply_search_replace_single_replacement() {
    let dir = tempfile::tempdir().unwrap();
    let base = dir.path().canonicalize().unwrap();
    std::fs::write(base.join("lib.rs"), "fn old_name() {\n    42\n}\n").unwrap();

    let ops = vec![FileOp::SearchReplace {
        path: "lib.rs".into(),
        replacements: vec![Replacement {
            search: "fn old_name()".into(),
            replace: "fn new_name()".into(),
        }],
    }];

    file_ops::apply_file_ops(&base, &ops).await.unwrap();
    let content = std::fs::read_to_string(base.join("lib.rs")).unwrap();
    assert!(content.contains("fn new_name()"));
    assert!(!content.contains("fn old_name()"));
    assert!(content.contains("42"), "untouched code should be preserved");
}

#[tokio::test]
async fn apply_search_replace_multiple_replacements() {
    let dir = tempfile::tempdir().unwrap();
    let base = dir.path().canonicalize().unwrap();
    std::fs::write(
        base.join("main.rs"),
        "fn alpha() { 1 }\nfn beta() { 2 }\nfn gamma() { 3 }\n",
    )
    .unwrap();

    let ops = vec![FileOp::SearchReplace {
        path: "main.rs".into(),
        replacements: vec![
            Replacement {
                search: "fn alpha() { 1 }".into(),
                replace: "fn alpha() { 10 }".into(),
            },
            Replacement {
                search: "fn gamma() { 3 }".into(),
                replace: "fn gamma() { 30 }".into(),
            },
        ],
    }];

    file_ops::apply_file_ops(&base, &ops).await.unwrap();
    let content = std::fs::read_to_string(base.join("main.rs")).unwrap();
    assert!(content.contains("fn alpha() { 10 }"));
    assert!(content.contains("fn beta() { 2 }"), "beta should be untouched");
    assert!(content.contains("fn gamma() { 30 }"));
}

#[tokio::test]
async fn apply_search_replace_fails_when_not_found() {
    let dir = tempfile::tempdir().unwrap();
    let base = dir.path().canonicalize().unwrap();
    std::fs::write(base.join("lib.rs"), "fn existing() {}\n").unwrap();

    let ops = vec![FileOp::SearchReplace {
        path: "lib.rs".into(),
        replacements: vec![Replacement {
            search: "fn nonexistent()".into(),
            replace: "fn replaced()".into(),
        }],
    }];

    let err = file_ops::apply_file_ops(&base, &ops).await.unwrap_err();
    match err {
        EngineError::Parse(msg) => {
            assert!(msg.contains("not found"), "error should mention not found: {msg}");
        }
        other => panic!("Expected Parse error, got: {other:?}"),
    }
}

#[tokio::test]
async fn apply_search_replace_fails_on_duplicate_match() {
    let dir = tempfile::tempdir().unwrap();
    let base = dir.path().canonicalize().unwrap();
    std::fs::write(
        base.join("lib.rs"),
        "fn foo() { 1 }\nfn foo() { 2 }\n",
    )
    .unwrap();

    let ops = vec![FileOp::SearchReplace {
        path: "lib.rs".into(),
        replacements: vec![Replacement {
            search: "fn foo()".into(),
            replace: "fn bar()".into(),
        }],
    }];

    let err = file_ops::apply_file_ops(&base, &ops).await.unwrap_err();
    match err {
        EngineError::Parse(msg) => {
            assert!(msg.contains("matched 2 times"), "error should mention duplicate: {msg}");
        }
        other => panic!("Expected Parse error, got: {other:?}"),
    }
}

#[tokio::test]
async fn apply_search_replace_file_not_found() {
    let dir = tempfile::tempdir().unwrap();
    let base = dir.path().canonicalize().unwrap();

    let ops = vec![FileOp::SearchReplace {
        path: "missing.rs".into(),
        replacements: vec![Replacement {
            search: "x".into(),
            replace: "y".into(),
        }],
    }];

    let err = file_ops::apply_file_ops(&base, &ops).await.unwrap_err();
    match err {
        EngineError::Io(msg) => {
            assert!(msg.contains("missing.rs"), "error should mention the file: {msg}");
        }
        other => panic!("Expected Io error, got: {other:?}"),
    }
}

#[test]
fn parse_response_with_search_replace_op() {
    let json = r#"{
        "notes": "Fixed the bug",
        "file_ops": [
            {
                "op": "search_replace",
                "path": "src/lib.rs",
                "replacements": [
                    { "search": "old_code()", "replace": "new_code()" }
                ]
            }
        ]
    }"#;

    let result = parse_execution_response(json).unwrap();
    assert_eq!(result.notes, "Fixed the bug");
    assert_eq!(result.file_ops.len(), 1);
    match &result.file_ops[0] {
        FileOp::SearchReplace { path, replacements } => {
            assert_eq!(path, "src/lib.rs");
            assert_eq!(replacements.len(), 1);
            assert_eq!(replacements[0].search, "old_code()");
            assert_eq!(replacements[0].replace, "new_code()");
        }
        other => panic!("Expected SearchReplace, got: {other:?}"),
    }
}

// ---------------------------------------------------------------------------
// Codebase reading tests
// ---------------------------------------------------------------------------

#[test]
fn read_relevant_files_collects_source_files() {
    let dir = tempfile::tempdir().unwrap();
    let base = dir.path();
    std::fs::create_dir_all(base.join("src")).unwrap();
    std::fs::write(base.join("src/main.rs"), "fn main() {}").unwrap();
    std::fs::write(base.join("Cargo.toml"), "[package]\nname = \"test\"").unwrap();

    let result = file_ops::read_relevant_files(&base.to_string_lossy(), 100_000).unwrap();
    assert!(result.contains("main.rs"));
    assert!(result.contains("fn main()"));
    assert!(result.contains("Cargo.toml"));
}

#[test]
fn read_relevant_files_skips_git_dir() {
    let dir = tempfile::tempdir().unwrap();
    let base = dir.path();
    std::fs::create_dir_all(base.join(".git/objects")).unwrap();
    std::fs::write(base.join(".git/objects/test.rs"), "secret").unwrap();
    std::fs::write(base.join("src.rs"), "pub fn x() {}").unwrap();

    let result = file_ops::read_relevant_files(&base.to_string_lossy(), 100_000).unwrap();
    assert!(!result.contains("secret"));
    assert!(result.contains("pub fn x()"));
}

#[test]
fn read_relevant_files_respects_size_cap() {
    let dir = tempfile::tempdir().unwrap();
    let base = dir.path();

    // Create a large file (>50KB)
    let big_content = "x".repeat(60_000);
    std::fs::write(base.join("big.rs"), &big_content).unwrap();
    std::fs::write(base.join("small.rs"), "fn small() {}").unwrap();

    let result = file_ops::read_relevant_files(&base.to_string_lossy(), 1_000).unwrap();
    // Should be capped and not contain all the big file content
    assert!(result.len() < 2_000);
}

// ---------------------------------------------------------------------------
// Event emission test
// ---------------------------------------------------------------------------

#[test]
fn engine_event_serialization() {
    let event = EngineEvent::TaskStarted {
        task_id: TaskId::new(),
        task_title: "Test task".into(),
        session_id: SessionId::new(),
        prompt_tokens_estimate: None,
        codebase_snapshot_bytes: None,
        codebase_file_count: None,
    };
    let json = serde_json::to_string(&event).unwrap();
    assert!(json.contains("task_started"));
    assert!(json.contains("Test task"));
}

#[test]
fn engine_event_loop_finished_serialization() {
    let event = EngineEvent::LoopFinished {
        outcome: "all_tasks_complete".into(),
        total_duration_ms: None,
        tasks_completed: None,
        tasks_failed: None,
        tasks_retried: None,
        total_input_tokens: None,
        total_output_tokens: None,
        sessions_used: None,
        total_parse_retries: None,
        total_build_fix_attempts: None,
        duplicate_error_bailouts: None,
    };
    let json = serde_json::to_string(&event).unwrap();
    assert!(json.contains("loop_finished"));
    assert!(json.contains("all_tasks_complete"));
}

// ---------------------------------------------------------------------------
// Loop handle / command tests
// ---------------------------------------------------------------------------

#[test]
fn loop_command_equality() {
    assert_eq!(LoopCommand::Continue, LoopCommand::Continue);
    assert_ne!(LoopCommand::Continue, LoopCommand::Pause);
    assert_ne!(LoopCommand::Pause, LoopCommand::Stop);
}

#[test]
fn loop_outcome_variants() {
    let complete = LoopOutcome::AllTasksComplete;
    let paused = LoopOutcome::Paused { completed_count: 3 };
    let stopped = LoopOutcome::Stopped { completed_count: 1 };
    let blocked = LoopOutcome::AllTasksBlocked;
    let task_failed = LoopOutcome::TaskFailed {
        completed_count: 2,
        task_id: TaskId::new(),
        reason: "boom".into(),
    };
    let error = LoopOutcome::Error("test".into());

    let _ = format!("{complete:?}");
    let _ = format!("{paused:?}");
    let _ = format!("{stopped:?}");
    let _ = format!("{blocked:?}");
    let _ = format!("{task_failed:?}");
    let _ = format!("{error:?}");
}
