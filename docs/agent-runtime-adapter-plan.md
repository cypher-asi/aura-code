# Agent Runtime And Integrations Plan

This document is the current reference for Aura OS runtime adapters, org-level integrations, and BYOK.

It is intentionally practical:
- what the product model is
- what works today
- what is still limited
- how we expect tool integrations to fit later

## Goal

Let Aura OS support multiple runtimes cleanly while keeping one simple system model:

- Aura OS owns projects, tasks, workflow state, and orchestration
- adapters do the AI/runtime work
- org integrations hold reusable external credentials
- environments decide where a runtime executes

## Product Model

### Integrations

Integrations are org-level shared setup.

Today, the main integrations are model/provider integrations:
- Anthropic
- OpenAI

Later, the same org-level concept should also hold tool integrations:
- Linear
- GitHub
- Slack
- MCP servers
- internal APIs

So the durable product term is:
- `Integrations`

And later we can split that into:
- model integrations
- tool integrations

### Adapters

Adapters are the runtime types an agent can use.

Current adapters:
- `Aura`
- `Claude Code`
- `Codex`

Internal ids still exist in code:
- `aura_harness`
- `claude_code`
- `codex`

But the user-facing concept is:
- `Runtime`

### Authentication

Authentication explains how the selected adapter gets access.

Current modes:
- `Aura Billing`
  - internal: `aura_managed`
- `Use Team Integration`
  - internal: `org_integration`
- `Use Local Login`
  - internal: `local_cli_auth`

### Runs On

Runs On explains where the runtime executes.

Current environments:
- `This Machine`
  - internal: `local_host`
- `Isolated Cloud Runtime`
  - internal: `swarm_microvm`

## Simple Rule

- adapter chooses the runtime
- integration is the shared external setup
- authentication explains how that runtime gets access
- runs on chooses execution placement

## Authority Boundary

Aura OS remains the system of record.

Aura OS owns:
- projects
- tasks
- Kanban / workflow state
- persistence
- orchestration
- governed side effects

Adapters do runtime work:
- generate
- reason
- chat
- code
- plan
- respond

Important practical rule:
- if something does not require AI, Aura OS should just do it directly
- if something requires AI work, the selected runtime path is used

Examples:
- move task -> Aura OS
- update workflow state -> Aura OS
- save project metadata -> Aura OS
- generate a response -> selected adapter
- write code -> selected adapter
- produce specs/tasks through AI -> Aura runtime path

## Tool Integration Boundary

Tool integrations should usually be mediated by Aura OS, not directly owned by each adapter.

That means:
- stateful product actions stay governed by Aura OS
- adapters should not become the source of truth for external business state

Example with Linear later:
- org adds a Linear integration
- an agent may ask to move a task or create an issue
- Aura OS should perform the Linear action through the org integration layer
- the adapter should not need to permanently own the Linear token itself

This keeps the system cleaner:
- one source of truth
- better auditability
- easier permission control
- less duplicated secret handling across runtimes

## Current Offering

Today, Aura OS offers:

1. Org-level model integrations
- Anthropic integration
- OpenAI integration

2. Agent runtime selection
- Aura
- Claude Code
- Codex

3. Per-agent authentication choice
- Aura Billing
- Use Team Integration
- Use Local Login

4. Per-agent execution placement
- local path working today
- cloud/swarm path modeled, but not yet fully validated end to end

## Current Support Matrix

### Aura

Supports:
- `Aura Billing`
- `Use Team Integration`

Current practical provider support for `Use Team Integration`:
- Anthropic only

So today:
- `Aura + Anthropic org integration` works
- `Aura + OpenAI org integration` is not supported yet

This is a current implementation limit, not a framework limit.

### Claude Code

Supports:
- `Use Local Login`
- `Use Team Integration`

Current provider expectation for team integration:
- Anthropic

