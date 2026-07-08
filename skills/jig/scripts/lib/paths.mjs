import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function findSdlcRoot(startDir) {
  let dir = path.resolve(startDir);
  for (;;) {
    if (fs.existsSync(path.join(dir, '.sdlc'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function sdlcPaths(projectRoot) {
  const root = path.join(projectRoot, '.sdlc');
  return {
    root,
    config: path.join(root, 'config.yml'),
    backlog: path.join(root, 'backlog.md'),
    memoryDir: path.join(root, 'memory'),
    tasksDir: path.join(root, 'tasks'),
  };
}

export function templatesDir() {
  // this file lives at skills/sdlc/scripts/lib/ ; templates are at skills/sdlc/templates/
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..', 'templates');
}
