# Continuous Agentic Coding App — MVP Requirements

## 1. Purpose

Build a local desktop app for continuous agentic coding.

The app reads project planning documents, stores project/task state locally, and runs an autonomous development loop that works through tasks over time. It should help turn a `requirements.md` file into a structured spec and then continuously execute tasks against a linked local code repository.

**Hierarchy:** Project → Spec → Task (with Agents and Sessions doing the work)

---

## 2. Tech Stack

* **Core app:** Rust
* **Local database:** RocksDB
* **UI:** React + TypeScript
* **Desktop shell / webview:** Rust webview-based desktop app
* **LLM provider:** Claude API

---

## 3. Core User Flow

1. User opens app.
2. User enters Claude API key.
3. User creates a project.
4. User attaches:
   * a `requirements.md` file
   * a local folder path for the codebase
5. App uses AI to generate a structured spec from the requirements.
6. App splits spec into logical `.md` files ordered from most foundational to least foundational.
7. App extracts tasks from spec files and stores them as task objects in the database.
8. User reviews spec files and task progress in the UI.
9. User starts development loop.
10. Agent works through tasks continuously, refreshing context when needed and updating task/project state in the database.

---

## 4. Phase A — Planning Requirements

### 4.1 API Key / Settings

The system must:

* allow the user to input a Claude API key
* store the API key locally
* encrypt the API key at rest
* allow updating or deleting the API key
* never display the plaintext key in the UI after initial entry

---

### 4.2 Project Creation

The system must:

* allow creating a project
* store project name, description, linked folder path, and created timestamp
* allow attaching a `requirements.md` document to the project
* allow viewing project details later

---

### 4.3 Requirements Ingestion

The system must:

* read the project `requirements.md`
* send the contents to Claude
* generate a structured implementation spec

The generated spec should:

* break the program into logical implementation stages
* order stages from most fundamental to least fundamental
* produce multiple markdown spec files
* include for each spec file:
  * purpose
  * major concepts
  * interfaces
  * use cases
  * test cases
  * dependencies
  * state-machine diagrams where useful

---

### 4.4 Spec File Management

The system must:

* store generated spec files within the project
* assign each spec file a stable identifier
* display all spec files for a project
* allow opening and reading each spec file in the UI

---

### 4.5 Task Extraction

The system must:

* extract tasks from each generated spec file
* create task records in RocksDB
* associate each task with:
  * project
  * parent spec file
  * status
  * priority/order
  * dependency information if available

Task statuses should support:

* pending
* ready
* in\_progress
* blocked
* done
* failed

---

### 4.6 Planning UI

The UI must provide:

* project list view
* project detail view
* spec file list by project
* task list grouped by spec file
* high-level project progress view

The progress view should show:

* total tasks
* completed tasks
* active tasks
* failed tasks
* percentage complete

---

## 5. Phase B — Development Requirements

### 5.1 Agent Loop

The system must support a continuous development loop that:

* selects the next available task
* loads relevant project and spec context
* executes work for that task against the linked local folder
* updates task state in the database
* repeats until stopped or no tasks remain

---

### 5.2 Context Rotation

The agent loop must support "Ralph-style" context management:

* track approximate context usage for the active session
* when the current task completes, check context usage
* if context usage is above 50%, start a new context/session
* carry forward only the required summary/state into the next context
* continue with the next task automatically

---

### 5.3 Task Execution

For MVP, the system should support:

* reading project files from the linked local folder
* generating code or edits for the current task
* writing proposed changes to the local codebase
* recording execution logs
* marking tasks complete or failed

Optional but desirable for MVP:

* run local tests or commands
* attach output logs to the task
* use failures to update task notes

---

### 5.4 Task / Plan Updates During Execution

The system must:

* allow the agent to update task state after each loop iteration
* allow the agent to create follow-up tasks if needed
* allow the agent to revise the plan when new dependencies or missing work are discovered
* persist all changes to RocksDB
* maintain project/spec lineage on all auto-generated tasks

---

### 5.5 Real-Time Progress UI

The UI must show real-time development progress, including:

* current active task
* current project
* recent completed tasks
* failed tasks
* agent status
* context/session number
* latest log output

---

## 6. Data Model

### 6.1 Project

| Field | Type | Description |
|---|---|---|
| project\_id | string (UUID) | Unique identifier |
| name | string | Project name |
| description | string | Project description |
| linked\_folder\_path | string | Local codebase path |
| requirements\_doc\_path | string | Path to or contents of requirements.md |
| current\_status | enum | `planning`, `active`, `paused`, `completed`, `archived` |
| created\_at | timestamp | Creation time |
| updated\_at | timestamp | Last update time |

---

### 6.2 Spec File

