use super::*;

#[tokio::test]
async fn test_tool_loop_simple_end_turn() {
    let mock = Arc::new(MockLlmProvider::with_responses(vec![
        MockResponse::text("Done!").with_tokens(100, 50),
    ]));

    let (llm, _tmp) = testutil::make_test_llm(mock).await;
    let (event_tx, _event_rx) = mpsc::unbounded_channel();
    let executor = noop_executor();
    let config = default_config(5);

    let result = run_tool_loop(ToolLoopInput {
        llm,
        api_key: "test-key",
        system_prompt: "You are a test assistant.",
        initial_messages: vec![RichMessage::user("Say done")],
        tools: Arc::from(Vec::<ToolDefinition>::new()),
        config: &config,
        executor: &executor,
        event_tx: &event_tx,
    })
    .await;

    assert_eq!(result.text, "Done!");
    assert_eq!(result.iterations_run, 1);
    assert!(!result.timed_out);
    assert!(!result.insufficient_credits);
}

#[tokio::test]
async fn test_tool_loop_tool_use_then_end_turn() {
    let mock = Arc::new(MockLlmProvider::with_responses(vec![
        MockResponse::tool_use(vec![ToolCall {
            id: "t1".into(),
            name: "read_file".into(),
            input: serde_json::json!({"path": "src/main.rs"}),
        }])
        .with_tokens(100, 50),
        MockResponse::text("File contents shown.").with_tokens(80, 40),
    ]));

    let (llm, _tmp) = testutil::make_test_llm(mock).await;
    let (event_tx, _event_rx) = mpsc::unbounded_channel();
    let config = default_config(5);

    let executor = SimpleExecutor {
        handler: Box::new(|calls| {
            calls
                .iter()
                .map(|tc| ToolCallResult {
                    tool_use_id: tc.id.clone(),
                    content: "fn main() {}".into(),
                    is_error: false,
                    stop_loop: false,
                })
                .collect()
        }),
    };

    let result = run_tool_loop(ToolLoopInput {
        llm,
        api_key: "test-key",
        system_prompt: "You are a test assistant.",
        initial_messages: vec![RichMessage::user("Read the file")],
        tools: Arc::from(Vec::<ToolDefinition>::new()),
        config: &config,
        executor: &executor,
        event_tx: &event_tx,
    })
    .await;

    assert_eq!(result.iterations_run, 2);
    assert!(result.text.contains("File contents shown."));
    assert_eq!(result.total_input_tokens, 180);
    assert_eq!(result.total_output_tokens, 90);
    assert!(!result.timed_out);
}

#[tokio::test]
async fn test_tool_loop_hits_max_iterations() {
    let responses: Vec<MockResponse> = (0..10)
        .map(|i| {
            MockResponse::tool_use(vec![ToolCall {
                id: format!("t{}", i),
                name: "do_thing".into(),
                input: serde_json::json!({"step": i}),
            }])
            .with_tokens(50, 30)
        })
        .collect();

    let mock = Arc::new(MockLlmProvider::with_responses(responses));
    let (llm, _tmp) = testutil::make_test_llm(mock).await;
    let (event_tx, _event_rx) = mpsc::unbounded_channel();
    let config = default_config(3);

    let executor = SimpleExecutor {
        handler: Box::new(|calls| {
            calls
                .iter()
                .map(|tc| ToolCallResult {
                    tool_use_id: tc.id.clone(),
                    content: "ok".into(),
                    is_error: false,
                    stop_loop: false,
                })
                .collect()
        }),
    };

    let result = run_tool_loop(ToolLoopInput {
        llm,
        api_key: "test-key",
        system_prompt: "You are a test assistant.",
        initial_messages: vec![RichMessage::user("Do many things")],
        tools: Arc::from(Vec::<ToolDefinition>::new()),
        config: &config,
        executor: &executor,
        event_tx: &event_tx,
    })
    .await;

    assert_eq!(result.iterations_run, 3);
    assert!(!result.timed_out);
}

