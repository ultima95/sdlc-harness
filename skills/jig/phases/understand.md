# Phase 0 — Understand the codebase

Goal: investigate this repository and populate `.jig/memory/` with Project Memory.
Run by `/jig init` (first time) and `/jig memory-refresh` (subsequent). `<SKILL_DIR>`
is this skill's base directory. The project root is the current working directory.

## Steps

1. **Precondition.** Ensure `.jig/` exists (init scaffolds it first). If it does not,
   run `node "<SKILL_DIR>/scripts/scaffold.mjs" "$(pwd)"`.

2. **Fan out explorers.** Dispatch SIX `explorer` subagents IN PARALLEL (one Agent
   tool call each, in a single message so they run concurrently). Give each the
   role prompt from `<SKILL_DIR>/agents/explorer.md`, the `repoRoot` (the current
   working directory, absolute), and its `slice`. The six slices are:
   `structure`, `stack`, `modules`, `conventions`, `runbook`, `risks`.
   Each explorer returns a strict-JSON object for its slice.

3. **Save slices.** Write each explorer's JSON output to
   `.jig/memory/.slices/<slice>.json` (create the `.slices/` dir). If an explorer
   returned prose around the JSON, extract the single JSON object; if it returned
   `{}` or failed, save `{}` for that slice.

4. **Build memory.** Run:
   `node "<SKILL_DIR>/scripts/write-memory.mjs" "$(pwd)" .jig/memory/.slices/structure.json .jig/memory/.slices/stack.json .jig/memory/.slices/modules.json .jig/memory/.slices/conventions.json .jig/memory/.slices/runbook.json .jig/memory/.slices/risks.json`
   This merges the slices and (re)writes the seven memory markdown files.

5. **Optional graph index.** If `.jig/config.yml` has `memory.graph` set to `on` or
   `auto` AND a code-graph MCP is available in this session, additionally index the
   repo with it (best-effort). If no such MCP is present, skip silently — markdown
   is the source of truth.

6. **Report.** Tell the user which memory files were populated and suggest they skim
   `.jig/memory/index.md`. Note that `.jig/memory/.slices/` holds the raw findings.

## Notes
- Explorers are READ-ONLY; they must not modify the repo.
- Keep the fan-out to one round of six; do not recurse.
- `write-memory.mjs` always writes all seven files (empty sections get a placeholder),
  so memory is never left blank.
