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

Parameters use `key=value` syntax. Wrap values with spaces in quotes.

## Vault discovery

    obsidian vaults

To target a specific vault, add `vault=NAME` to any command.

**Shortcut**: check agent memory (facts) for key `obsidian_vault_path` first.

## Creating notes

    obsidian create name="Note Name" content="Body text" vault=n3o
    obsidian create name="Trip to Paris" template=Travel vault=n3o

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

    obsidian read vault=n3o
    obsidian read file="Note Name" vault=n3o

## Searching the vault

    obsidian search query="meeting notes" vault=n3o
    obsidian search:context query="meeting notes" vault=n3o

## Listing files and folders

    obsidian files vault=n3o
    obsidian files sort=modified limit=5 vault=n3o
    obsidian folders vault=n3o

## Appending and prepending

    obsidian daily:append content="- [ ] Buy groceries" vault=n3o
    obsidian append file="Note Name" content="New content" vault=n3o
    obsidian prepend file="Note Name" content="New content" vault=n3o

## Daily notes

    obsidian daily vault=n3o
    obsidian daily:read vault=n3o
    obsidian daily:append content="New entry" vault=n3o
    obsidian tasks daily vault=n3o

## Links and backlinks

    obsidian backlinks file="Note Name" vault=n3o
    obsidian links file="Note Name" vault=n3o
    obsidian orphans vault=n3o
    obsidian unresolved vault=n3o

## Tags

    obsidian tags vault=n3o
    obsidian tags counts vault=n3o
    obsidian tag "specific-tag" vault=n3o

## Properties

    obsidian properties file="Note Name" vault=n3o
    obsidian property:set file="Note Name" key value vault=n3o
    obsidian property:remove file="Note Name" key vault=n3o

## Templates

    obsidian templates vault=n3o
    obsidian template:insert file="Note Name" template="Template Name" vault=n3o

## Opening notes in the app

    obsidian open file="Note Name" vault=n3o

## Moving, renaming, deleting

    obsidian move file="Note" to="Folder/Note" vault=n3o
    obsidian rename file="Old Name" to="New Name" vault=n3o
    obsidian delete file="Note Name" vault=n3o

## File history (Sync)

    obsidian diff file=README from=1 to=3 vault=n3o
    obsidian history:list file="Note Name" vault=n3o

## Output

Add `--copy` to any command to copy output to clipboard.
Add `format=json` to get JSON output for programmatic use.

## Safety

- Never delete notes without explicit user confirmation.
- Prefer appending to existing notes over overwriting them.
- Never modify files inside `.obsidian/` directly.
