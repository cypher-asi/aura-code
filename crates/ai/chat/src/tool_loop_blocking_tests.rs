use super::*;

// -- Read guard ----------------------------------------------------------

#[test]
fn test_detect_blocked_reads_allows_first_two() {
    let mut state = ReadGuardState::new();
    let calls = vec![
        ToolCall { id: "t1".into(), name: "read_file".into(), input: serde_json::json!({"path": "src/lib.rs"}) },
    ];

    let blocked = read_guard::detect_blocked_reads(&calls, &mut state);
    assert!(blocked.is_empty(), "1st read should not be blocked");
    assert_eq!(state.full_reads["src/lib.rs"], 1);

    let blocked = read_guard::detect_blocked_reads(&calls, &mut state);
    assert!(blocked.is_empty(), "2nd read should not be blocked");
    assert_eq!(state.full_reads["src/lib.rs"], 2);
}

#[test]
fn test_detect_blocked_reads_blocks_third() {
    let mut state = ReadGuardState::new();
    let calls = vec![
        ToolCall { id: "t1".into(), name: "read_file".into(), input: serde_json::json!({"path": "src/lib.rs"}) },
    ];

    read_guard::detect_blocked_reads(&calls, &mut state);
    read_guard::detect_blocked_reads(&calls, &mut state);
    let blocked = read_guard::detect_blocked_reads(&calls, &mut state);
    assert_eq!(blocked, vec![0], "3rd full read of same file should be blocked");
    assert_eq!(state.full_reads["src/lib.rs"], 3);
}

#[test]
fn test_detect_blocked_reads_different_files_independent() {
    let mut state = ReadGuardState::new();
    let calls_a = vec![
        ToolCall { id: "t1".into(), name: "read_file".into(), input: serde_json::json!({"path": "a.rs"}) },
    ];
    let calls_b = vec![
        ToolCall { id: "t2".into(), name: "read_file".into(), input: serde_json::json!({"path": "b.rs"}) },
    ];

    read_guard::detect_blocked_reads(&calls_a, &mut state);
    read_guard::detect_blocked_reads(&calls_a, &mut state);
    read_guard::detect_blocked_reads(&calls_b, &mut state);

    assert_eq!(state.full_reads["a.rs"], 2);
    assert_eq!(state.full_reads["b.rs"], 1);

    let blocked_a = read_guard::detect_blocked_reads(&calls_a, &mut state);
    assert_eq!(blocked_a, vec![0], "3rd read of a.rs should be blocked");

    let blocked_b = read_guard::detect_blocked_reads(&calls_b, &mut state);
    assert!(blocked_b.is_empty(), "2nd read of b.rs should not be blocked");
}

// -- Write blocking ------------------------------------------------------

#[test]
fn test_detect_blocked_writes_blocks_second_attempt_same_file() {
    let mut tracker: HashMap<String, usize> = HashMap::new();
    let calls = vec![ToolCall {
        id: "w1".into(),
        name: "write_file".into(),
        input: serde_json::json!({"path": "src/lib.rs"}),
    }];

    let first = detect_blocked_writes(&calls, &mut tracker);
    assert!(first.is_empty(), "first write should be allowed");

    let second = detect_blocked_writes(&calls, &mut tracker);
    assert_eq!(second, vec![0], "second consecutive write should be blocked");
}

#[test]
fn test_detect_write_file_cooldowns_blocks_write_only() {
    let mut cooldowns: HashMap<String, usize> = HashMap::new();
    cooldowns.insert("src/lib.rs".into(), 2);
    let calls = vec![
        ToolCall {
            id: "w1".into(),
            name: "write_file".into(),
            input: serde_json::json!({"path": "src/lib.rs"}),
        },
        ToolCall {
            id: "e1".into(),
            name: "edit_file".into(),
            input: serde_json::json!({"path": "src/lib.rs"}),
        },
    ];

    let blocked = detect_write_file_cooldowns(&calls, &cooldowns);
    assert_eq!(blocked, vec![0], "cooldown should block write_file but not edit_file");
}

#[test]
fn test_decrement_write_file_cooldowns_removes_expired_entries() {
    let mut cooldowns: HashMap<String, usize> = HashMap::new();
    cooldowns.insert("a.rs".into(), 1);
    cooldowns.insert("b.rs".into(), 3);

    decrement_write_file_cooldowns(&mut cooldowns);
    assert!(!cooldowns.contains_key("a.rs"));
    assert_eq!(cooldowns.get("b.rs"), Some(&2));
}

