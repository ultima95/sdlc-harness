import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// State dir names, preferred first. `.sdlc` is kept for back-compat with repos
// scaffolded before the Jig rename.
const STATE_DIRS = ['.jig', '.sdlc'];

// The state dir to use at a project root: the first existing one, or the
// preferred default (`.jig`) for a fresh repo.
function stateDirName(projectRoot) {
  for (const name of STATE_DIRS) {
    if (fs.existsSync(path.join(projectRoot, name))) return name;
  }
  return STATE_DIRS[0];
}

export function findJigRoot(startDir) {
  let dir = path.resolve(startDir);
  for (;;) {
    if (STATE_DIRS.some((name) => fs.existsSync(path.join(dir, name)))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function jigPaths(projectRoot) {
  const root = path.join(projectRoot, stateDirName(projectRoot));
  return {
    root,
    config: path.join(root, 'config.yml'),
    backlog: path.join(root, 'backlog.md'),
    memoryDir: path.join(root, 'memory'),
    tasksDir: path.join(root, 'tasks'),
  };
}

export function templatesDir() {
  // this file lives at skills/jig/scripts/lib/ ; templates are at skills/jig/templates/
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..', 'templates');
}
