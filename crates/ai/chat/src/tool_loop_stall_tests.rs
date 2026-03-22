use super::*;

// -- Write failure tracking (integration) --------------------------------

#[tokio::test]
async fn test_write_failure_tracking_blocks_after_repeated_errors() {
    let responses = vec![
        MockResponse::tool_use(vec![
            ToolCall {
                id: "e1".into(),
                name: "edit_file".into(),
                input: serde_json::json!({"path": "f.rs", "old_text": "x", "new_text": "y"}),
            },
            ToolCall {
                id: "d1".into(),
                name: "do_thing".into(),
                input: serde_json::json!({}),
            },
        ])
        .with_tokens(50, 30),
        MockResponse::tool_use(vec![
            ToolCall {
                id: "e2".into(),
                name: "edit_file".into(),
                input: serde_json::json!({"path": "f.rs", "old_text": "x", "new_text": "y"}),
            },
            ToolCall {
                id: "d2".into(),
                name: "do_thing".into(),
                input: serde_json::json!({}),
            },
            ToolCall {
                id: "w2".into(),
                name: "write_file".into(),
                input: serde_json::json!({"path": "reset.rs", "content": "ok"}),
            },
        ])
        .with_tokens(50, 30),
        MockResponse::tool_use(vec![
            ToolCall {
                id: "e3".into(),
                name: "edit_file".into(),
                input: serde_json::json!({"path": "f.rs", "old_text": "x", "new_text": "y"}),
            },
            ToolCall {
                id: "d3".into(),
                name: "do_thing".into(),
                input: serde_json::json!({}),
            },
        ])
        .with_tokens(50, 30),
        MockResponse::tool_use(vec![
            ToolCall {
                id: "e4".into(),
                name: "edit_file".into(),
                input: serde_json::json!({"path": "f.rs", "old_text": "x", "new_text": "y"}),
            },
            ToolCall {
                id: "d4".into(),
                name: "do_thing".into(),
                input: serde_json::json!({}),
            },
        ])
        .with_tokens(50, 30),
        MockResponse::text("Gave up").with_tokens(50, 30),
    ];

    let mock = Arc::new(MockLlmProvider::with_responses(responses));
    let (llm, _tmp) = testutil::make_test_llm(mock).await;
    let (event_tx, mut event_rx) = mpsc::unbounded_channel();
    let config = default_config(10);

    let executor = SimpleExecutor {
        handler: Box::new(|calls| {
            calls
                .iter()
                .map(|tc| {
                    if tc.name == "edit_file" {
                        ToolCallResult {
                            tool_use_id: tc.id.clone(),
                            content: "edit failed: old_text not found".into(),
                            is_error: true,
                            stop_loop: false,
                        }
                    } else {
                        ToolCallResult {
                            tool_use_id: tc.id.clone(),
                            content: "ok".into(),
                            is_error: false,
                            stop_loop: false,
                        }
                    }
                })
                .collect()
        }),
    };

    let result = run_tool_loop(ToolLoopInput {
        llm,
        api_key: "test-key",
        system_prompt: "test",
        initial_messages: vec![RichMessage::user("edit")],
        tools: Arc::from(Vec::<ToolDefinition>::new()),
        config: &config,
        executor: &executor,
        event_tx: &event_tx,
    })
    .await;

    assert!(!result.timed_out);

    let mut blocked_on_e4 = false;
    while let Ok(evt) = event_rx.try_recv() {
        if let ToolLoopEvent::ToolResult {
            tool_use_id,
            content,
            is_error,
            ..
        } = evt
        {
            if tool_use_id == "e4" && is_error && content.contains("blocked after") {
                blocked_on_e4 = true;
            }
        }
    }
    assert!(
        blocked_on_e4,
        "4th edit attempt should be blocked after 3 failures"
    );
}

// -- Stall fail-fast -----------------------------------------------------