#[tokio::test]
async fn test_stop_loop_flag_exits_after_first_iteration() {
    let mock = Arc::new(MockLlmProvider::with_responses(vec![
        MockResponse::tool_use(vec![ToolCall {
            id: "t1".into(),
            name: "task_done".into(),
            input: serde_json::json!({"result": "finished"}),
        }])
        .with_tokens(100, 50),
        MockResponse::text("Should not be reached").with_tokens(50, 50),
    ]));

    let (llm, _tmp) = testutil::make_test_llm(mock).await;
    let (event_tx, _event_rx) = mpsc::unbounded_channel();
    let config = default_config(10);

    let executor = SimpleExecutor {
        handler: Box::new(|calls| {
            calls
                .iter()
                .map(|tc| ToolCallResult {
                    tool_use_id: tc.id.clone(),
                    content: "done".into(),
                    is_error: false,
                    stop_loop: true,
                })
                .collect()
        }),
    };

    let result = run_tool_loop(ToolLoopInput {
        llm, api_key: "test-key", system_prompt: "test",
        initial_messages: vec![RichMessage::user("Do it")],
        tools: Arc::from(Vec::<ToolDefinition>::new()), config: &config,
        executor: &executor, event_tx: &event_tx,
    }).await;

    assert_eq!(result.iterations_run, 1);
    assert!(!result.timed_out);
}

#[tokio::test]
async fn test_multiple_tool_calls_in_single_iteration() {
    let mock = Arc::new(MockLlmProvider::with_responses(vec![
        MockResponse::tool_use(vec![
            ToolCall { id: "t1".into(), name: "read_file".into(), input: serde_json::json!({"path": "a.rs"}) },
            ToolCall { id: "t2".into(), name: "read_file".into(), input: serde_json::json!({"path": "b.rs"}) },
            ToolCall { id: "t3".into(), name: "read_file".into(), input: serde_json::json!({"path": "c.rs"}) },
        ]).with_tokens(100, 80),
        MockResponse::text("All three read.").with_tokens(80, 40),
    ]));

    let (llm, _tmp) = testutil::make_test_llm(mock).await;
    let (event_tx, mut event_rx) = mpsc::unbounded_channel();
    let config = default_config(5);

    let executor = SimpleExecutor {
        handler: Box::new(|calls| {
            calls.iter().map(|tc| ToolCallResult {
                tool_use_id: tc.id.clone(),
                content: format!("content of {}", tc.input["path"].as_str().unwrap_or("")),
                is_error: false,
                stop_loop: false,
            }).collect()
        }),
    };

    let result = run_tool_loop(ToolLoopInput {
        llm, api_key: "test-key", system_prompt: "test",
        initial_messages: vec![RichMessage::user("Read three files")],
        tools: Arc::from(Vec::<ToolDefinition>::new()), config: &config,
        executor: &executor, event_tx: &event_tx,
    }).await;

    assert_eq!(result.iterations_run, 2);

    let mut tool_result_count = 0;
    while let Ok(evt) = event_rx.try_recv() {
        if matches!(evt, ToolLoopEvent::ToolResult { .. }) {
            tool_result_count += 1;
        }
    }
    assert_eq!(tool_result_count, 3, "should have 3 tool results from the batch");
}

#[tokio::test]
async fn test_text_accumulation_across_iterations() {
    let mock = Arc::new(MockLlmProvider::with_responses(vec![{
        let mut r = MockResponse::tool_use(vec![ToolCall {
            id: "t1".into(),
            name: "do_thing".into(),
            input: serde_json::json!({}),
        }]);
        r.text = "First part".into();
        r.input_tokens = 50;
        r.output_tokens = 30;
        r
    }, MockResponse::text("Second part").with_tokens(50, 30)]));

    let (llm, _tmp) = testutil::make_test_llm(mock).await;
    let (event_tx, _) = mpsc::unbounded_channel();
    let config = default_config(5);
    let executor = ok_executor();

    let result = run_tool_loop(ToolLoopInput {
        llm, api_key: "test-key", system_prompt: "test",
        initial_messages: vec![RichMessage::user("go")],
        tools: Arc::from(Vec::<ToolDefinition>::new()), config: &config,
        executor: &executor, event_tx: &event_tx,
    }).await;

    assert!(result.text.contains("First part"));
    assert!(result.text.contains("Second part"));
}

#[tokio::test]
async fn test_empty_tool_call_list_with_tool_use_stop_reason() {
    let mut resp = MockResponse::tool_use(vec![]);
    resp.stop_reason = "tool_use".into();
    resp.input_tokens = 100;
    resp.output_tokens = 50;

    let mock = Arc::new(MockLlmProvider::with_responses(vec![resp]));
    let (llm, _tmp) = testutil::make_test_llm(mock).await;
    let (event_tx, _) = mpsc::unbounded_channel();
    let config = default_config(5);
    let executor = noop_executor();

    let result = run_tool_loop(ToolLoopInput {
        llm, api_key: "test-key", system_prompt: "test",
        initial_messages: vec![RichMessage::user("go")],
        tools: Arc::from(Vec::<ToolDefinition>::new()), config: &config,
        executor: &executor, event_tx: &event_tx,
    }).await;

    assert_eq!(result.iterations_run, 1);
    assert!(!result.timed_out);
}

