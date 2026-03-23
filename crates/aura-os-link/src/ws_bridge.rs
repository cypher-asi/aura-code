use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message as WsMessage;
use tracing::{debug, warn};

use aura_protocol::{InboundMessage, OutboundMessage};

pub(crate) fn spawn_ws_bridge<S>(
    ws_stream: S,
) -> (
    mpsc::UnboundedReceiver<OutboundMessage>,
    mpsc::UnboundedSender<InboundMessage>,
)
where
    S: StreamExt<Item = Result<WsMessage, tokio_tungstenite::tungstenite::Error>>
        + SinkExt<WsMessage>
        + Send
        + 'static,
    <S as futures_util::Sink<WsMessage>>::Error: std::fmt::Display + Send,
{
    let (outbound_tx, outbound_rx) = mpsc::unbounded_channel::<OutboundMessage>();
    let (inbound_tx, mut inbound_rx) = mpsc::unbounded_channel::<InboundMessage>();

    let (mut ws_sink, mut ws_stream_read) = ws_stream.split();

    let reader_tx = outbound_tx.clone();
    tokio::spawn(async move {
        while let Some(msg_result) = ws_stream_read.next().await {
            match msg_result {
                Ok(WsMessage::Text(text)) => {
                    debug!(raw = %text, "WS frame received");
                    match serde_json::from_str::<OutboundMessage>(&text) {
                        Ok(event) => {
                            debug!(?event, "Parsed harness event");
                            if reader_tx.send(event).is_err() {
                                break;
                            }
                        }
                        Err(e) => {
                            warn!(raw = %text, "Failed to deserialize harness message: {e}");
                        }
                    }
                }
                Ok(WsMessage::Close(_)) => break,
                Err(e) => {
                    debug!("WebSocket read error: {e}");
                    break;
                }
                _ => {}
            }
        }
    });

    tokio::spawn(async move {
        while let Some(cmd) = inbound_rx.recv().await {
            match serde_json::to_string(&cmd) {
                Ok(json) => {
                    if ws_sink.send(WsMessage::Text(json.into())).await.is_err() {
                        break;
                    }
                }
                Err(e) => {
                    warn!("Failed to serialize harness command: {e}");
                }
            }
        }
        let _ = ws_sink.close().await;
    });

    (outbound_rx, inbound_tx)
}