#[tokio::test]
async fn test_stall_fail_fast_after_three_consecutive_failed_edits() {
    let responses: Vec<MockResponse> = (0..5)
        .map(|i| {
            MockResponse::tool_use(vec![ToolCall {
                id: format!("e{i}"),
                name: "edit_file".into(),
                input: serde_json::json!({"path": "src/lib.rs", "old_text": "x", "new_text": "y"}),
            }])
            .with_tokens(50, 30)
        })
        .chain(std::iter::once(
            MockResponse::text("fallback").with_tokens(50, 30),
        ))
        .collect();

    let mock = Arc::new(MockLlmProvider::with_responses(responses));
    let (llm, _tmp) = testutil::make_test_llm(mock).await;
    let (event_tx, mut event_rx) = mpsc::unbounded_channel();
    let config = default_config(10);

    let executor = SimpleExecutor {
        handler: Box::new(|calls| {
            calls
                .iter()
                .map(|tc| ToolCallResult {
                    tool_use_id: tc.id.clone(),
                    content: "edit failed: old_text not found".into(),
                    is_error: true,
                    stop_loop: false,
                })
                .collect()
        }),
    };

    let result = run_tool_loop(ToolLoopInput {
        llm,
        api_key: "test-key",
        system_prompt: "test",
        initial_messages: vec![RichMessage::user("edit")],
        tools: Arc::from(Vec::<ToolDefinition>::new()),
        config: &config,
        executor: &executor,
        event_tx: &event_tx,
    })
    .await;

    assert!(
        result.iterations_run <= 4,
        "should stop early due to stall fail-fast"
    );

    let mut found_stall_error = false;
    while let Ok(evt) = event_rx.try_recv() {
        if let ToolLoopEvent::Error(msg) = evt {
            if msg.contains("STALL FAIL-FAST") {
                found_stall_error = true;
            }
        }
    }
    assert!(found_stall_error, "should emit stall fail-fast error");
}

// -- Mixed blocked / allowed ---------------------------------------------

#[tokio::test]
async fn test_mixed_tool_calls_some_blocked_some_allowed() {
    let mock = Arc::new(MockLlmProvider::with_responses(vec![
        MockResponse::tool_use(vec![ToolCall {
            id: "r1".into(),
            name: "read_file".into(),
            input: serde_json::json!({"path": "a.rs"}),
        }])
        .with_tokens(50, 30),
        MockResponse::tool_use(vec![ToolCall {
            id: "r2".into(),
            name: "read_file".into(),
            input: serde_json::json!({"path": "a.rs"}),
        }])
        .with_tokens(50, 30),
        MockResponse::tool_use(vec![
            ToolCall {
                id: "r3".into(),
                name: "read_file".into(),
                input: serde_json::json!({"path": "a.rs"}),
            },
            ToolCall {
                id: "t1".into(),
                name: "do_thing".into(),
                input: serde_json::json!({}),
            },
        ])
        .with_tokens(50, 30),
        MockResponse::text("Done").with_tokens(50, 30),
    ]));

    let (llm, _tmp) = testutil::make_test_llm(mock).await;
    let (event_tx, mut event_rx) = mpsc::unbounded_channel();
    let config = default_config(10);
    let executor = ok_executor();

    let result = run_tool_loop(ToolLoopInput {
        llm,
        api_key: "test-key",
        system_prompt: "test",
        initial_messages: vec![RichMessage::user("read then read more")],
        tools: Arc::from(Vec::<ToolDefinition>::new()),
        config: &config,
        executor: &executor,
        event_tx: &event_tx,
    })
    .await;

    assert_eq!(result.iterations_run, 4);

    let mut r3_blocked = false;
    let mut t1_ok = false;
    while let Ok(evt) = event_rx.try_recv() {
        if let ToolLoopEvent::ToolResult {
            tool_use_id,
            is_error,
            content,
            ..
        } = evt
        {
            if tool_use_id == "r3" && is_error && content.contains("BLOCKED") {
                r3_blocked = true;
            }
            if tool_use_id == "t1" && !is_error {
                t1_ok = true;
            }
        }
    }
    assert!(r3_blocked, "3rd read of a.rs should be blocked");
    assert!(t1_ok, "do_thing in same batch should still execute");
}

// -- detect_blocked_commands ---------------------------------------------

#[test]
fn test_detect_blocked_commands_returns_empty_when_failures_under_5() {
    let calls = vec![ToolCall {
        id: "t1".into(),
        name: "run_command".into(),
        input: serde_json::json!({"command": "ls"}),
    }];
    let blocked = detect_blocked_commands(&calls, 4);
    assert!(blocked.is_empty(), "4 failures should not block");
}

#[test]
fn test_detect_blocked_commands_blocks_at_exactly_5() {
    let calls = vec![ToolCall {
        id: "t1".into(),
        name: "run_command".into(),
        input: serde_json::json!({"command": "ls"}),
    }];
    let blocked = detect_blocked_commands(&calls, 5);
    assert_eq!(blocked, vec![0]);
}

#[test]
fn test_detect_blocked_commands_does_not_block_non_run_command() {
    let calls = vec![
        ToolCall {
            id: "t1".into(),
            name: "read_file".into(),
            input: serde_json::json!({"path": "a.rs"}),
        },
        ToolCall {
            id: "t2".into(),
            name: "write_file".into(),
            input: serde_json::json!({"path": "b.rs"}),
        },
    ];
    let blocked = detect_blocked_commands(&calls, 10);
    assert!(blocked.is_empty());
}

