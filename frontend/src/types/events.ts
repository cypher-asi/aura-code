export type EngineEventType =
  | "loop_started"
  | "task_started"
  | "task_completed"
  | "task_failed"
  | "task_became_ready"
  | "task_output_delta"
  | "file_ops_applied"
  | "follow_up_task_created"
  | "session_rolled_over"
  | "loop_paused"
  | "loop_stopped"
  | "loop_finished"
  | "log_line"
  | "spec_gen_started"
  | "spec_gen_progress"
  | "spec_gen_completed"
  | "spec_gen_failed"
  | "spec_saved";

export interface EngineEvent {
  type: EngineEventType;
  task_id?: string;
  task_title?: string;
  delta?: string;
  reason?: string;
  old_session_id?: string;
  new_session_id?: string;
  completed_count?: number;
  outcome?: string;
  execution_notes?: string;
  files_written?: number;
  files_deleted?: number;
  message?: string;
  project_id?: string;
  agent_id?: string;
  stage?: string;
  spec_count?: number;
  spec?: import("./entities").Spec;
}
