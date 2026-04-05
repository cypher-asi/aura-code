use std::convert::Infallible;
use std::pin::Pin;

use axum::extract::State;
use axum::http::HeaderValue;
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::Json;
use futures_util::stream;
use serde_json::json;
use tracing::info;

use aura_os_core::HarnessMode;
use aura_os_link::{
    GenerationRequest, HarnessInbound, HarnessOutbound, SessionConfig,
};

use crate::dto::{Generate3dRequest, GenerateImageRequest};
use crate::error::{ApiError, ApiResult};
use crate::state::{AppState, AuthJwt};

use super::agents::chat_pub::get_or_create_chat_session;

type SseStream = Pin<Box<dyn futures_core::Stream<Item = Result<Event, Infallible>> + Send>>;
type SseResponse = ([(&'static str, HeaderValue); 1], Sse<SseStream>);

const SSE_NO_BUFFERING_HEADERS: [(&str, HeaderValue); 1] = [(
    "X-Accel-Buffering",
    HeaderValue::from_static("no"),
)];

fn generation_session_key(jwt: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    jwt.hash(&mut hasher);
    format!("generation:{:x}", hasher.finish())
}

fn generation_event_to_sse(evt: &HarnessOutbound) -> Option<Result<Event, Infallible>> {
    match evt {
        HarnessOutbound::GenerationStart(s) => Some(Ok(Event::default()
            .event("generation_start")
            .json_data(&json!({ "mode": s.mode }))
            .unwrap_or_else(|_| Event::default().data("{}")))),
        HarnessOutbound::GenerationProgress(p) => Some(Ok(Event::default()
            .event("generation_progress")
            .json_data(&json!({ "percent": p.percent, "message": p.message }))
            .unwrap_or_else(|_| Event::default().data("{}")))),
        HarnessOutbound::GenerationPartialImage(pi) => Some(Ok(Event::default()
            .event("generation_partial_image")
            .json_data(&json!({ "data": pi.data }))
            .unwrap_or_else(|_| Event::default().data("{}")))),
        HarnessOutbound::GenerationCompleted(c) => {
            let mut data = c.payload.clone();
            if let Some(obj) = data.as_object_mut() {
                obj.insert("mode".to_string(), json!(c.mode));
            }
            Some(Ok(Event::default()
                .event("generation_completed")
                .json_data(&data)
                .unwrap_or_else(|_| Event::default().data("{}"))))
        }
        HarnessOutbound::GenerationError(e) => Some(Ok(Event::default()
            .event("generation_error")
            .json_data(&json!({ "code": e.code, "message": e.message }))
            .unwrap_or_else(|_| Event::default().data("{}")))),
        HarnessOutbound::Error(e) => Some(Ok(Event::default()
            .event("generation_error")
            .json_data(&json!({ "code": e.code, "message": e.message }))
            .unwrap_or_else(|_| Event::default().data("{}")))),
        _ => None,
    }
}

fn generation_broadcast_to_sse(
    rx: tokio::sync::broadcast::Receiver<HarnessOutbound>,
) -> impl futures_core::Stream<Item = Result<Event, Infallible>> + Send {
    stream::unfold((rx, false, false), |(mut rx, emit_done, done)| async move {
        if done {
            return None;
        }
        if emit_done {
            let evt = Event::default()
                .event("done")
                .json_data(&json!({}))
                .unwrap_or_else(|_| Event::default().data("{}"));
            return Some((Ok(evt), (rx, false, true)));
        }
        loop {
            match rx.recv().await {
                Ok(evt) => {
                    let is_terminal = matches!(
                        evt,
                        HarnessOutbound::GenerationCompleted(_)
                            | HarnessOutbound::GenerationError(_)
                            | HarnessOutbound::Error(_)
                    );
                    if let Some(sse_event) = generation_event_to_sse(&evt) {
                        return Some((sse_event, (rx, is_terminal, false)));
                    }
                    continue;
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                Err(tokio::sync::broadcast::error::RecvError::Closed) => return None,
            }
        }
    })
}

async fn open_generation_stream(
    state: &AppState,
    jwt: &str,
    gen_request: GenerationRequest,
) -> ApiResult<SseResponse> {
    let session_key = generation_session_key(jwt);
    let config = SessionConfig {
        token: Some(jwt.to_string()),
        ..Default::default()
    };

    let (_is_new, rx, commands_tx) =
        get_or_create_chat_session(state, &session_key, HarnessMode::Local, config, None).await?;

    commands_tx
        .send(HarnessInbound::GenerationRequest(gen_request))
        .map_err(|e| ApiError::internal(format!("sending generation request: {e}")))?;

    let sse_stream = generation_broadcast_to_sse(rx);
    let boxed: SseStream = Box::pin(sse_stream);
    Ok((
        SSE_NO_BUFFERING_HEADERS,
        Sse::new(boxed).keep_alive(KeepAlive::default()),
    ))
}

pub(crate) async fn generate_image_stream(
    State(state): State<AppState>,
    AuthJwt(jwt): AuthJwt,
    Json(body): Json<GenerateImageRequest>,
) -> ApiResult<SseResponse> {
    super::billing::require_credits(&state, &jwt).await?;
    info!(model = ?body.model, "Image generation stream requested (harness)");

    let req = GenerationRequest {
        mode: "image".to_string(),
        prompt: Some(body.prompt),
        model: body.model,
        size: body.size,
        image_url: None,
        images: body.images,
        project_id: body.project_id,
        is_iteration: body.is_iteration,
    };

    open_generation_stream(&state, &jwt, req).await
}

pub(crate) async fn generate_3d_stream(
    State(state): State<AppState>,
    AuthJwt(jwt): AuthJwt,
    Json(body): Json<Generate3dRequest>,
) -> ApiResult<SseResponse> {
    super::billing::require_credits(&state, &jwt).await?;
    info!("3D generation stream requested (harness)");

    let req = GenerationRequest {
        mode: "3d".to_string(),
        prompt: body.prompt,
        model: None,
        size: None,
        image_url: Some(body.image_url),
        images: None,
        project_id: body.project_id,
        is_iteration: None,
    };

    open_generation_stream(&state, &jwt, req).await
}
