# Spec 14 — Mobile IA Handoff

## Goal

Capture the implemented mobile/tablet information architecture, the rules that must stay shared with desktop/web, and the validated behaviors from the latest `codex/mobile-host-connectivity` work so future threads do not have to reconstruct them from chat history.

## Product Direction

The mobile goal is not to recreate desktop on a phone.

The current direction is:

- keep the same product model as desktop/web
- reuse the same providers, routes, detail flows, and capability checks wherever possible
- change presentation and navigation only where the desktop shell model is genuinely bad on a narrow viewport
- keep desktop-only behaviors capability-gated instead of inventing fake parity

## Mobile Navigation Model

### Primary tabs

Mobile/tablet primary navigation is:

- `Agent`
- `Tasks`
- `Files`
- `Feed`

`Projects` is **not** a primary tab on mobile/tablet.

### Project switching

Project switching lives in the top title control and the left drawer.

Rules:

- on project-scoped tabs, the top control is `Project name + chevron`
- on global surfaces like `Feed`, show `Project name + chevron` if a recent/current project exists
- only fall back to plain `AURA` when there is no meaningful project context
- do not reuse the `Files` folder icon for the project switcher

### Shell modes

Mobile has two explicit shell modes:

- `global`
- `project`

Current intended behavior:

- `Agent / Tasks / Files` are project-scoped
- `Feed` is global
- entering a project from a global surface should go into a project work route, not bounce through a confusing launcher state

## Shared Surface Rules

### Agent

- `Agent` reuses the existing project/agent chat route and shared chat view
- if a project has no assigned agent instance, show a shared project empty state
- that empty state should expose `Add Agent`
- creating/selecting an agent from project context must update the shared project-agent cache immediately

Important distinction:

- global `Agents` screen manages reusable agent definitions
- project `Agent` tab is about attaching/using an agent instance in a project

### Tasks

Desktop/web remains execution-first.

Desktop/web structure today:

- main lane: `Execution`
- sidekick: `Specs`, `Tasks`, `Log`, `Stats`, `Sessions`, `Files`

Mobile `Tasks` should respect that model, but in a phone-friendly composition:

- `Execution` stays first
- `Execution details` stays grouped with execution
- `Specs` and `Tasks` should remain visually easier to scan than the heavy execution subpanels
- avoid large dynamic resizing that makes the work view feel unstable on mobile

### Files

- mobile `Files` must show imported workspace snapshots, not only linked workspaces
- desktop-only linked-workspace capability rules still apply for true host-linked browsing
- the host route `POST /api/list-directory` is required for browser/mobile files browsing

### Login / host

When host is healthy on mobile:

- host state should be secondary, not the main thing on screen
- `Sign in` is the primary task
- host control should be a compact utility, not a large card

When host is broken:

- host warning can become prominent

## Capability Rules

These stay intentionally different from desktop:

- linked host folders remain desktop-only
- IDE/open-in-editor behaviors remain desktop-only
- native bridge and PTY/terminal behaviors remain desktop-only

Do not fake parity for those.

## Validation Rules That Worked

Use both automated and manual checks.

### Desktop/browser safety

Shared desktop/browser validation that stayed useful:

- `frontend/tests/e2e/desktop-visual.spec.ts`
- `frontend/tests/e2e/layout-capability.desktop.spec.ts`
- `frontend/tests/e2e/responsive-unification.spec.ts`

These were used to confirm mobile changes did not regress shared desktop/browser views.

### Mobile validation

Useful mobile checks:

- `frontend/tests/e2e/pwa-mobile.spec.ts`
- `frontend/tests/e2e/pwa-mobile-visual.spec.ts`

Screen recordings were especially valuable for catching shell-mode and navigation-state problems that screenshots hid.

## Dev Workflow

### Shared mobile runner

Use:

```bash
./scripts/run-mobile-dev.sh
```

### Simulator / emulator

Open:

```bash
http://127.0.0.1:5173/projects
```

### Physical phone

Use LAN bindings:

```bash
AURA_SERVER_HOST=0.0.0.0 \
AURA_FRONTEND_HOST=0.0.0.0 \
AURA_PUBLIC_HOST=<your-lan-ip> \
./scripts/run-mobile-dev.sh
```

Then open:

```bash
http://<your-lan-ip>:5173/projects
```

### PWA install

On iPhone/iPad Safari:

- open the mobile URL
- `Share` -> `Add to Home Screen`

This is the preferred way to judge the installed mobile shell instead of raw Safari chrome.

## Known Guidance For Future Threads

- prefer shared-route/shared-provider fixes over mobile-only forks
- if mobile needs a different composition, keep the data/model path shared
- protect desktop after every mobile slice with browser visual/layout checks
- when navigation feels weird, record the flow; static screenshots miss stale-state issues
- if a top-level control looks like a tab, it probably needs hierarchy simplification
