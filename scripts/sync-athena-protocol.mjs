import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const protocolRoot = process.env.ATHENA_PROTOCOL_ROOT
  ? resolve(process.env.ATHENA_PROTOCOL_ROOT)
  : resolve(projectRoot, '../../athena-protocol');
const sourcePath = resolve(protocolRoot, 'typescript/athena-protocol-v5.ts');
const targetPath = resolve(projectRoot, 'src/generated/athena-protocol-v5.ts');
const source = await readFile(sourcePath, 'utf8');

if (process.argv.includes('--check')) {
  const target = await readFile(targetPath, 'utf8');
  if (source !== target) {
    console.error(`Generated protocol types are stale. Run: npm run protocol:sync\nSource: ${sourcePath}`);
    process.exitCode = 1;
  }
} else {
  await writeFile(targetPath, source, 'utf8');
  console.log(`Synced Athena Protocol v5 types from ${sourcePath}`);
}
