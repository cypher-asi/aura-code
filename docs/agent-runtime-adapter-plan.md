# Agent Runtime Adapter Plan

This document is the implementation plan for bringing first-class multi-vendor agent runtime adapters into Aura OS.

It is intentionally grounded in:

- Aura's current runtime model
- the external benchmark adapter work already in progress
- Paperclip's adapter architecture
- the practical differences between workspace integrations and agent runtime selection

## Executive summary

Aura currently has a good benchmark foundation for comparing runtimes, but the product model is still too narrow.

Today, Aura mostly thinks in terms of:

- `machine_type`
- `HarnessMode`
- optional `model`

That is enough for:

- local harness
- swarm harness

It is not enough for:

- Claude Code as a first-class agent runtime
- Codex as a first-class agent runtime
- OpenCode / local OSS runtimes
- adapter-specific auth, diagnostics, session state, and config

My recommendation is to separate the system into two layers:

1. **Integrations**
   Shared connections, credentials, provider accounts, and reusable environment bindings.
2. **Runtime adapters**
   The actual execution runtime an agent uses, such as Aura harness, Claude Code, Codex, or OpenCode.

That means I do **not** want adapter choice to be organization-wide only.
I also do **not** want every agent to duplicate raw credentials/config.

The right model is:

- org/workspace-level integrations
- agent-level adapter selection
- adapter profiles that can reference integrations
- per-run resolved config snapshots

## What I learned from Aura's current code

Aura today is centered around harness selection rather than adapter selection.

The main pressure points are:

- [entities.rs](/Users/shahrozkhan/Documents/zero/aura-os-external-bench/crates/aura-os-core/src/entities.rs)
  Agents and agent instances only store `machine_type` plus an optional `model`.
- [harness.rs](/Users/shahrozkhan/Documents/zero/aura-os-external-bench/crates/aura-os-link/src/harness.rs)
  `SessionConfig` is harness-shaped, not adapter-shaped.
- [local_harness.rs](/Users/shahrozkhan/Documents/zero/aura-os-external-bench/crates/aura-os-link/src/local_harness.rs)
  Assumes local Aura harness websocket.
- [swarm_harness.rs](/Users/shahrozkhan/Documents/zero/aura-os-external-bench/crates/aura-os-link/src/swarm_harness.rs)
  Assumes remote Aura/swarm flow.
- [dto.rs](/Users/shahrozkhan/Documents/zero/aura-os-external-bench/apps/aura-os-server/src/dto.rs)
  Agent create/update DTOs currently expose `machine_type`, but not adapter type/profile.
- [chat.rs](/Users/shahrozkhan/Documents/zero/aura-os-external-bench/apps/aura-os-server/src/handlers/agents/chat.rs)
  Chat path opens a harness session based on `HarnessMode`.
- [dev_loop.rs](/Users/shahrozkhan/Documents/zero/aura-os-external-bench/apps/aura-os-server/src/handlers/dev_loop.rs)
  The autonomous loop is also harness-centric.

So the current system is structurally optimized for "which Aura harness path do I use?" and not "which runtime adapter is this agent bound to?"

## What I learned from Paperclip

Paperclip is much closer to the target shape we want.

Relevant references:

- [creating-an-adapter.md](/Users/shahrozkhan/Documents/Playground/claude-agents/paperclip/docs/adapters/creating-an-adapter.md)
- [types.ts](/Users/shahrozkhan/Documents/Playground/claude-agents/paperclip/packages/adapter-utils/src/types.ts)
- [agents-runtime.md](/Users/shahrozkhan/Documents/Playground/claude-agents/paperclip/docs/agents-runtime.md)

The main ideas worth borrowing are:

- adapters are first-class runtime types
- adapter config is structured data
- environment diagnostics are first-class
- session resume behavior is adapter-aware
- adapters expose usage/cost when available
- the UI can render adapter-specific config forms

Paperclip's model is roughly:

- company-level ownership
- agent-level `adapterType`
- agent-level `adapterConfig`
- runtime execution context
- adapter-specific environment testing

For Aura, I do not want to copy it literally, but I do want to copy the separation of concerns.

## What I learned from Aura Harness and Aura Swarm

The original Aura architecture is still valuable context, and it changes how I think about `machine_type`.

From the current docs:

