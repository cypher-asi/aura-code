# Agent Runtime Adapter Plan

This document is the reference for the runtime adapter and BYOK work.

## Goal

Let Aura support multiple runtimes cleanly while keeping Aura OS as the system of record.

## Core Concepts

### Adapter

Which runtime does the work.

Examples:
- `aura_harness` (user-facing label: `Aura`)
- `claude_code`
- `codex`

### Integration

Reusable external connectivity owned outside the agent.

Two useful buckets:
- runtime/provider integrations
  - Anthropic
  - OpenAI
- tool/service integrations
  - Linear
  - GitHub
  - Slack
  - MCP servers

### Environment

Where the runtime executes.

Examples:
- `local_host`
- `swarm_microvm`

### Auth Source

How the runtime gets credentials.

Examples:
- `aura_managed`
- `org_integration`
- `local_cli_auth`

## Simple Rule

- Adapter chooses the runtime
- Integration is the shared connection source
- Environment chooses placement
- Auth source explains how the runtime authenticates

## System Layers

- **User intent**
  The human request.
- **Control plane**
  The orchestrator that decides what should happen next.
- **Aura OS**
  The authority for projects, tasks, Kanban, settings, agents, and workflows.
- **Runtime adapters**
  Aura, Claude Code, Codex.
- **Environment**
  Local host or swarm microVM.

## Authority Boundary

- Aura OS owns state and workflow authority.
- Adapters execute runtime work.
- Tool integrations should usually be invoked through Aura OS, not directly by the adapter.

So:
- create project -> Aura OS
- move task -> Aura OS
- call Linear -> Aura OS integration/tool layer
- generate/respond/edit/code -> selected adapter

## Org Integrations

The org should own reusable external connections.

Examples:
- Anthropic API key
- OpenAI API key
- Linear token
- GitHub credentials
- MCP server config

Agents should reference these integrations. They should not store raw secrets.

## Adapter Mental Model

### Aura

- default runtime for Aura-native execution
- can use:
  - `aura_managed`
  - `org_integration` for BYOK

### Claude Code

- can use:
  - `local_cli_auth`
  - `org_integration`

### Codex

- can use:
  - `local_cli_auth`
  - `org_integration`

## End-to-End Product Flow

The product flow should stay simple:

1. Create or edit an organization
2. Add shared integrations in Team Settings
3. Create or edit an agent
4. Choose:
   - adapter
   - environment
   - auth source
5. Attach an integration only when the auth source requires one
6. Test the runtime
7. Run the agent

## Security Model

### Baseline rules

- store secrets at the integration layer, not on agents
- keep metadata and secret material separate
- resolve secrets only at runtime
- do not write secrets into prompts, logs, or transcripts
- agents should reference integration ids, not inline keys

This is close to Paperclip’s shape:
- encrypted secrets at rest
- secret refs instead of inline spread
- runtime-time resolution
- environment tests before execution

## V1

V1 is the thin but real product slice:

- org integrations UI
- agent adapter/environment/auth-source selection
- local CLI auth for Claude/Codex
- Aura-managed auth for Aura
- direct runtime testing
- direct agent execution through the selected runtime

Trust model:
- `local_host` is treated as a trusted environment

## V2

V2 adds Aura BYOK properly:

- `Aura + org_integration + local_host`
- `Aura + org_integration + swarm_microvm`
- per-session provider config passed into the harness
- no fake dependence on Aura-managed billing when the org is supplying the provider key

Trust model:
- `local_host` remains the simple trusted path
- `swarm_microvm` is the stronger isolation path for BYOK and sensitive integrations

## What V2 Changes

To support Aura BYOK, the harness must accept provider config per session instead of relying only on process-global env.

That means:
- Aura OS resolves the org integration
- Aura OS passes a per-session provider config into the harness
- the harness creates a per-session provider override
- if no override is supplied, the harness falls back to the normal Aura-managed provider

## Example

Org adds:
- Anthropic integration
- Linear integration

### After V1

- Aura agent can use Aura-managed auth
- Claude/Codex can use local CLI auth or org integrations
- Linear stays OS-mediated
- `local_host` is the trusted execution boundary

### After V2

- Aura can also use the org Anthropic integration directly
- the same org can still use Linear through Aura OS
- high-trust agents can run in `swarm_microvm`

## What This Does Not Change

- Aura OS still owns Kanban and task transitions
- Aura OS still owns project/workflow authority
- tool integrations still belong to the OS/integration layer

## Current Practical Scope

The clean build order is:

1. ship the adapter/auth-source foundation
2. add Aura BYOK through per-session harness provider config
3. harden the swarm path for stronger isolation

That keeps the model simple:
- Aura OS governs
- adapters execute
- integrations connect
- environments place the runtime