#[test]
fn test_detect_blocked_commands_blocks_multiple_run_commands() {
    let calls = vec![
        ToolCall {
            id: "t1".into(),
            name: "run_command".into(),
            input: serde_json::json!({"command": "ls"}),
        },
        ToolCall {
            id: "t2".into(),
            name: "read_file".into(),
            input: serde_json::json!({"path": "a.rs"}),
        },
        ToolCall {
            id: "t3".into(),
            name: "run_command".into(),
            input: serde_json::json!({"command": "pwd"}),
        },
    ];
    let blocked = detect_blocked_commands(&calls, 5);
    assert_eq!(blocked, vec![0, 2]);
}

// -- apply_cmd_failure_tracking ------------------------------------------

#[test]
fn test_apply_cmd_failure_tracking_increments_on_run_command_error() {
    let calls = vec![ToolCall {
        id: "t1".into(),
        name: "run_command".into(),
        input: serde_json::json!({"command": "bad"}),
    }];
    let results = vec![ToolCallResult {
        tool_use_id: "t1".into(),
        content: "command not found".into(),
        is_error: true,
        stop_loop: false,
    }];
    let mut failures = 0;
    apply_cmd_failure_tracking(&calls, results, &mut failures);
    assert_eq!(failures, 1);
}

#[test]
fn test_apply_cmd_failure_tracking_resets_on_success() {
    let calls = vec![ToolCall {
        id: "t1".into(),
        name: "read_file".into(),
        input: serde_json::json!({"path": "a.rs"}),
    }];
    let results = vec![ToolCallResult {
        tool_use_id: "t1".into(),
        content: "file content".into(),
        is_error: false,
        stop_loop: false,
    }];
    let mut failures = 3;
    apply_cmd_failure_tracking(&calls, results, &mut failures);
    assert_eq!(failures, 0);
}

#[test]
fn test_apply_cmd_failure_tracking_appends_warning_at_3_plus() {
    let calls = vec![ToolCall {
        id: "t1".into(),
        name: "run_command".into(),
        input: serde_json::json!({"command": "bad"}),
    }];
    let results = vec![ToolCallResult {
        tool_use_id: "t1".into(),
        content: "command not found".into(),
        is_error: true,
        stop_loop: false,
    }];
    let mut failures = 2;
    let updated = apply_cmd_failure_tracking(&calls, results, &mut failures);
    assert_eq!(failures, 3);
    assert!(
        updated[0].content.contains("WARNING"),
        "should append warning at 3 consecutive failures"
    );
    assert!(updated[0].content.contains("3 consecutive"));
}

#[test]
fn test_apply_cmd_failure_tracking_does_not_modify_non_error() {
    let calls = vec![ToolCall {
        id: "t1".into(),
        name: "run_command".into(),
        input: serde_json::json!({"command": "ls"}),
    }];
    let results = vec![ToolCallResult {
        tool_use_id: "t1".into(),
        content: "file1 file2".into(),
        is_error: false,
        stop_loop: false,
    }];
    let mut failures = 2;
    let updated = apply_cmd_failure_tracking(&calls, results, &mut failures);
    assert_eq!(updated[0].content, "file1 file2");
    assert_eq!(failures, 0);
}

// -- detect_same_target_stall --------------------------------------------

#[test]
fn test_detect_same_target_stall_triggers_after_three_no_progress_rounds() {
    let calls = vec![ToolCall {
        id: "e1".into(),
        name: "edit_file".into(),
        input: serde_json::json!({"path": "src/lib.rs"}),
    }];
    let results = vec![ToolCallResult {
        tool_use_id: "e1".into(),
        content: "failed".into(),
        is_error: true,
        stop_loop: false,
    }];
    let mut signature = None;
    let mut streak = 0usize;

    assert!(!detect_same_target_stall(
        &calls,
        &results,
        &mut signature,
        &mut streak
    ));
    assert_eq!(streak, 1);
    assert!(!detect_same_target_stall(
        &calls,
        &results,
        &mut signature,
        &mut streak
    ));
    assert_eq!(streak, 2);
    assert!(detect_same_target_stall(
        &calls,
        &results,
        &mut signature,
        &mut streak
    ));
    assert_eq!(streak, 3);
}

#[test]
fn test_detect_same_target_stall_resets_on_success() {
    let calls = vec![ToolCall {
        id: "e1".into(),
        name: "edit_file".into(),
        input: serde_json::json!({"path": "src/lib.rs"}),
    }];
    let fail = vec![ToolCallResult {
        tool_use_id: "e1".into(),
        content: "failed".into(),
        is_error: true,
        stop_loop: false,
    }];
    let ok = vec![ToolCallResult {
        tool_use_id: "e1".into(),
        content: "ok".into(),
        is_error: false,
        stop_loop: false,
    }];
    let mut signature = None;
    let mut streak = 0usize;

    assert!(!detect_same_target_stall(
        &calls,
        &fail,
        &mut signature,
        &mut streak
    ));
    assert_eq!(streak, 1);
    assert!(!detect_same_target_stall(
        &calls,
        &ok,
        &mut signature,
        &mut streak
    ));
    assert_eq!(streak, 0, "successful write should reset stall tracking");
}

