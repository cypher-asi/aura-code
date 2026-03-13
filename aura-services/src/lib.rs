pub mod claude;
pub mod error;
pub mod project;
pub mod spec_gen;
pub mod task;
pub mod task_extraction;

pub use claude::ClaudeClient;
pub use error::{ClaudeClientError, ProjectError, SpecGenError, TaskError};
pub use project::{CreateProjectInput, ProjectService, UpdateProjectInput};
pub use spec_gen::SpecGenerationService;
pub use task::TaskService;
pub use task_extraction::TaskExtractionService;