- [aura-harness/README.md](/Users/shahrozkhan/Documents/zero/aura-harness/README.md)
- [aura-harness/docs/architecture.md](/Users/shahrozkhan/Documents/zero/aura-harness/docs/architecture.md)
- [aura-swarm/README.md](/Users/shahrozkhan/Documents/zero/aura-swarm/README.md)
- [01-system-overview.md](/Users/shahrozkhan/Documents/zero/aura-swarm/docs/spec/v0.1.0/01-system-overview.md)
- [06-agent-runtime.md](/Users/shahrozkhan/Documents/zero/aura-swarm/docs/spec/v0.1.0/06-agent-runtime.md)
- [03-control-plane.md](/Users/shahrozkhan/Documents/zero/aura-swarm/docs/spec/v0.1.0/03-control-plane.md)

The big idea in the old model is:

- **Aura Harness** is the runtime engine
- **Aura Swarm** is the remote isolated deployment and lifecycle layer

That means the historical distinction was not really "vendor adapter" at all.
It was more like:

- local Aura runtime
- remote Aura runtime in an isolated VM/pod/microVM environment

That is important because it tells me `machine_type` was not meaningless or accidental.
It was encoding a real deployment concern:

- where the runtime lives
- how isolated it is
- who provisions it

So I do **not** think the new adapter architecture should delete that concern.
I think it should **re-scope** it.

## Revised mental model

After looking at the older harness/swarm architecture, I think Aura really has **three layers**, not two:

1. **Integration layer**
   Credentials, endpoints, provider accounts, environment bindings
2. **Runtime adapter layer**
   Which runtime engine the agent uses:
   - Aura harness
   - Claude Code
   - Codex
   - OpenCode
3. **Execution placement layer**
   Where that runtime runs:
   - local host
   - swarm / remote VM / microVM
   - later maybe container, gateway, or managed runtime

This means `machine_type` should probably not remain the top-level user-facing runtime selector.
But it still maps to something real in the system:

- execution placement
- isolation mode
- infrastructure strategy

So in the new world:

- `adapter_type` answers: "what runtime engine is this agent?"
- `machine_type` or a renamed equivalent answers: "where/how is that runtime hosted?"

That is a much better fit for the original intent of harness/swarm.

## Recommendation: keep the concept, rename the meaning

I would not keep `machine_type` exactly as-is forever, because the name is too vague now.

I would migrate it toward a concept like:

- `execution_mode`
- `placement_type`
- `runtime_placement`

Examples:

- `local_host`
- `swarm_microvm`
- `remote_gateway`

Then adapter choice becomes separate:

- `aura_harness`
- `claude_code`
- `codex`
- `opencode`

This preserves the old harness/swarm value without overloading one field with two meanings.

## Why this matters

Without this split, we end up with bad questions like:

- "Is Claude Code local or remote?"
- "Is Codex a machine type?"
- "Is swarm an adapter?"

Those are category errors.

The better framing is:

- Claude Code is an adapter
- Codex is an adapter
- Aura harness is an adapter
- swarm is a placement mode for an adapter runtime

That is much closer to the original Aura architecture and to how the system is actually evolving.

## Recommended model for Aura

I want Aura to have **two related but distinct concepts**:

### 1. Integrations

These are reusable environment and credential bindings.

Examples:

- Anthropic API key
- OpenAI API key
- Vertex / Google project binding
- local CLI auth mode metadata
- remote gateway endpoint
- MCP endpoint credentials
- workspace-specific environment bundles

These should primarily be owned at the **organization level**.

Optionally, some can be attached at the **workspace/project level** when the binding is inherently workspace-specific.

Examples of workspace-level cases:

- repo-local model server URL
- local open-source model endpoint for one workspace
- workspace-specific extra env vars
- workspace-specific CLI working-directory assumptions

### 2. Runtime adapters

These describe how an agent actually runs.

Examples:

- `aura_local_harness`
- `aura_swarm_harness`
- `claude_code_local`
- `codex_local`
- `opencode_local`
- later: `http_runtime`, `process_runtime`, etc.

The adapter should be selected at the **agent** level, not org-wide.

Because in a real team:

- one agent may run on Aura harness
- another may run on Claude Code
- another may run on Codex
- another may run on OpenCode

That heterogeneity is valuable.

## Recommended configuration layering

I recommend four layers:

1. **System defaults**
2. **Org / workspace integration profiles**
3. **Agent adapter profile**
4. **Per-run resolved overrides**

This gives us:

- reuse
- policy control
- limited duplication
- flexibility without chaos

## Data model proposal

### New concept: `IntegrationProfile`

This is a reusable connection/config resource.

Suggested fields:

