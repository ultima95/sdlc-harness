# Phase 7 — Cleanup (post-ship)

Goal: after a human has merged the PR out-of-band, verify the merge, return to the base branch,
delete the feature branch, and close the task. `<SKILL_DIR>` is this skill's base directory;
`<taskDir>` is the task folder. Runs for a task in phase `shipped` (via `/sdlc cleanup`).

Only runs when `.sdlc/config.yml` `git.cleanup: on_merge`. Merge is asynchronous and human — this
phase is expected to run in a LATER session than Ship.

## Steps
1. Read `state.json` for `branch`, `base`, and `pr`; read `ship.mode` + `git.*` from
   `.sdlc/config.yml`. If there is no `branch`, there is nothing to clean — set phase `done`
   (`node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" advance`) and report.
2. **Verify the branch was actually merged** — never delete otherwise:
   - `ship.mode: pr` (a `pr` is recorded): `gh pr view <pr> --json state,mergedAt`.
     - `MERGED` → proceed.
     - `OPEN` → not merged yet; report and STOP (leave the task in `shipped`).
     - `CLOSED` without a merge → warn; ask the developer keep-the-branch vs. force-delete.
   - `ship.mode: commit` (no PR): `git merge-base --is-ancestor <branch> <base>` (exit 0 = merged).
     - Not merged → report and STOP (task stays `shipped`).
3. **Confirm** the cleanup plan with the developer once: which branch is deleted, the base to
   return to, and whether the remote branch is deleted (`git.delete_remote`).
4. **Return to base:** `git checkout <base>` then `git pull --ff-only` (pull in the merged commits).
5. **Delete the local branch:** `git branch -d <branch>` (safe delete — refuses if not merged).
   Use `-D` only if the developer explicitly forces it after a CLOSED-not-merged warning.
6. **Delete the remote branch** if `git.delete_remote` (default `true`) and it still exists:
   `git push origin --delete <branch>` (confirm per `trust_level`: `strict` confirms; others auto).
7. Record: `node "<SKILL_DIR>/scripts/progress.mjs" "<taskDir>" shipped "cleaned up: deleted <branch>, on <base>"`.
8. Close the task: `node "<SKILL_DIR>/scripts/set-state.mjs" "<taskDir>" advance`
   (phase `shipped` → `done`).
9. Report: the branch deleted (local/remote), the base now checked out, and that the task is `done`.

## Notes
- Never delete an unmerged branch. Step 2 is authoritative; `git branch -d` refusing is a backstop.
- Non-git repo, no remote, or `git.cleanup: off` → this phase is not used; Ship already moved the
  task to `done`.