| Field | Type | Description |
|---|---|---|
| spec\_id | string (UUID) | Unique identifier |
| project\_id | string (UUID) | Parent project |
| title | string | Spec file title |
| order\_index | integer | Sort order (foundational → dependent) |
| markdown\_contents | string | Full markdown body |
| created\_at | timestamp | Creation time |
| updated\_at | timestamp | Last update time |

---

### 6.3 Task

| Field | Type | Description |
|---|---|---|
| task\_id | string (UUID) | Unique identifier |
| project\_id | string (UUID) | Parent project |
| spec\_id | string (UUID) | Parent spec file |
| title | string | Task title |
| description | string | Task description |
| status | enum | `pending`, `ready`, `in_progress`, `blocked`, `done`, `failed` |
| order\_index | integer | Execution priority/order |
| dependency\_ids | list\<string\> | IDs of tasks this depends on |
| assigned\_agent\_id | string (UUID) | Agent currently assigned (nullable) |
| execution\_notes | string | Notes from agent execution |
| created\_at | timestamp | Creation time |
| updated\_at | timestamp | Last update time |

---

### 6.4 Agent

| Field | Type | Description |
|---|---|---|
| agent\_id | string (UUID) | Unique identifier |
| project\_id | string (UUID) | Active project context |
| name | string | Agent display name |
| status | enum | `idle`, `working`, `blocked`, `stopped`, `error` |
| current\_task\_id | string (UUID) | Task currently being worked (nullable) |
| current\_session\_id | string (UUID) | Active session (nullable) |
| created\_at | timestamp | Creation time |
| updated\_at | timestamp | Last status update |

---

### 6.5 Agent Session

| Field | Type | Description |
|---|---|---|
| session\_id | string (UUID) | Unique identifier |
| agent\_id | string (UUID) | Owning agent |
| project\_id | string (UUID) | Project context for this session |
| active\_task\_id | string (UUID) | Task being worked when session started |
| context\_usage\_estimate | float | Approximate context window usage (0.0–1.0) |
| summary\_of\_previous\_context | string | Carried-forward summary from prior session |
| status | enum | `active`, `completed`, `failed`, `rolled_over` |
| started\_at | timestamp | Session start time |
| ended\_at | timestamp | Session end time (nullable) |

---

### 6.6 Data Model Relationships

```
Project
   │
   ├──────────┐
   ▼          ▼
  Spec      Agent
   │          │
   ▼          ▼
  Task ◄── Session
```

**Key constraints:**

* A Project has many Specs and many Agents.
* A Spec belongs to exactly one Project.
* A Task belongs to exactly one Spec (and transitively to one Project).
* An Agent operates within one Project at a time.
* A Session belongs to one Agent and tracks one continuous context window.
* Tasks can be assigned to an Agent. Agents work on tasks through Sessions.

---

## 7. RocksDB Key Design

Key encoding must support the project hierarchy for efficient prefix-based lookups:

| Entity | Key Pattern | Example |
|---|---|---|
| Project | `project:{project_id}` | `project:abc-123` |
| Spec | `spec:{project_id}:{spec_id}` | `spec:abc-123:def-456` |
| Task | `task:{project_id}:{spec_id}:{task_id}` | `task:abc-123:def-456:ghi-789` |
| Agent | `agent:{project_id}:{agent_id}` | `agent:abc-123:jkl-012` |
| Session | `session:{project_id}:{agent_id}:{session_id}` | `session:abc-123:jkl-012:mno-345` |
| Settings | `settings:{key}` | `settings:claude_api_key` |

This allows prefix scans like `spec:abc-123:` to list all specs for a project, or `task:abc-123:def-456:` to list all tasks for a spec.

---

## 8. MVP Non-Goals

These are out of scope for the first version:

* multi-user collaboration
* teams, roles, or permissions
* cloud sync or remote collaboration
* branch management across many git workflows
* full autonomous deployment
* support for multiple model providers (Claude only for MVP)
* deep IDE integration
* complex retry orchestration
* native mobile apps
* billing / organization administration
* external marketplace / plugin ecosystem

---

## 9. MVP Success Criteria

The MVP is successful if a user can:

* create a project
* attach `requirements.md` to a project
* generate a multi-file spec from requirements
* see extracted tasks in the UI
* start an autonomous development loop
* watch the app work through tasks and rotate context automatically
* see progress and logs update live
* trace every piece of work back through Task → Spec → Project

---

## 10. Suggested MVP Build Order

1. Local project creation + RocksDB storage
2. Claude API key management
3. Requirements ingestion + spec generation
4. Spec file viewer
5. Task extraction + task storage
6. Progress dashboard
7. Agent model + basic autonomous task loop
8. Context rollover logic (sessions)
9. Live execution / log view
