use async_trait::async_trait;
use tracing::info;

use crate::harness::{HarnessLink, HarnessSession, SessionConfig};
use crate::harness_protocol::{HarnessInbound, HarnessOutbound};
use crate::ws_bridge::spawn_ws_bridge;

#[derive(Debug, Clone)]
pub struct LocalHarness {
    base_url: String,
}

impl LocalHarness {
    pub fn new(base_url: String) -> Self {
        Self { base_url }
    }

    pub fn from_env() -> Self {
        let base_url = std::env::var("LOCAL_HARNESS_URL")
            .unwrap_or_else(|_| "http://localhost:8080".to_string());
        Self::new(base_url)
    }

    fn ws_url(&self) -> String {
        let base = self
            .base_url
            .replace("https://", "wss://")
            .replace("http://", "ws://");
        format!("{base}/stream")
    }
}

#[async_trait]
impl HarnessLink for LocalHarness {
    async fn open_session(&self, config: SessionConfig) -> anyhow::Result<HarnessSession> {
        // 1. Open WebSocket
        let (ws_stream, _) = tokio_tungstenite::connect_async(&self.ws_url()).await?;

        // 2. Spawn bridge
        let (mut events_rx, commands_tx) = spawn_ws_bridge(ws_stream);

        // 3. Send session_init
        commands_tx.send(HarnessInbound::SessionInit {
            system_prompt: config.system_prompt,
            model: config.model,
            max_tokens: config.max_tokens,
            max_turns: config.max_turns,
            workspace: config.workspace,
            token: None,
            external_tools: vec![],
        })?;

        // 4. Wait for session_ready
        let session_id = loop {
            match events_rx.recv().await {
                Some(HarnessOutbound::SessionReady { session_id, .. }) => {
                    break session_id;
                }
                Some(HarnessOutbound::Error {
                    message, code, ..
                }) => {
                    anyhow::bail!("Harness error during init ({code}): {message}");
                }
                None => {
                    anyhow::bail!("Connection closed before session_ready");
                }
                _ => continue,
            }
        };

        info!(%session_id, "Local harness session ready");

        Ok(HarnessSession {
            session_id,
            events_rx,
            commands_tx,
        })
    }

    async fn close_session(&self, _session_id: &str) -> anyhow::Result<()> {
        Ok(())
    }
}
