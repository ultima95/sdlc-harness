import { slugify } from './slug.mjs';

// Canonical feature-branch name for a task: "<type>/<slug>".
// Both parts are slugified so the result is always a valid git ref segment.
export function branchName(type, slug) {
  const t = slugify(type);
  const s = slugify(slug);
  if (!t || !s) throw new Error('branchName requires a type and slug');
  return `${t}/${s}`;
}

// Prints the repo's default branch as "origin/<name>"; the guide strips "origin/".
export function detectBaseCmd() {
  return 'git symbolic-ref --short refs/remotes/origin/HEAD';
}

// Prints a PR's merge status as JSON {state, mergedAt} (pr mode).
export function prStateCmd(pr) {
  return `gh pr view ${pr} --json state,mergedAt`;
}

// Exits 0 iff <branch> is already merged into <base> (commit mode).
export function branchMergedCmd(branch, base) {
  return `git merge-base --is-ancestor ${branch} ${base}`;
}

// Fetch a single base branch from the remote before cutting a feature branch.
export function fetchBaseCmd(remote, base) {
  if (!remote || !base) throw new Error('fetchBaseCmd requires a remote and base');
  return `git fetch ${remote} ${base}`;
}

// Create and check out <name> from an explicit start-point:
// a local base ref (e.g. "main") or a remote-tracking ref (e.g. "origin/main").
export function checkoutFromCmd(name, startPoint) {
  if (!name || !startPoint) throw new Error('checkoutFromCmd requires a branch name and start-point');
  return `git checkout -b ${name} ${startPoint}`;
}
