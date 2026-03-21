mod fixtures;

use aura_engine::*;

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
