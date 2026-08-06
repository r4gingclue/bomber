import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const markdownFiles = execFileSync('git', ['ls-files', '*.md'], {
  cwd: root,
  encoding: 'utf8',
}).trim().split('\n').filter(file => file && existsSync(resolve(root, file)));
const tracked = new Set(execFileSync('git', ['ls-files'], {
  cwd: root,
  encoding: 'utf8',
}).trim().split('\n').filter(Boolean));
const errors = [];
let checked = 0;

for (const file of markdownFiles) {
  const source = readFileSync(resolve(root, file), 'utf8');
  const linkPattern = /!?\[[^\]]*]\(([^)]+)\)/g;
  for (const match of source.matchAll(linkPattern)) {
    let target = match[1].trim();
    if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    target = target.split(/\s+["']/)[0];
    const pathPart = decodeURIComponent(target.split('#')[0]);
    if (!pathPart) continue;
    checked++;
    const absolute = resolve(root, dirname(file), pathPart);
    if (!existsSync(absolute)) {
      errors.push(`${file}: missing local link target ${target}`);
      continue;
    }
    const relative = absolute.slice(root.length + 1);
    if (!tracked.has(relative)) {
      errors.push(`${file}: local link target is not tracked: ${relative}`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Validated ${checked} local Markdown links across ${markdownFiles.length} tracked files`);