#[test]
fn test_collect_duplicate_write_paths_deduplicates_paths() {
    let calls = vec![
        ToolCall {
            id: "w1".into(),
            name: "write_file".into(),
            input: serde_json::json!({"path": "x.rs"}),
        },
        ToolCall {
            id: "e1".into(),
            name: "edit_file".into(),
            input: serde_json::json!({"path": "x.rs"}),
        },
        ToolCall {
            id: "w2".into(),
            name: "write_file".into(),
            input: serde_json::json!({"path": "y.rs"}),
        },
    ];

    let paths = collect_duplicate_write_paths(&calls, &[0, 1, 2]);
    assert_eq!(paths, vec!["x.rs".to_string(), "y.rs".to_string()]);
}

// -- Write failure blocking ----------------------------------------------

#[test]
fn test_detect_blocked_write_failures_allows_first_two() {
    let mut failures: HashMap<String, usize> = HashMap::new();
    let calls = vec![
        ToolCall { id: "t1".into(), name: "write_file".into(), input: serde_json::json!({"path": "src/lib.rs"}) },
    ];

    failures.insert("src/lib.rs".into(), 1);
    let blocked = detect_blocked_write_failures(&calls, &failures);
    assert!(blocked.is_empty(), "1 failure should not block");

    failures.insert("src/lib.rs".into(), 2);
    let blocked = detect_blocked_write_failures(&calls, &failures);
    assert!(blocked.is_empty(), "2 failures should not block");
}

#[test]
fn test_detect_blocked_write_failures_blocks_at_three() {
    let mut failures: HashMap<String, usize> = HashMap::new();
    failures.insert("src/lib.rs".into(), 3);

    let calls = vec![
        ToolCall { id: "t1".into(), name: "write_file".into(), input: serde_json::json!({"path": "src/lib.rs"}) },
        ToolCall { id: "t2".into(), name: "edit_file".into(), input: serde_json::json!({"path": "src/lib.rs"}) },
    ];

    let blocked = detect_blocked_write_failures(&calls, &failures);
    assert_eq!(blocked, vec![0, 1], "3 failures should block both write and edit");
}

#[test]
fn test_detect_blocked_write_failures_independent_per_file() {
    let mut failures: HashMap<String, usize> = HashMap::new();
    failures.insert("a.rs".into(), 3);
    failures.insert("b.rs".into(), 1);

    let calls = vec![
        ToolCall { id: "t1".into(), name: "write_file".into(), input: serde_json::json!({"path": "a.rs"}) },
        ToolCall { id: "t2".into(), name: "write_file".into(), input: serde_json::json!({"path": "b.rs"}) },
    ];

    let blocked = detect_blocked_write_failures(&calls, &failures);
    assert_eq!(blocked, vec![0], "only a.rs (3 failures) should be blocked, not b.rs (1 failure)");
}

// -- Exploration blocking ------------------------------------------------

#[test]
fn test_detect_blocked_exploration_not_blocked() {
    let calls = vec![
        ToolCall { id: "t1".into(), name: "read_file".into(), input: serde_json::json!({"path": "a.rs"}) },
        ToolCall { id: "t2".into(), name: "search_code".into(), input: serde_json::json!({"query": "fn main"}) },
        ToolCall { id: "t3".into(), name: "write_file".into(), input: serde_json::json!({"path": "b.rs"}) },
    ];

    let blocked = detect_blocked_exploration(&calls, false);
    assert!(blocked.is_empty());
}

#[test]
fn test_detect_blocked_exploration_blocks_only_exploration() {
    let calls = vec![
        ToolCall { id: "t1".into(), name: "read_file".into(), input: serde_json::json!({"path": "a.rs"}) },
        ToolCall { id: "t2".into(), name: "write_file".into(), input: serde_json::json!({"path": "b.rs"}) },
        ToolCall { id: "t3".into(), name: "search_code".into(), input: serde_json::json!({"query": "fn main"}) },
        ToolCall { id: "t4".into(), name: "find_files".into(), input: serde_json::json!({"pattern": "*.rs"}) },
        ToolCall { id: "t5".into(), name: "list_files".into(), input: serde_json::json!({"dir": "src"}) },
        ToolCall { id: "t6".into(), name: "run_command".into(), input: serde_json::json!({"command": "cargo build"}) },
    ];

    let blocked = detect_blocked_exploration(&calls, true);
    assert_eq!(blocked, vec![0, 2, 3, 4], "should block read_file, search_code, find_files, list_files but not write_file or run_command");
}

