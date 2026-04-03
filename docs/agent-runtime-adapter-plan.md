# Agent Runtime Adapter Plan

This document is the working reference for the next implementation phase.

## Goal

Let Aura run different agent runtimes cleanly while keeping Aura OS as the system of record.

## Core Concepts

### Adapter

Which runtime does the work.

Examples:
- `aura_harness`
- `claude_code`
- `codex`

### Integration

What provider, auth, and connection config that runtime uses.

Examples:
- org Anthropic integration
- org OpenAI integration
- user-owned integration
- MCP or gateway integration

### Environment

Where that runtime runs.

Examples:
- `local_host`
- `swarm_microvm`

## Simple Rule

- Adapter chooses the runtime
- Integration gives the runtime credentials and config
- Environment tells us where it runs

## Examples

- Aura harness + org integration + local host
- Aura harness + org integration + swarm microVM
- Claude Code + org Anthropic integration + local host
- Codex + org OpenAI integration + local host

Important:
- Aura harness also consumes integrations
- It is not special here
- Aura OS should resolve the integration and pass runtime config into the harness session

## System Layers

- **User intent layer**
  The human request or goal.

- **Control plane**
  The top-level orchestrator.
  It decides what should happen, which agent should do it, and how work should be routed.

- **Aura OS layer**
  The system of record.
  It owns projects, tasks, agents, settings, sessions, workflows, and authoritative state changes.

- **Adapter/runtime layer**
  The execution runtimes.
  Examples: Aura harness, Claude Code, Codex.

- **Environment layer**
  Where the runtime executes.
  Examples: local host, swarm microVM.

## Control Plane

The control plane sits above Aura OS and the runtime adapters.

SuperAgent / CEO belongs here as an orchestrator, not as a runtime.

Its job is to:
- plan
- route
- delegate
- decide which agent/runtime to use
- coordinate workflow progress

Its job is not to:
- directly replace the runtime layer
- own low-level adapter execution
- bypass Aura OS authority

## Authority Rule

Runtimes do the work.

Aura OS keeps authority over OS-level state changes.

That means task, project, Kanban, and settings changes should still go through Aura OS services, even when the work itself is performed by Aura harness, Claude Code, or Codex.

## Integration Ownership

The integration layer should hold reusable external connections.

Examples:
- model providers
- APIs
- MCP servers
- gateways
- local model endpoints

Recommended ownership model:
- org-owned integrations
- user-owned integrations
- agent access through grants or bindings

Agents should consume integrations, not own duplicated copies of them.

## V1 Scope

Phase 1 should stay small:

1. Add adapter selection to agents
2. Add integration selection and resolution
3. Add environment selection
4. Keep current Aura behavior compatible
5. Make Aura harness the first adapter on this model
6. Keep workflow and task authority in Aura OS
7. Add Claude Code and Codex after the foundation is in place

## Compatibility Mapping

Current Aura behavior can map into the new model like this:

- current local Aura flow -> `aura_harness + org integration + local_host`
- current remote Aura flow -> `aura_harness + org integration + swarm_microvm`

This lets us introduce the new model without breaking the current system first.

## Why This Model

This keeps responsibilities clear:

- the control plane thinks
- Aura OS governs state
- adapters execute work
- integrations provide connectivity
- environments decide placement

That separation should make the next phase easier to build, reason about, and extend.