- `integration_profile_id`
- `scope_type`
  - `org`
  - `workspace`
- `scope_id`
- `kind`
  - `anthropic`
  - `openai`
  - `vertex`
  - `gateway`
  - `mcp`
  - `local_env`
- `label`
- `status`
- `config_json`
- `secret_ref`
- `created_at`
- `updated_at`

This should not be agent-specific.

### New concept: `AdapterProfile`

This is a reusable runtime config template.

Suggested fields:

- `adapter_profile_id`
- `scope_type`
  - `org`
  - `workspace`
- `scope_id`
- `adapter_type`
- `label`
- `integration_profile_ids`
- `config_json`
- `created_at`
- `updated_at`

This lets me define profiles such as:

- "Claude Code Opus local"
- "Codex GPT-5.4 local"
- "Aura local harness default"

### Changes to `Agent`

Add:

- `adapter_type: Option<String>`
- `adapter_profile_id: Option<AdapterProfileId>`
- `adapter_overrides: Option<serde_json::Value>`

Keep `machine_type` only as a compatibility field during migration.

### Changes to `AgentInstance`

Add:

- `adapter_type: Option<String>`
- `adapter_profile_id: Option<AdapterProfileId>`
- `resolved_adapter_config: Option<serde_json::Value>`
- `runtime_session_state: Option<serde_json::Value>`

This gives instances a stable resolved snapshot even if upstream profiles later change.

## Runtime abstraction proposal

Today Aura has:

- `HarnessLink`
- `LocalHarness`
- `SwarmHarness`

I recommend adding a new layer above that:

- `AgentRuntimeAdapter`

Suggested trait shape:

```rust
#[async_trait]
pub trait AgentRuntimeAdapter: Send + Sync {
    async fn open_session(&self, config: RuntimeSessionConfig) -> anyhow::Result<RuntimeSession>;
    async fn close_session(&self, session_id: &str) -> anyhow::Result<()>;
    async fn test_environment(&self, config: RuntimeAdapterConfig) -> anyhow::Result<RuntimeEnvironmentReport>;
    fn adapter_type(&self) -> &'static str;
}
```

Then:

- Aura harness adapters can wrap `HarnessLink`
- Claude/Codex/OpenCode adapters can wrap local process runners
- the dev loop and chat handlers can target `AgentRuntimeAdapter` instead of `HarnessMode`

I would also add placement-awareness to the resolved adapter config, so that:

- `aura_harness + local_host`
- `aura_harness + swarm_microvm`

are treated as two concrete deployable runtime combinations, even if they share large parts of the runtime interface.

## Session config proposal

`SessionConfig` is currently too harness-specific.

I would introduce a broader runtime config:

- prompt fields
- model fields
- workspace / cwd fields
- auth / token references
- session resume state
- adapter-specific extras

Suggested split:

- `RuntimeSessionConfig`
- `RuntimeSessionHandle`
- `RuntimeOutboundEvent`
- `RuntimeInboundCommand`

Aura harness events can be mapped into this common shape.
Claude/Codex/OpenCode can map their CLI JSON streams into the same shape as best as possible.

## Environment diagnostics

This should be first-class from day one.

Paperclip gets this right.

Each adapter should support:

- executable present
- auth present
- workspace path valid
- model valid
- optional smoke test

Examples:

- Claude Code
  - CLI present
  - API key or subscription auth detected
  - Vertex mode valid if enabled
- Codex
  - CLI present
  - model available
  - config readable
- Aura harness
  - local harness reachable
  - swarm gateway reachable
  - auth token available if proxy mode requires it

## UI / API recommendation

### Agent create/update

Instead of only:

- `machine_type`

The agent API should evolve to:

- `adapter_type`
- `adapter_profile_id`
- `adapter_overrides`

### Integration management

Add org/workspace settings UI for:

- integration profiles
- adapter profiles
- environment test button

### Agent config UX

Suggested UX:

1. choose adapter type
2. choose adapter profile
3. optionally override model / timeout / cwd / prompt options
4. run environment test

This keeps the common path simple without forcing every agent to re-enter credentials.

## Migration strategy

I do not want a flag day rewrite.

### Phase 1: Data model and compatibility

- add `adapter_type`, `adapter_profile_id`, `adapter_overrides`
- reinterpret current `machine_type` as placement compatibility data:
  - `local` -> `local_host`
  - `remote` / swarm -> `swarm_microvm`
- map existing Aura flows to default adapter + placement combinations:
  - `local` -> `aura_harness + local_host`
  - `remote` / swarm -> `aura_harness + swarm_microvm`
