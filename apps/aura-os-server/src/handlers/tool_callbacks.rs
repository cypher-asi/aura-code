use std::collections::HashMap;

use axum::extract::{Path, State};
use axum::Json;
use tracing::{info, warn};

use aura_os_core::{ProjectId, Spec, Task};
use aura_os_link::{InstalledTool, ToolAuth};

use crate::error::{map_storage_error, ApiError, ApiResult};
use crate::state::AppState;

#[allow(dead_code)]
fn callback_base_url() -> String {
    let port: u16 = std::env::var("AURA_SERVER_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(3100);
    let host = std::env::var("AURA_SERVER_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    format!("http://{}:{}", host, port)
}

#[allow(dead_code)]
fn tool(name: &str, description: &str, schema: serde_json::Value, endpoint: &str, token: Option<&str>) -> InstalledTool {
    InstalledTool {
        name: name.to_string(),
        description: description.to_string(),
        input_schema: schema,
        endpoint: endpoint.to_string(),
        auth: match token {
            Some(t) => ToolAuth::Bearer { token: t.to_string() },
            None => ToolAuth::None,
        },
        timeout_ms: Some(30_000),
        namespace: None,
        metadata: HashMap::new(),
    }
}

#[allow(dead_code)]
pub(crate) fn build_installed_tools(
    project_id: &str,
    token: Option<&str>,
) -> Vec<InstalledTool> {
    let base = callback_base_url();
    let p = format!("{}/api/tool-callbacks/{}", base, project_id);

    vec![
        tool(
            "get_project",
            "Get the current project's details (name, description, settings).",
            serde_json::json!({
                "type": "object",
                "properties": {},
                "required": []
            }),
            &format!("{}/get_project", p),
            token,
        ),
        tool(
            "update_project",
            "Update the current project's name or description.",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "name": { "type": "string", "description": "New project name" },
                    "description": { "type": "string", "description": "New project description" }
                }
            }),
            &format!("{}/update_project", p),
            token,
        ),
        tool(
            "create_spec",
            "Create a new spec (feature specification) in the project.",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "Spec title" },
                    "markdown_contents": { "type": "string", "description": "Spec body in markdown" },
                    "order_index": { "type": "integer", "description": "Display order" }
                },
                "required": ["title"]
            }),
            &format!("{}/create_spec", p),
            token,
        ),
        tool(
            "list_specs",
            "List all specs in the project.",
            serde_json::json!({
                "type": "object",
                "properties": {},
                "required": []
            }),
            &format!("{}/list_specs", p),
            token,
        ),
        tool(
            "get_spec",
            "Get a spec by its ID.",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "spec_id": { "type": "string", "description": "The spec ID to retrieve" }
                },
                "required": ["spec_id"]
            }),
            &format!("{}/get_spec", p),
            token,
        ),
        tool(
            "update_spec",
            "Update an existing spec's title or content.",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "spec_id": { "type": "string", "description": "The spec ID to update" },
                    "title": { "type": "string", "description": "New title" },
                    "markdown_contents": { "type": "string", "description": "New markdown body" }
                },
                "required": ["spec_id"]
            }),
            &format!("{}/update_spec", p),
            token,
        ),
        tool(
            "delete_spec",
            "Delete a spec by its ID.",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "spec_id": { "type": "string", "description": "The spec ID to delete" }
                },
                "required": ["spec_id"]
            }),
            &format!("{}/delete_spec", p),
            token,
        ),
        tool(
            "create_task",
            "Create a new task within a spec.",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "spec_id": { "type": "string", "description": "Parent spec ID" },
                    "title": { "type": "string", "description": "Task title" },
                    "description": { "type": "string", "description": "Task description" },
                    "status": { "type": "string", "description": "Initial status (pending, in_progress, done)" },
                    "order_index": { "type": "integer", "description": "Display order" }
                },
                "required": ["spec_id", "title"]
            }),
            &format!("{}/create_task", p),
            token,
        ),
        tool(
            "list_tasks",
            "List all tasks in the project.",
            serde_json::json!({
                "type": "object",
                "properties": {},
                "required": []
            }),
            &format!("{}/list_tasks", p),
            token,
        ),
        tool(
            "get_task",
            "Get a task by its ID.",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "task_id": { "type": "string", "description": "The task ID to retrieve" }
                },
                "required": ["task_id"]
            }),
            &format!("{}/get_task", p),
            token,
        ),
        tool(
            "delete_task",
            "Delete a task by its ID.",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "task_id": { "type": "string", "description": "The task ID to delete" }
                },
                "required": ["task_id"]
            }),
            &format!("{}/delete_task", p),
            token,
        ),
    ]
}

