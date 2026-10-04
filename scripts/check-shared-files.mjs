// Each example is self-contained so that it can be copied on its own. Some files are therefore duplicated: this
// check fails when the copies drift apart. Edit examples/js first, then copy the file to the other examples.
import { readFileSync } from 'node:fs';

const SOURCE = 'examples/js';
const SHARED = {
  'worker/index.ts': ['examples/js-cdn', 'examples/js-umd', 'examples/react'],
  'worker/index.test.ts': ['examples/js-cdn', 'examples/js-umd', 'examples/react'],
  'worker/catalog.ts': ['examples/js-cdn', 'examples/js-umd', 'examples/react'],
  'worker/catalog.test.ts': ['examples/js-cdn', 'examples/js-umd', 'examples/react'],
  'worker/tsconfig.json': ['examples/js-cdn', 'examples/js-umd', 'examples/react'],
  '.dev.vars.example': ['examples/js-cdn', 'examples/js-umd', 'examples/react'],
  'vitest.config.ts': ['examples/js-cdn', 'examples/js-umd', 'examples/react'],
  'public/style.css': ['examples/js-cdn', 'examples/js-umd'],
  'src/api.ts': ['examples/react/src/lib/api.ts'],
};
const PAIRS = [['examples/js-cdn/public', 'examples/js-umd/public', ['api.js', 'order.js', 'order.html']]];

const read = (path) => readFileSync(path, 'utf8');
const problems = [];

for (const [file, targets] of Object.entries(SHARED)) {
  const expected = read(`${SOURCE}/${file}`);
  for (const target of targets) {
    const path = target.endsWith('.ts') ? target : `${target}/${file}`;
    if (read(path) !== expected) problems.push(`${path} differs from ${SOURCE}/${file}`);
  }
}

for (const [left, right, files] of PAIRS) {
  for (const file of files) {
    const a = read(`${left}/${file}`);
    const b = read(`${right}/${file}`);
    // The pages only differ in their subtitle.
    const normalise = (text) => text.replace(/hosted script|browser build \(jsDelivr\)/g, 'VARIANT');
    if (normalise(a) !== normalise(b)) problems.push(`${right}/${file} differs from ${left}/${file}`);
  }
}

if (problems.length > 0) {
  console.error(`Shared files drifted apart:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('Shared files are in sync.');
