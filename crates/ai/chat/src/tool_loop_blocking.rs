use std::collections::HashMap;

use tokio::sync::mpsc;
use tracing::{info, warn};

use aura_claude::{ContentBlock, RichMessage, ToolCall};
use crate::compaction;
use crate::channel_ext::send_or_log;
use crate::constants::{MAX_WRITE_FAILURES_PER_FILE, MAX_READS_PER_FILE, MAX_CONSECUTIVE_CMD_FAILURES, CMD_FAILURE_WARNING_THRESHOLD};
use crate::tool_loop_types::{ToolCallResult, ToolExecutor, ToolLoopEvent};
use crate::tool_loop_budget::ExplorationState;

// ---------------------------------------------------------------------------
// Write-tracking state
// ---------------------------------------------------------------------------

pub(crate) struct WriteTrackingState {
    pub(crate) consecutive_write_tracker: HashMap<String, usize>,
    pub(crate) file_write_failures: HashMap<String, usize>,
    pub(crate) cooldowns: HashMap<String, usize>,
    pub(crate) last_target_signature: Option<String>,
    pub(crate) no_progress_streak: usize,
}

// ---------------------------------------------------------------------------
// Low-level detection helpers
// ---------------------------------------------------------------------------

pub(crate) fn detect_blocked_writes(
    tool_calls: &[ToolCall],
    tracker: &mut HashMap<String, usize>,
) -> Vec<usize> {
    let write_paths: Vec<Option<String>> = tool_calls
        .iter()
        .map(|tc| {
            if tc.name == "write_file" {
                tc.input.get("path").and_then(|v| v.as_str()).map(String::from)
            } else {
                None
            }
        })
        .collect();

    if write_paths.iter().any(|p| p.is_none()) {
        tracker.clear();
    }
    for path in write_paths.iter().flatten() {
        *tracker.entry(path.clone()).or_insert(0) += 1;
    }

    tool_calls
        .iter()
        .enumerate()
        .filter_map(|(i, tc)| {
            if tc.name == "write_file" {
                let path = tc.input.get("path").and_then(|v| v.as_str()).unwrap_or("");
                if tracker.get(path).copied().unwrap_or(0) >= 2 {
                    return Some(i);
                }
            }
            None
        })
        .collect()
}

/// Block write/edit calls on files that have accumulated 3+ failures across
/// the session (unlike `detect_blocked_writes` which tracks consecutive batches,
/// this tracks total error outcomes per file and is only reset on success).
pub(crate) fn detect_blocked_write_failures(
    tool_calls: &[ToolCall],
    file_write_failures: &HashMap<String, usize>,
) -> Vec<usize> {
    tool_calls
        .iter()
        .enumerate()
        .filter_map(|(i, tc)| {
            if matches!(tc.name.as_str(), "write_file" | "edit_file") {
                let path = tc.input.get("path").and_then(|v| v.as_str()).unwrap_or("");
                if file_write_failures.get(path).copied().unwrap_or(0) >= MAX_WRITE_FAILURES_PER_FILE {
                    return Some(i);
                }
            }
            None
        })
        .collect()
}

/// Block `read_file` calls when the same file has been read 3+ times total
/// (any combination of full/partial reads).
pub(crate) fn detect_blocked_reads(
    tool_calls: &[ToolCall],
    file_read_counts: &mut HashMap<String, usize>,
) -> Vec<usize> {
    for tc in tool_calls {
        if tc.name == "read_file" {
            if let Some(path) = tc.input.get("path").and_then(|v| v.as_str()) {
                *file_read_counts.entry(path.to_string()).or_insert(0) += 1;
            }
        }
    }

    tool_calls
        .iter()
        .enumerate()
        .filter_map(|(i, tc)| {
            if tc.name == "read_file" {
                let path = tc.input.get("path").and_then(|v| v.as_str()).unwrap_or("");
                if file_read_counts.get(path).copied().unwrap_or(0) >= MAX_READS_PER_FILE {
                    return Some(i);
                }
            }
            None
        })
        .collect()
}

/// Block all exploration tool calls when the hard limit has been reached.
pub(crate) fn detect_blocked_exploration(
    tool_calls: &[ToolCall],
    blocked: bool,
) -> Vec<usize> {
    if !blocked {
        return vec![];
    }
    tool_calls
        .iter()
        .enumerate()
        .filter_map(|(i, tc)| {
            if matches!(tc.name.as_str(), "read_file" | "search_code" | "find_files" | "list_files") {
                Some(i)
            } else {
                None
            }
        })
        .collect()
}

