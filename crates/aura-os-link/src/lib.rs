// ── Harness link (WebSocket-based abstraction) ──────────────────────
pub mod harness_protocol;
mod harness;
mod ws_bridge;
mod swarm_harness;
mod local_harness;

pub use harness::{HarnessLink, HarnessSession, SessionConfig};
pub use harness_protocol::{HarnessInbound, HarnessOutbound};
pub use swarm_harness::SwarmHarness;
pub use local_harness::LocalHarness;