// ---------------------------------------------------------------------------
// Callback route handler
// ---------------------------------------------------------------------------

pub(crate) async fn handle_tool_callback(
    State(state): State<AppState>,
    Path((project_id, tool_name)): Path<(ProjectId, String)>,
    Json(input): Json<serde_json::Value>,
) -> ApiResult<Json<serde_json::Value>> {
    info!(%project_id, %tool_name, "Tool callback received");

    let storage = state.require_storage_client()?;
    let jwt = state.get_jwt()?;
    let pid = project_id.to_string();

    match tool_name.as_str() {
        "get_project" => {
            let project = get_project_for_callback(&state, &project_id).await?;
            Ok(Json(serde_json::to_value(&project).unwrap_or_default()))
        }

        "update_project" => {
            let name = input.get("name").and_then(|v| v.as_str());
            let desc = input.get("description").and_then(|v| v.as_str());
            if let Some(client) = &state.network_client {
                let req = aura_os_network::UpdateProjectRequest {
                    name: name.map(|s| s.to_string()),
                    description: desc.map(|s| s.to_string()),
                    folder: None,
                    git_repo_url: None,
                    git_branch: None,
                    orbit_base_url: None,
                    orbit_owner: None,
                    orbit_repo: None,
                };
                client
                    .update_project(&pid, &jwt, &req)
                    .await
                    .map_err(|e| ApiError::internal(format!("updating project: {e}")))?;
            }
            Ok(Json(serde_json::json!({ "ok": true })))
        }

        "create_spec" => {
            let title = input.get("title").and_then(|v| v.as_str()).unwrap_or("Untitled");
            let req = aura_os_storage::CreateSpecRequest {
                title: title.to_string(),
                org_id: None,
                order_index: input.get("order_index").and_then(|v| v.as_i64()).map(|v| v as i32),
                markdown_contents: input.get("markdown_contents").and_then(|v| v.as_str()).map(|s| s.to_string()),
            };
            let spec = storage
                .create_spec(&pid, &jwt, &req)
                .await
                .map_err(map_storage_error)?;
            let core_spec = Spec::try_from(spec)
                .map_err(|e| ApiError::internal(format!("converting spec: {e}")))?;
            Ok(Json(serde_json::to_value(&core_spec).unwrap_or_default()))
        }

        "list_specs" => {
            let specs = storage.list_specs(&pid, &jwt).await.map_err(map_storage_error)?;
            let core_specs: Vec<Spec> = specs.into_iter().filter_map(|s| Spec::try_from(s).ok()).collect();
            Ok(Json(serde_json::to_value(&core_specs).unwrap_or_default()))
        }

        "get_spec" => {
            let spec_id = input.get("spec_id").and_then(|v| v.as_str())
                .ok_or_else(|| ApiError::bad_request("spec_id is required"))?;
            let spec = storage.get_spec(spec_id, &jwt).await.map_err(map_storage_error)?;
            let core_spec = Spec::try_from(spec)
                .map_err(|e| ApiError::internal(format!("converting spec: {e}")))?;
            Ok(Json(serde_json::to_value(&core_spec).unwrap_or_default()))
        }

        "update_spec" => {
            let spec_id = input.get("spec_id").and_then(|v| v.as_str())
                .ok_or_else(|| ApiError::bad_request("spec_id is required"))?;
            let req = aura_os_storage::types::UpdateSpecRequest {
                title: input.get("title").and_then(|v| v.as_str()).map(|s| s.to_string()),
                markdown_contents: input.get("markdown_contents").and_then(|v| v.as_str()).map(|s| s.to_string()),
                order_index: input.get("order_index").and_then(|v| v.as_i64()).map(|v| v as i32),
            };
            storage.update_spec(spec_id, &jwt, &req).await.map_err(map_storage_error)?;
            Ok(Json(serde_json::json!({ "ok": true })))
        }

        "delete_spec" => {
            let spec_id = input.get("spec_id").and_then(|v| v.as_str())
                .ok_or_else(|| ApiError::bad_request("spec_id is required"))?;
            storage.delete_spec(spec_id, &jwt).await.map_err(map_storage_error)?;
            Ok(Json(serde_json::json!({ "deleted": spec_id })))
        }

        "create_task" => {
            let spec_id = input.get("spec_id").and_then(|v| v.as_str())
                .ok_or_else(|| ApiError::bad_request("spec_id is required"))?;
            let title = input.get("title").and_then(|v| v.as_str()).unwrap_or("Untitled");
            let req = aura_os_storage::CreateTaskRequest {
                spec_id: spec_id.to_string(),
                title: title.to_string(),
                org_id: None,
                description: input.get("description").and_then(|v| v.as_str()).map(|s| s.to_string()),
                status: input.get("status").and_then(|v| v.as_str()).map(|s| s.to_string()),
                order_index: input.get("order_index").and_then(|v| v.as_i64()).map(|v| v as i32),
                dependency_ids: None,
            };
            let task = storage.create_task(&pid, &jwt, &req).await.map_err(map_storage_error)?;
            let core_task = Task::try_from(task)
                .map_err(|e| ApiError::internal(format!("converting task: {e}")))?;
            Ok(Json(serde_json::to_value(&core_task).unwrap_or_default()))
        }

        "list_tasks" => {
            let tasks = storage.list_tasks(&pid, &jwt).await.map_err(map_storage_error)?;
            let core_tasks: Vec<Task> = tasks.into_iter().filter_map(|t| Task::try_from(t).ok()).collect();
            Ok(Json(serde_json::to_value(&core_tasks).unwrap_or_default()))
        }

        "get_task" => {
            let task_id = input.get("task_id").and_then(|v| v.as_str())
                .ok_or_else(|| ApiError::bad_request("task_id is required"))?;
            let task = storage.get_task(task_id, &jwt).await.map_err(map_storage_error)?;
            let core_task = Task::try_from(task)
                .map_err(|e| ApiError::internal(format!("converting task: {e}")))?;
            Ok(Json(serde_json::to_value(&core_task).unwrap_or_default()))
        }

        "delete_task" => {
            let task_id = input.get("task_id").and_then(|v| v.as_str())
                .ok_or_else(|| ApiError::bad_request("task_id is required"))?;
            storage.delete_task(task_id, &jwt).await.map_err(map_storage_error)?;
            Ok(Json(serde_json::json!({ "deleted": task_id })))
        }

        other => {
            warn!(tool = %other, "Unknown tool callback");
            Err(ApiError::not_found(format!("unknown tool: {other}")))
        }
    }
}

async fn get_project_for_callback(
    state: &AppState,
    project_id: &ProjectId,
) -> ApiResult<aura_os_core::Project> {
    if let Some(client) = &state.network_client {
        let jwt = state.get_jwt()?;
        let net = client
            .get_project(&project_id.to_string(), &jwt)
            .await
            .map_err(|e| ApiError::internal(format!("fetching project: {e}")))?;
        let local = state.project_service.get_project(project_id).ok();
        super::projects_helpers::project_from_network(&net, local.as_ref())
    } else {
        state
            .project_service
            .get_project(project_id)
            .map_err(|e| ApiError::not_found(format!("project not found: {e}")))
    }
}
