import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';

const output = new URL('../dist/', import.meta.url);
const assets = (await readdir(new URL('assets/', output))).map(name => 'assets/' + name);
const files = ['index.html', 'icon.svg', 'manifest.webmanifest', ...assets].sort();
const template = await readFile(new URL('./worker-template.js', import.meta.url), 'utf8');
const hash = createHash('sha256').update(template);
for (const file of files) hash.update(file).update(await readFile(new URL(file, output)));
const worker = template.replace('__VERSION__', hash.digest('hex').slice(0, 16))
  .replace('/* FILES */ []', JSON.stringify(files.map(file => '/' + file)));
await writeFile(new URL('sw.js', output), worker);
