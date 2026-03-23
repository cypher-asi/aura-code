#![warn(missing_docs)]

pub mod client;
mod conversions;
pub mod error;
pub mod types;

#[cfg(any(test, feature = "test-utils"))]
pub mod testutil;

pub use client::StorageClient;
pub use error::StorageError;
pub use types::{
    CreateProjectAgentRequest, CreateSessionRequest, CreateTaskRequest, StorageMessage,
    StorageProjectAgent, StorageSession, StorageSpec, StorageTask, StorageTaskFileChangeSummary,
    TransitionTaskRequest, UpdateProjectAgentRequest, UpdateSessionRequest, UpdateTaskRequest,
};