#[tokio::test]
async fn test_max_tokens_truncation_handling() {
    let mut resp = MockResponse::tool_use(vec![ToolCall {
        id: "t1".into(),
        name: "write_file".into(),
        input: serde_json::json!({"path": "out.rs", "content": "fn main() {}"}),
    }]);
    resp.stop_reason = "max_tokens".into();
    resp.input_tokens = 100;
    resp.output_tokens = 50;

    let mock = Arc::new(MockLlmProvider::with_responses(vec![
        resp,
        MockResponse::text("Done after truncation").with_tokens(80, 40),
    ]));

    let (llm, _tmp) = testutil::make_test_llm(mock).await;
    let (event_tx, mut event_rx) = mpsc::unbounded_channel();
    let config = default_config(5);
    let executor = noop_executor();

    let result = run_tool_loop(ToolLoopInput {
        llm, api_key: "test-key", system_prompt: "test",
        initial_messages: vec![RichMessage::user("write")],
        tools: Arc::from(Vec::<ToolDefinition>::new()), config: &config,
        executor: &executor, event_tx: &event_tx,
    }).await;

    assert_eq!(result.iterations_run, 2);

    let mut found_truncation_error = false;
    while let Ok(evt) = event_rx.try_recv() {
        if let ToolLoopEvent::ToolResult { content, is_error, .. } = evt {
            if is_error && content.contains("truncated") {
                found_truncation_error = true;
            }
        }
    }
    assert!(found_truncation_error, "should emit truncation error for tool calls with max_tokens");
}

#[tokio::test]
async fn test_zero_iterations_config() {
    let mock = Arc::new(MockLlmProvider::with_responses(vec![
        MockResponse::text("Should not run").with_tokens(100, 50),
    ]));

    let (llm, _tmp) = testutil::make_test_llm(mock).await;
    let (event_tx, _) = mpsc::unbounded_channel();
    let config = default_config(0);
    let executor = noop_executor();

    let result = run_tool_loop(ToolLoopInput {
        llm, api_key: "test-key", system_prompt: "test",
        initial_messages: vec![RichMessage::user("go")],
        tools: Arc::from(Vec::<ToolDefinition>::new()), config: &config,
        executor: &executor, event_tx: &event_tx,
    }).await;

    assert_eq!(result.iterations_run, 0);
}

#[tokio::test]
async fn test_event_emission_delta_tool_use_tool_result_token_usage() {
    let mock = Arc::new(MockLlmProvider::with_responses(vec![
        MockResponse::tool_use(vec![ToolCall {
            id: "t1".into(),
            name: "read_file".into(),
            input: serde_json::json!({"path": "a.rs"}),
        }]).with_tokens(100, 50),
        MockResponse::text("Done").with_tokens(80, 40),
    ]));

    let (llm, _tmp) = testutil::make_test_llm(mock).await;
    let (event_tx, mut event_rx) = mpsc::unbounded_channel();
    let config = default_config(5);
    let executor = SimpleExecutor {
        handler: Box::new(|calls| {
            calls.iter().map(|tc| ToolCallResult {
                tool_use_id: tc.id.clone(),
                content: "fn main() {}".into(),
                is_error: false,
                stop_loop: false,
            }).collect()
        }),
    };

    let _result = run_tool_loop(ToolLoopInput {
        llm, api_key: "test-key", system_prompt: "test",
        initial_messages: vec![RichMessage::user("read")],
        tools: Arc::from(Vec::<ToolDefinition>::new()), config: &config,
        executor: &executor, event_tx: &event_tx,
    }).await;

    let mut has_delta = false;
    let mut has_tool_use = false;
    let mut has_tool_result = false;
    let mut has_token_usage = false;

    while let Ok(evt) = event_rx.try_recv() {
        match evt {
            ToolLoopEvent::Delta(_) => has_delta = true,
            ToolLoopEvent::ToolUseDetected { .. } => has_tool_use = true,
            ToolLoopEvent::ToolResult { .. } => has_tool_result = true,
            ToolLoopEvent::IterationTokenUsage { .. } => has_token_usage = true,
            _ => {}
        }
    }

    assert!(has_delta, "should emit Delta event for 'Done' text");
    assert!(has_tool_use, "should emit ToolUseDetected");
    assert!(has_tool_result, "should emit ToolResult");
    assert!(has_token_usage, "should emit IterationTokenUsage");
}
