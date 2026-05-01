import fs from 'fs';
import path from 'path';

const skipDirs = new Set(['node_modules', 'web', 'packages', '.git', 'dist', 'build']);
const fromRe = /\.from\(\s*['"]([a-z_][a-z0-9_]*)['"]/g;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|mjs)$/.test(ent.name)) out.push(p);
  }
  return out;
}

const roots = ['app', 'contexts', 'lib', 'components'];
const tables = new Set();
for (const base of roots) {
  for (const f of walk(base)) {
    let s;
    try {
      s = fs.readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    for (const m of s.matchAll(fromRe)) tables.add(m[1]);
  }
}
console.log([...tables].sort().join('\n'));
console.error(`\n# count: ${tables.size}`);