- keep existing flows working

### Phase 2: Runtime adapter layer

- add `AgentRuntimeAdapter` abstraction
- implement Aura local/swarm as the first two runtime adapters
- keep existing behavior unchanged behind the new abstraction

### Phase 3: Integration profiles

- add `IntegrationProfile`
- add `AdapterProfile`
- add config resolution
- add environment test endpoints

### Phase 4: External runtime adapters

- add `claude_code_local`
- add `codex_local`
- add `opencode_local`

### Phase 5: Product rollout

- expose adapter selection in UI
- expose org/workspace integrations
- connect benchmark adapter work to product adapter implementations

## My recommendation on scoping

For v1 product support, I would keep this narrow:

### Must have

- org-level integration profiles
- optional workspace-level integration profiles
- agent-level adapter selection
- adapter profile reference
- environment test endpoint
- Aura + Claude + Codex adapter types

### Not yet

- full per-project secret management
- arbitrary nested adapter overrides everywhere
- multi-hop adapter composition
- adapter-specific UI polish beyond core fields

## Final recommendation

The best way forward is:

- keep **integrations** as reusable org/workspace resources
- keep **adapter choice** at the agent level
- keep **placement/execution mode** as a separate concern
- use **adapter profiles** to avoid config duplication
- keep **workspace/project overrides** limited and intentional
- migrate from `machine_type` to a placement-oriented field gradually

In simple terms:

- integrations answer: "what credentials / endpoints / environment can I use?"
- adapters answer: "which runtime is this agent actually using?"
- placement answers: "where does that runtime execute?"
- profiles answer: "what reusable runtime setup should this agent inherit?"

That is the cleanest model I see for Aura.

## Immediate implementation plan

If I were to start coding this next, I would do it in this order:

1. add the planning doc and confirm terminology
2. add `adapter_type` + compatibility mapping in core entities
3. introduce `AgentRuntimeAdapter` over `HarnessLink`
4. make Aura local/swarm the first concrete adapters
5. add `IntegrationProfile` and `AdapterProfile`
6. add environment-test endpoints
7. add Claude/Codex/OpenCode runtime adapters
8. wire UI/DTO changes

That gives us a path that is incremental, testable, and compatible with the benchmark work already in flight.

## Who should move tickets and Kanban state?

This is another place where I want to be explicit, because it should not become an accidental side effect of whatever runtime adapter happens to be attached to the task agent.

Looking at the current Aura code:

- [task_service.rs](/Users/shahrozkhan/Documents/zero/aura-os-external-bench/crates/aura-os-tasks/src/task_service.rs)
- [task_tools.rs](/Users/shahrozkhan/Documents/zero/aura-os-external-bench/crates/aura-os-super-agent/src/tools/task_tools.rs)

task transitions today are mostly **system/service-level actions**:

- assign task
- mark in progress
- mark done
- fail
- retry
- resolve dependency unlocks

That is already a clue that Kanban movement is not really the same thing as "run the coding agent."

### My recommendation

I think Aura should distinguish between:

1. **Work execution runtimes**
   The agent runtime that actually does the coding / reasoning / editing
2. **System orchestration actions**
   The control-plane actions that move tasks, sessions, assignments, and workflow state

In other words:

- Claude/Codex/Aura/OpenCode should do the task work
- Aura OS orchestration should own the authoritative task transitions

### What that means in practice

The coding agent can still *request* transitions, for example:

- "I finished task X"
- "this task is blocked"
- "retry task Y"

But the durable transition should go through Aura OS task/orchestration services, not directly through vendor-specific runtime logic.

That gives us:

- consistent Kanban semantics across runtimes
- consistent auditability
- less adapter-specific business logic
- easier rollback and policy enforcement

### Suggested model

I would treat task movement as being owned by a small number of orchestrator paths:

- dev loop orchestration
- task service
- super-agent task tools
- later maybe workflow automation engine

Those orchestrator paths may invoke different runtime adapters for actual work, but they remain the ones that persist authoritative state transitions.

### Is there a separate model for those orchestration actions?

Possibly, yes.

I think Aura may eventually want a distinct notion of:

- **task worker runtime**
- **workflow/orchestrator runtime**

For v1, though, I would keep it simpler:

- let agents use different runtime adapters
- keep task state transitions in Aura OS services
- let the agent propose transitions through tools/events, not own the board semantics directly

That keeps the first version clean and avoids turning every vendor adapter into a workflow engine.