#[tokio::test]
async fn test_exploration_hard_block_at_limit() {
    let mut responses: Vec<MockResponse> = Vec::new();
    for i in 0..14 {
        responses.push(
            MockResponse::tool_use(vec![ToolCall {
                id: format!("t{i}"),
                name: "read_file".into(),
                input: serde_json::json!({"path": format!("file{i}.rs")}),
            }])
            .with_tokens(50, 30),
        );
    }
    responses.push(MockResponse::text("Done").with_tokens(50, 30));

    let mock = Arc::new(MockLlmProvider::with_responses(responses));
    let (llm, _tmp) = testutil::make_test_llm(mock).await;
    let (event_tx, mut event_rx) = mpsc::unbounded_channel();
    let config = default_config(20);

    let executor = SimpleExecutor {
        handler: Box::new(|calls| {
            calls.iter().map(|tc| ToolCallResult {
                tool_use_id: tc.id.clone(),
                content: "file content".into(),
                is_error: false,
                stop_loop: false,
            }).collect()
        }),
    };

    let result = run_tool_loop(ToolLoopInput {
        llm, api_key: "test-key", system_prompt: "test",
        initial_messages: vec![RichMessage::user("read")],
        tools: Arc::from(Vec::<ToolDefinition>::new()), config: &config,
        executor: &executor, event_tx: &event_tx,
    }).await;

    assert!(!result.timed_out);

    let mut blocked_count = 0;
    while let Ok(evt) = event_rx.try_recv() {
        if let ToolLoopEvent::ToolResult { content, is_error, .. } = evt {
            if is_error && content.contains("Exploration blocked") {
                blocked_count += 1;
            }
        }
    }
    assert!(blocked_count > 0, "should have blocked at least one exploration call after limit");
}

#[tokio::test]
async fn test_exploration_unblocks_after_write() {
    let responses = vec![
        MockResponse::tool_use(vec![
            ToolCall { id: "r1".into(), name: "read_file".into(), input: serde_json::json!({"path": "f1.rs"}) },
            ToolCall { id: "r2".into(), name: "read_file".into(), input: serde_json::json!({"path": "f2.rs"}) },
            ToolCall { id: "r3".into(), name: "read_file".into(), input: serde_json::json!({"path": "f3.rs"}) },
            ToolCall { id: "r4".into(), name: "read_file".into(), input: serde_json::json!({"path": "f4.rs"}) },
        ]).with_tokens(50, 30),
        MockResponse::tool_use(vec![
            ToolCall { id: "r5".into(), name: "read_file".into(), input: serde_json::json!({"path": "f5.rs"}) },
            ToolCall { id: "r6".into(), name: "read_file".into(), input: serde_json::json!({"path": "f6.rs"}) },
            ToolCall { id: "r7".into(), name: "read_file".into(), input: serde_json::json!({"path": "f7.rs"}) },
            ToolCall { id: "r8".into(), name: "read_file".into(), input: serde_json::json!({"path": "f8.rs"}) },
        ]).with_tokens(50, 30),
        MockResponse::tool_use(vec![
            ToolCall { id: "r9".into(), name: "read_file".into(), input: serde_json::json!({"path": "f9.rs"}) },
            ToolCall { id: "r10".into(), name: "read_file".into(), input: serde_json::json!({"path": "f10.rs"}) },
            ToolCall { id: "r11".into(), name: "read_file".into(), input: serde_json::json!({"path": "f11.rs"}) },
            ToolCall { id: "r12".into(), name: "read_file".into(), input: serde_json::json!({"path": "f12.rs"}) },
        ]).with_tokens(50, 30),
        MockResponse::tool_use(vec![
            ToolCall { id: "w1".into(), name: "write_file".into(), input: serde_json::json!({"path": "out.rs", "content": "done"}) },
        ]).with_tokens(50, 30),
        MockResponse::tool_use(vec![
            ToolCall { id: "r13".into(), name: "read_file".into(), input: serde_json::json!({"path": "f13.rs"}) },
        ]).with_tokens(50, 30),
        MockResponse::text("Done").with_tokens(50, 30),
    ];

    let mock = Arc::new(MockLlmProvider::with_responses(responses));
    let (llm, _tmp) = testutil::make_test_llm(mock).await;
    let (event_tx, mut event_rx) = mpsc::unbounded_channel();
    let config = default_config(20);
    let executor = ok_executor();

    let result = run_tool_loop(ToolLoopInput {
        llm, api_key: "test-key", system_prompt: "test",
        initial_messages: vec![RichMessage::user("read then write")],
        tools: Arc::from(Vec::<ToolDefinition>::new()), config: &config,
        executor: &executor, event_tx: &event_tx,
    }).await;

    assert!(!result.timed_out);

    let mut post_write_read_succeeded = false;
    while let Ok(evt) = event_rx.try_recv() {
        if let ToolLoopEvent::ToolResult { tool_use_id, is_error, .. } = evt {
            if tool_use_id == "r13" && !is_error {
                post_write_read_succeeded = true;
            }
        }
    }
    assert!(post_write_read_succeeded, "read after write should succeed (exploration unblocked)");
}