So today:
- `Claude Code + local login` works if the `aura-os-server` process has a valid Claude CLI session
- `Claude Code + Anthropic org integration` works by injecting the org key into the runtime path

### Codex

Supports:
- `Use Local Login`
- `Use Team Integration`

Current provider expectation for team integration:
- OpenAI

So today:
- `Codex + local login` works if the `aura-os-server` process can run Codex with valid local auth
- `Codex + OpenAI org integration` is the matching provider-backed path

## Important Local-Login Truth

For local-login adapters, the login state belongs to the server process environment.

That means:
- `Claude Code + Use Local Login + This Machine`
- `Codex + Use Local Login + This Machine`

both depend on:
- the CLI being installed
- the `aura-os-server` process being able to use that CLI
- valid auth being present in that same host environment

This is why local login is convenient but less deterministic than team integration.

## End-To-End Flow

The intended user flow is:

1. Open Team Settings
2. Add an integration at the org level
3. Create or edit an agent
4. Choose:
   - runtime
   - runs on
   - authentication
5. If authentication is `Use Team Integration`, choose the matching integration
6. Check runtime
7. Run the agent

## Current UI Language

The current user-facing language should be:

- `Integrations`
- `Runtime`
- `Runs On`
- `Authentication`
- `Use Team Integration`
- `Use Local Login`
- `Aura Billing`

Internal ids and transport details should stay internal wherever possible.

## Security Model

Baseline rules:
- store secrets at the integration layer, not on agents
- keep secret material separate from agent config
- resolve secrets only at runtime
- do not write secrets into prompts, logs, or transcripts
- agents should reference integration ids, not raw keys

Trust model today:
- `This Machine` is treated as a trusted local environment

Stronger future model:
- `Isolated Cloud Runtime` is the stronger boundary for BYOK and sensitive workloads

## What Works Today

Local path:
- Aura with Aura Billing
- Aura with Anthropic org integration
- Claude Code with Anthropic org integration
- Codex with local login
- local benchmark/core loop

Also true:
- UI and product model now support org integrations cleanly
- standalone agent chat paths for Aura, Claude org integration, and Codex are working on the local path

## Current Limits

These are important and should stay explicit:

1. Aura BYOK is Anthropic-only today
- the framework is generic enough to grow
- the current server-to-harness provider override is only implemented for Anthropic

2. Claude local login is environment-dependent
- if the server process is not logged into Claude, this path fails

3. External adapter chat is still buffered
- Codex and Claude do not yet stream token-by-token like Aura does

4. Swarm path is not the fully validated path yet
- the local product path is the main working path today

## Why Aura Supports Only Anthropic Today

The key limitation is not the overall model. It is the current provider implementation.

Today:
- Aura OS builds session provider config only for Anthropic
- the harness provider factory only instantiates Anthropic from session overrides

So supporting more providers would require:
- adding another provider implementation in the harness
- extending the provider factory
- extending Aura OS integration-to-provider mapping
- validating the full path end to end

This is additive work, not a redesign.

## Tool Integration Direction

Later, integrations should expand beyond model providers.

Example:
- org adds Anthropic
- org adds Linear

Then:
- Aura or Claude may use Anthropic for model execution
- Aura OS should use the Linear integration when the system needs to create or update Linear state

Important distinction:
- model integrations help a runtime talk to a model
- tool integrations help Aura OS perform governed external actions

## What This Does Not Change

Even with more adapters and more integrations:
- Aura OS still owns workflow state
- Aura OS still owns tasks/projects
- Aura OS still owns non-AI actions
- integrations stay org-level
- adapters stay execution-level

## Practical Build Order

The current practical order remains:

1. runtime / auth / environment foundation
2. Aura BYOK through per-session provider config
3. stronger cloud/swarm hardening
4. more provider support for Aura BYOK
5. tool integrations through the org integration layer

That keeps the system understandable:
- integrations connect
- adapters execute
- Aura OS governs
- environments place the runtime
