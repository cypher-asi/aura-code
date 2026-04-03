---
name: obsidian
description: "Manage notes in Obsidian vaults using the official Obsidian CLI. Create, read, search, append, and organize notes. Requires Obsidian desktop app running with CLI enabled."
allowed_tools: [read_file, write_file, list_directory, shell]
allowed-paths: []
allowed-commands: ["obsidian", "start obsidian://"]
user_invocable: true
model_invocable: true
---

# Obsidian (Windows)

Manage Obsidian vaults using the **official Obsidian CLI** (`obsidian`).
The CLI is built into Obsidian desktop (v1.12.4+) and must be enabled in
Settings > General > Command line interface. The Obsidian app must be running.

**Primary tool**: Use `run_command` with the `obsidian` CLI for all operations.
**Fallback**: Use `read_file` / `write_file` for direct file access when needed.

## Vault discovery

    obsidian vaults

Lists all vaults. To target a specific vault, use `--vault <name>`:

    obsidian files --vault n3o

**Shortcut**: check agent memory (facts) for key `obsidian_vault_path` first.
If not set, discover it and store as a fact for next time.

## Creating notes

    obsidian create "Note Name" --content "# Title\n\nBody text" --vault n3o

Or with properties:

    obsidian create "Note Name" --vault n3o --content "Body here"
    obsidian property:set "Note Name" tags "tag-a, tag-b" --vault n3o

For longer content, use `write_file` directly to the vault path with
YAML frontmatter:

    ---
    created: YYYY-MM-DD
    tags: [tag-a, tag-b]
    ---

    # Title

    Content with [[wikilinks]] to other notes.

Rules:
- Use `[[Note Name]]` for internal links (wikilinks), never `[text](path.md)`.
- Use `#tags` inline; mirror them in frontmatter `tags` array.
- Place new notes at the vault root unless the user specifies a subfolder.

## Reading notes

    obsidian read "Note Name" --vault n3o

Or with `read_file` using the vault path + relative note path.

## Searching the vault

    obsidian search "query" --vault n3o

For contextual search results:

    obsidian search:context "query" --vault n3o

## Listing files and folders

    obsidian files --vault n3o
    obsidian folders --vault n3o

## Appending and prepending

    obsidian append "Note Name" --content "New content at end" --vault n3o
    obsidian prepend "Note Name" --content "New content at top" --vault n3o

## Daily notes

    obsidian daily --vault n3o
    obsidian daily:read --vault n3o
    obsidian daily:append --content "New entry" --vault n3o

## Links and backlinks

    obsidian backlinks "Note Name" --vault n3o
    obsidian links "Note Name" --vault n3o
    obsidian orphans --vault n3o

## Tags

    obsidian tags --vault n3o
    obsidian tag "specific-tag" --vault n3o

## Properties

    obsidian properties "Note Name" --vault n3o
    obsidian property:set "Note Name" key "value" --vault n3o
    obsidian property:remove "Note Name" key --vault n3o

## Templates

    obsidian templates --vault n3o
    obsidian template:insert "Note Name" "Template Name" --vault n3o

## Opening notes in the app

    obsidian open "Note Name" --vault n3o

Or via URI protocol:

    start "obsidian://open?vault=VAULT_NAME&file=PATH_INSIDE_VAULT"

## Moving, renaming, deleting

    obsidian move "Note" "Folder/Note" --vault n3o
    obsidian rename "Old Name" "New Name" --vault n3o
    obsidian delete "Note Name" --vault n3o

## Safety

- Never modify files inside `.obsidian/` (plugin config, workspace state).
- Never delete notes without explicit user confirmation.
- Prefer appending to existing notes over overwriting them.