#[test]
fn test_detect_same_target_stall_resets_on_edit_file_success() {
    let calls = vec![ToolCall {
        id: "e1".into(),
        name: "edit_file".into(),
        input: serde_json::json!({"path": "src/lib.rs", "old_text": "a", "new_text": "b"}),
    }];
    let fail = vec![ToolCallResult {
        tool_use_id: "e1".into(),
        content: "failed".into(),
        is_error: true,
        stop_loop: false,
    }];
    let ok = vec![ToolCallResult {
        tool_use_id: "e1".into(),
        content: "ok".into(),
        is_error: false,
        stop_loop: false,
    }];
    let mut sig = None;
    let mut streak = 0usize;

    detect_same_target_stall(&calls, &fail, &mut sig, &mut streak);
    assert_eq!(streak, 1);
    detect_same_target_stall(&calls, &fail, &mut sig, &mut streak);
    assert_eq!(streak, 2);

    detect_same_target_stall(&calls, &ok, &mut sig, &mut streak);
    assert_eq!(streak, 0, "successful edit_file should reset streak");
}

#[test]
fn test_detect_same_target_stall_different_write_content_resets() {
    let calls1 = vec![ToolCall {
        id: "w1".into(),
        name: "write_file".into(),
        input: serde_json::json!({"path": "a.rs", "content": "version 1"}),
    }];
    let calls2 = vec![ToolCall {
        id: "w2".into(),
        name: "write_file".into(),
        input: serde_json::json!({"path": "a.rs", "content": "version 2"}),
    }];
    let ok = vec![ToolCallResult {
        tool_use_id: "w1".into(),
        content: "ok".into(),
        is_error: false,
        stop_loop: false,
    }];
    let ok2 = vec![ToolCallResult {
        tool_use_id: "w2".into(),
        content: "ok".into(),
        is_error: false,
        stop_loop: false,
    }];
    let mut sig = None;
    let mut streak = 0usize;

    detect_same_target_stall(&calls1, &ok, &mut sig, &mut streak);
    assert_eq!(streak, 0);
    detect_same_target_stall(&calls2, &ok2, &mut sig, &mut streak);
    assert_eq!(streak, 0, "different content should not increment streak");
}

#[test]
fn test_detect_same_target_stall_no_writes_resets() {
    let calls_write = vec![ToolCall {
        id: "e1".into(),
        name: "edit_file".into(),
        input: serde_json::json!({"path": "a.rs", "old_text": "x", "new_text": "y"}),
    }];
    let fail = vec![ToolCallResult {
        tool_use_id: "e1".into(),
        content: "failed".into(),
        is_error: true,
        stop_loop: false,
    }];
    let mut sig = None;
    let mut streak = 0usize;
    detect_same_target_stall(&calls_write, &fail, &mut sig, &mut streak);
    assert_eq!(streak, 1);

    let calls_read = vec![ToolCall {
        id: "r1".into(),
        name: "read_file".into(),
        input: serde_json::json!({"path": "b.rs"}),
    }];
    let ok = vec![ToolCallResult {
        tool_use_id: "r1".into(),
        content: "data".into(),
        is_error: false,
        stop_loop: false,
    }];
    detect_same_target_stall(&calls_read, &ok, &mut sig, &mut streak);
    assert_eq!(streak, 0, "non-write/edit calls should reset streak");
}

#[test]
fn test_detect_same_target_stall_mixed_write_edit_same_batch() {
    let calls = vec![
        ToolCall {
            id: "w1".into(),
            name: "write_file".into(),
            input: serde_json::json!({"path": "a.rs", "content": "x"}),
        },
        ToolCall {
            id: "e1".into(),
            name: "edit_file".into(),
            input: serde_json::json!({"path": "a.rs", "old_text": "a", "new_text": "b"}),
        },
    ];
    let results = vec![
        ToolCallResult {
            tool_use_id: "w1".into(),
            content: "failed".into(),
            is_error: true,
            stop_loop: false,
        },
        ToolCallResult {
            tool_use_id: "e1".into(),
            content: "ok".into(),
            is_error: false,
            stop_loop: false,
        },
    ];
    let mut sig = None;
    let mut streak = 0usize;

    let stalled = detect_same_target_stall(&calls, &results, &mut sig, &mut streak);
    assert!(!stalled);
    assert_eq!(
        streak, 0,
        "successful edit in mixed batch should reset streak"
    );
}