/// Block `run_command` calls when consecutive failures reach the hard limit (5+).
pub(crate) fn detect_blocked_commands(tool_calls: &[ToolCall], consecutive_failures: usize) -> Vec<usize> {
    if consecutive_failures < MAX_CONSECUTIVE_CMD_FAILURES {
        return vec![];
    }
    tool_calls
        .iter()
        .enumerate()
        .filter_map(|(i, tc)| {
            if tc.name == "run_command" {
                Some(i)
            } else {
                None
            }
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Cooldown management
// ---------------------------------------------------------------------------

pub(crate) fn detect_write_file_cooldowns(
    tool_calls: &[ToolCall],
    cooldowns: &HashMap<String, usize>,
) -> Vec<usize> {
    tool_calls
        .iter()
        .enumerate()
        .filter_map(|(i, tc)| {
            if tc.name != "write_file" {
                return None;
            }
            let path = tc.input.get("path").and_then(|v| v.as_str()).unwrap_or("");
            if cooldowns.get(path).copied().unwrap_or(0) > 0 {
                Some(i)
            } else {
                None
            }
        })
        .collect()
}

pub(crate) fn collect_duplicate_write_paths(tool_calls: &[ToolCall], blocked_indices: &[usize]) -> Vec<String> {
    let mut paths: Vec<String> = Vec::new();
    for i in blocked_indices {
        if let Some(tc) = tool_calls.get(*i) {
            if tc.name == "write_file" {
                if let Some(path) = tc.input.get("path").and_then(|v| v.as_str()) {
                    if !paths.contains(&path.to_string()) {
                        paths.push(path.to_string());
                    }
                }
            }
        }
    }
    paths
}

pub(crate) fn decrement_write_file_cooldowns(cooldowns: &mut HashMap<String, usize>) {
    cooldowns.retain(|_, remaining| {
        if *remaining == 0 {
            return false;
        }
        *remaining -= 1;
        *remaining > 0
    });
}

// ---------------------------------------------------------------------------
// Combined blocking orchestration
// ---------------------------------------------------------------------------

pub(crate) struct BlockedSets {
    pub(crate) duplicate_write: Vec<usize>,
    pub(crate) write_fail: Vec<usize>,
    pub(crate) cooldown: Vec<usize>,
    pub(crate) cmd: Vec<usize>,
    pub(crate) read: Vec<usize>,
    pub(crate) exploration: Vec<usize>,
}

/// Combined blocking state needed by `detect_all_blocked`.
pub(crate) struct BlockingContext<'a> {
    pub(crate) consecutive_write_tracker: &'a mut HashMap<String, usize>,
    pub(crate) cooldowns: &'a mut HashMap<String, usize>,
    pub(crate) file_write_failures: &'a HashMap<String, usize>,
    pub(crate) consecutive_cmd_failures: usize,
    pub(crate) file_read_counts: &'a mut HashMap<String, usize>,
    pub(crate) exploration: &'a ExplorationState,
}

pub(crate) fn detect_all_blocked(
    tool_calls: &[ToolCall],
    ctx: &mut BlockingContext<'_>,
) -> (Vec<usize>, BlockedSets, Vec<String>) {
    const FULL_REWRITE_BLOCK_ITERS: usize = 3;

    let duplicate_write = detect_blocked_writes(tool_calls, ctx.consecutive_write_tracker);
    let cooldown = detect_write_file_cooldowns(tool_calls, ctx.cooldowns);
    let write_fail = detect_blocked_write_failures(tool_calls, ctx.file_write_failures);
    let cmd = detect_blocked_commands(tool_calls, ctx.consecutive_cmd_failures);
    let read = detect_blocked_reads(tool_calls, ctx.file_read_counts);
    let exploration_is_blocked = ctx.exploration.total_calls >= ctx.exploration.allowance;
    let exploration = detect_blocked_exploration(tool_calls, exploration_is_blocked);

    let all_blocked: Vec<usize> = {
        let mut v = duplicate_write.clone();
        for i in write_fail.iter()
            .chain(cooldown.iter())
            .chain(cmd.iter())
            .chain(read.iter())
            .chain(exploration.iter())
        {
            if !v.contains(i) {
                v.push(*i);
            }
        }
        v
    };

    let duplicate_paths = collect_duplicate_write_paths(tool_calls, &duplicate_write);
    let mut deferred_recovery_msgs: Vec<String> = Vec::new();
    for path in &duplicate_paths {
        ctx.cooldowns.insert(path.clone(), FULL_REWRITE_BLOCK_ITERS);
        let recovery = format!(
            "[STALL RECOVERY] Repeated full-file write_file attempts detected for '{path}'. \
             For the next {FULL_REWRITE_BLOCK_ITERS} iterations, write_file is blocked for this path. \
             Use edit_file instead: (1) read_file with a line range, (2) edit_file for one small \
             section/function at a time, (3) verify before the next edit. Do NOT rewrite the full file."
        );
        info!(path = path.as_str(), "Injecting adaptive rewrite recovery instruction");
        deferred_recovery_msgs.push(recovery);
    }

    let sets = BlockedSets { duplicate_write, write_fail, cooldown, cmd, read, exploration };
    (all_blocked, sets, deferred_recovery_msgs)
}

// ---------------------------------------------------------------------------
// Blocked result generation
// ---------------------------------------------------------------------------

enum BlockReason<'a> {
    DuplicateWrite { path: &'a str },
    WriteFail { path: &'a str, count: usize },
    Cooldown { path: &'a str, remaining: usize },
    CommandBlocked { consecutive_failures: usize },
    ReadBlocked { path: &'a str, count: usize },
    ExplorationBlocked { total_calls: usize },
}

/// State needed to classify and generate blocked results.
pub(crate) struct BlockedResultContext<'a> {
    pub(crate) file_write_failures: &'a HashMap<String, usize>,
    pub(crate) cooldowns: &'a HashMap<String, usize>,
    pub(crate) consecutive_cmd_failures: usize,
    pub(crate) file_read_counts: &'a HashMap<String, usize>,
    pub(crate) exploration_total_calls: usize,
}

fn classify_block<'a>(
    index: usize,
    tc: &'a ToolCall,
    sets: &BlockedSets,
    ctx: &BlockedResultContext<'_>,
) -> Option<BlockReason<'a>> {
    let path = || tc.input.get("path").and_then(|v| v.as_str()).unwrap_or("unknown");

    if sets.duplicate_write.contains(&index) {
        Some(BlockReason::DuplicateWrite { path: path() })
    } else if sets.write_fail.contains(&index) {
        Some(BlockReason::WriteFail { path: path(), count: ctx.file_write_failures.get(path()).copied().unwrap_or(0) })
    } else if sets.cooldown.contains(&index) {
        Some(BlockReason::Cooldown { path: path(), remaining: ctx.cooldowns.get(path()).copied().unwrap_or(0) })
    } else if sets.cmd.contains(&index) {
        Some(BlockReason::CommandBlocked { consecutive_failures: ctx.consecutive_cmd_failures })
    } else if sets.read.contains(&index) {
        Some(BlockReason::ReadBlocked { path: path(), count: ctx.file_read_counts.get(path()).copied().unwrap_or(0) })
    } else if sets.exploration.contains(&index) {
        Some(BlockReason::ExplorationBlocked { total_calls: ctx.exploration_total_calls })
    } else {
        None
    }
}

pub(crate) fn build_blocked_result(
    index: usize,
    tc: &ToolCall,
    sets: &BlockedSets,
    ctx: &BlockedResultContext<'_>,
) -> Option<ToolCallResult> {
    let reason = classify_block(index, tc, sets, ctx)?;

    let content = match reason {
        BlockReason::DuplicateWrite { path } => {
            warn!(path, tool = %tc.name, "Blocked consecutive duplicate write/edit (2+ in a row)");
            serde_json::json!({
                "error": format!(
                    "You have called {} on '{}' repeatedly without success. \
                     Your output is likely being truncated due to context pressure. \
                     Break the file into smaller writes: write a skeleton first with \
                     function signatures, then use edit_file to fill in one function \
                     body at a time.",
                    tc.name, path
                )
            }).to_string()
        }
        BlockReason::WriteFail { path, count } => {
            warn!(path, count, tool = %tc.name, "Blocked write after repeated failures");
            format!(
                "Writes to '{path}' blocked after {count} failures. STOP trying to write this file. \
                 Run `git checkout -- {path}` to restore it, then read_file to see the recovered content, \
                 and try a fundamentally different approach with small targeted edits."
            )
        }
        BlockReason::Cooldown { path, remaining } => {
            warn!(path, remaining, "Blocked write_file during adaptive cooldown");
            format!(
                "write_file on '{path}' is temporarily blocked for {remaining} more iterations \
                 due to repeated rewrite stalls. Use edit_file with small, targeted chunks instead \
                 of rewriting the full file."
            )
        }
        BlockReason::CommandBlocked { consecutive_failures } => {
            warn!(tool = %tc.name, consecutive_failures,
                "Blocked run_command after 5+ consecutive failures");
            "run_command is temporarily blocked after 5+ consecutive failures. \
             Use search_code, read_file, find_files, or list_files instead. \
             run_command will be unblocked after you successfully use another tool."
                .to_string()
        }
        BlockReason::ReadBlocked { path, count } => {
            warn!(path, count, "Blocked fragmented re-read of same file");
            format!(
                "BLOCKED: You have read '{}' {} times. Use the content you already have. \
                 If you need a specific section, use search_code to find the exact lines.",
                path, count
            )
        }
        BlockReason::ExplorationBlocked { total_calls } => {
            warn!(tool = %tc.name, total_calls, "Blocked exploration call (hard limit reached)");
            format!(
                "Exploration blocked after {} calls. Use the context you have and start \
                 implementing. Reads will unblock after you use write_file or edit_file.",
                total_calls
            )
        }
    };

    Some(ToolCallResult {
        tool_use_id: tc.id.clone(),
        content,
        is_error: true,
        stop_loop: false,
    })
}

pub(crate) async fn execute_with_blocked(
    tool_calls: &[ToolCall],
    executor: &dyn ToolExecutor,
    all_blocked: &[usize],
    sets: &BlockedSets,
    ctx: &BlockedResultContext<'_>,
) -> Vec<ToolCallResult> {
    let allowed_calls: Vec<ToolCall> = tool_calls
        .iter()
        .enumerate()
        .filter(|(i, _)| !all_blocked.contains(i))
        .map(|(_, tc)| tc.clone())
        .collect();
    let allowed_results = executor.execute(&allowed_calls).await;

    let mut allowed_iter = allowed_results.into_iter();
    tool_calls
        .iter()
        .enumerate()
        .map(|(i, tc)| {
            if let Some(blocked) = build_blocked_result(i, tc, sets, ctx) {
                blocked
            } else {
                allowed_iter.next().unwrap_or_else(|| ToolCallResult {
                    tool_use_id: tc.id.clone(),
                    content: "internal error: result count mismatch".to_string(),
                    is_error: true,
                    stop_loop: false,
                })
            }
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Write failure tracking
// ---------------------------------------------------------------------------

pub(crate) fn track_write_failures(
    tool_calls: &[ToolCall],
    results: &[ToolCallResult],
    file_write_failures: &mut HashMap<String, usize>,
) {
    for (tc, result) in tool_calls.iter().zip(results.iter()) {
        if matches!(tc.name.as_str(), "write_file" | "edit_file") {
            if let Some(path) = tc.input.get("path").and_then(|v| v.as_str()) {
                if result.is_error {
                    *file_write_failures.entry(path.to_string()).or_insert(0) += 1;
                } else {
                    file_write_failures.remove(path);
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Stall detection
// ---------------------------------------------------------------------------

pub(crate) fn detect_stall_fail_fast(
    tool_calls: &[ToolCall],
    results: &[ToolCallResult],
    writes: &mut WriteTrackingState,
    streak_threshold: usize,
    event_tx: &mpsc::UnboundedSender<ToolLoopEvent>,
    api_messages: &mut Vec<RichMessage>,
) -> bool {
    let fail_fast_stall = detect_same_target_stall(
        tool_calls,
        results,
        &mut writes.last_target_signature,
        &mut writes.no_progress_streak,
    );
    if fail_fast_stall && writes.no_progress_streak >= streak_threshold {
        let recovery = format!(
            "[STALL FAIL-FAST] Repeated write/edit attempts are targeting the same file set \
             without successful progress for {} iterations. Stop this loop now and restart with \
             a recovery strategy: (1) read a narrow line range, (2) apply a single small edit_file \
             change, (3) verify, then continue incrementally.",
            writes.no_progress_streak
        );
        warn!(
            streak = writes.no_progress_streak,
            "Fail-fast triggered due to same-target no-progress stall"
        );
        send_or_log(&event_tx, ToolLoopEvent::Error(recovery.clone()));
        api_messages.push(RichMessage::user(&recovery));
        return true;
    }
    false
}

pub(crate) fn detect_same_target_stall(
    tool_calls: &[ToolCall],
    results: &[ToolCallResult],
    last_signature: &mut Option<String>,
    no_progress_streak: &mut usize,
) -> bool {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut write_paths: Vec<String> = Vec::new();
    let mut had_write_success = false;
    let mut had_edit_success = false;
    let mut content_hasher = DefaultHasher::new();

    for (tc, result) in tool_calls.iter().zip(results.iter()) {
        if matches!(tc.name.as_str(), "write_file" | "edit_file") {
            if let Some(path) = tc.input.get("path").and_then(|v| v.as_str()) {
                write_paths.push(path.to_string());
            }
            if !result.is_error {
                if tc.name == "edit_file" {
                    had_edit_success = true;
                }
                had_write_success = true;
            }
            if let Some(c) = tc.input.get("content").and_then(|v| v.as_str()) {
                c.hash(&mut content_hasher);
            }
            if let Some(c) = tc.input.get("new_text").and_then(|v| v.as_str()) {
                c.hash(&mut content_hasher);
            }
        }
    }

    if write_paths.is_empty() {
        *last_signature = None;
        *no_progress_streak = 0;
        return false;
    }

    // Successful edit_file calls always represent forward progress (appending
    // new code sections, patching different spots), so reset the streak.
    // Only successful write_file to different content also resets.
    if had_edit_success {
        *last_signature = None;
        *no_progress_streak = 0;
        return false;
    }

    // Any successful write_file with different content = progress
    if had_write_success {
        write_paths.sort();
        write_paths.dedup();
        let content_hash = content_hasher.finish();
        let signature = format!("{}#{:x}", write_paths.join("|"), content_hash);
        if last_signature.as_deref() != Some(signature.as_str()) {
            *last_signature = Some(signature);
            *no_progress_streak = 0;
            return false;
        }
    }

    // All writes failed, or successful but identical content = no progress
    write_paths.sort();
    write_paths.dedup();
    let content_hash = content_hasher.finish();
    let signature = format!("{}#{:x}", write_paths.join("|"), content_hash);

    if last_signature.as_deref() == Some(signature.as_str()) {
        *no_progress_streak += 1;
    } else {
        *last_signature = Some(signature);
        *no_progress_streak = 1;
    }

    *no_progress_streak >= 3
}

// ---------------------------------------------------------------------------
// Command failure tracking
// ---------------------------------------------------------------------------

/// Update the consecutive failure counter and append hints to results.
/// Resets on any successful tool call; increments on `run_command` errors.
/// At 3+ consecutive failures, appends guidance to use built-in tools.
pub(crate) fn apply_cmd_failure_tracking(
    tool_calls: &[ToolCall],
    mut results: Vec<ToolCallResult>,
    consecutive_failures: &mut usize,
) -> Vec<ToolCallResult> {
    for (tc, result) in tool_calls.iter().zip(results.iter_mut()) {
        if tc.name == "run_command" && result.is_error {
            *consecutive_failures += 1;
            if *consecutive_failures >= CMD_FAILURE_WARNING_THRESHOLD {
                result.content.push_str(&format!(
                    "\n\n[WARNING: {} consecutive run_command failures. \
                     Use search_code, read_file, find_files, or list_files instead \
                     of shell commands for code exploration.]",
                    *consecutive_failures,
                ));
            }
        } else if !result.is_error {
            *consecutive_failures = 0;
        }
    }
    results
}

// ---------------------------------------------------------------------------
// Tool result building
// ---------------------------------------------------------------------------

pub(crate) fn build_tool_result_blocks(
    tool_calls: &[ToolCall],
    results: &[ToolCallResult],
    file_read_cache: &mut HashMap<String, u64>,
    event_tx: &mpsc::UnboundedSender<ToolLoopEvent>,
) -> (Vec<ContentBlock>, bool) {
    let mut should_stop = false;
    let mut result_blocks: Vec<ContentBlock> = Vec::new();

    for (tc, result) in tool_calls.iter().zip(results) {
        send_or_log(&event_tx, ToolLoopEvent::ToolResult {
            tool_use_id: result.tool_use_id.clone(),
            tool_name: tc.name.clone(),
            content: result.content.clone(),
            is_error: result.is_error,
        });

        let write_truncation_warning = if (tc.name == "write_file" || tc.name == "edit_file")
            && !result.is_error
        {
            let written = tc.input.get("content").and_then(|v| v.as_str()).unwrap_or("");
            if looks_truncated(written) {
                Some(
                    "[WARNING: The file content appears to have been truncated during generation. \
                     Use read_file to check what was actually written. Consider breaking large \
                     files into smaller writes.]"
                )
            } else {
                None
            }
        } else {
            None
        };

        let content_for_llm = if tc.name == "read_file" && !result.is_error {
            let path = tc.input.get("path").and_then(|v| v.as_str()).unwrap_or("");
            let has_line_range = tc.input.get("start_line").is_some()
                || tc.input.get("end_line").is_some();

            if has_line_range {
                compaction::smart_compact(&tc.name, &result.content)
            } else {
                let hash = content_hash(&result.content);
                if let Some(&prev_hash) = file_read_cache.get(path) {
                    if prev_hash == hash {
                        format!(
                            "STOP: File already read with identical content ({} chars). \
                             Do NOT re-read the full file. Use read_file with start_line/end_line \
                             to read specific line ranges, or use the previously read content.",
                            result.content.len()
                        )
                    } else {
                        file_read_cache.insert(path.to_string(), hash);
                        compaction::smart_compact(&tc.name, &result.content)
                    }
                } else {
                    file_read_cache.insert(path.to_string(), hash);
                    compaction::smart_compact(&tc.name, &result.content)
                }
            }
        } else {
            if tc.name == "write_file" || tc.name == "edit_file" {
                if let Some(path) = tc.input.get("path").and_then(|v| v.as_str()) {
                    file_read_cache.remove(path);
                }
            }
            if result.is_error && tc.name == "run_command" {
                compaction::smart_compact_error(&tc.name, &result.content)
            } else {
                compaction::smart_compact(&tc.name, &result.content)
            }
        };

        let final_content = if let Some(warning) = write_truncation_warning {
            format!("{content_for_llm}\n\n{warning}")
        } else {
            content_for_llm
        };

        result_blocks.push(ContentBlock::ToolResult {
            tool_use_id: result.tool_use_id.clone(),
            content: final_content,
            is_error: if result.is_error { Some(true) } else { None },
        });
        if result.stop_loop {
            should_stop = true;
        }
    }

    (result_blocks, should_stop)
}

pub(crate) fn summarize_write_file_input(input: &serde_json::Value) -> serde_json::Value {
    let path = input.get("path").and_then(|v| v.as_str()).unwrap_or("unknown");
    let content = input.get("content").and_then(|v| v.as_str()).unwrap_or("");
    let content_len = content.len();
    let lines: Vec<&str> = content.lines().collect();
    let line_count = lines.len();

    const HEAD_LINES: usize = 20;
    const TAIL_LINES: usize = 5;

    let summary = if line_count <= HEAD_LINES + TAIL_LINES + 2 {
        content.to_string()
    } else {
        let head: Vec<&str> = lines[..HEAD_LINES].to_vec();
        let tail: Vec<&str> = lines[line_count - TAIL_LINES..].to_vec();
        format!(
            "{}\n\
             // [CONTEXT COMPACTED: {} lines omitted from this tool_use block to save tokens.\n\
             //  The FULL content ({} lines, {} chars) was successfully written to disk at '{}'.\n\
             //  This is NOT an error. Use read_file if you need to see the omitted lines.]\n\
             {}",
            head.join("\n"),
            line_count - HEAD_LINES - TAIL_LINES,
            line_count,
            content_len,
            path,
            tail.join("\n"),
        )
    };

    serde_json::json!({
        "path": path,
        "content": summary,
    })
}

/// Heuristic check for truncated file content: unbalanced braces/brackets
/// or content that ends mid-line without a newline.
pub(crate) fn looks_truncated(content: &str) -> bool {
    if content.len() < 200 {
        return false;
    }

    let mut brace_depth: i64 = 0;
    let mut bracket_depth: i64 = 0;
    let mut paren_depth: i64 = 0;
    for ch in content.chars() {
        match ch {
            '{' => brace_depth += 1,
            '}' => brace_depth -= 1,
            '[' => bracket_depth += 1,
            ']' => bracket_depth -= 1,
            '(' => paren_depth += 1,
            ')' => paren_depth -= 1,
            _ => {}
        }
    }

    let significantly_unbalanced =
        brace_depth.abs() > 2 || bracket_depth.abs() > 2 || paren_depth.abs() > 2;

    let ends_abruptly = !content.ends_with('\n')
        && !content.ends_with('}')
        && !content.ends_with(';')
        && !content.ends_with('\r');

    significantly_unbalanced || ends_abruptly
}

fn content_hash(content: &str) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in content.bytes() {
        h ^= b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h
}
