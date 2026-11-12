import { readFile, writeFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { stdout } from 'node:process';

const file = new URL('../packages/shared/src/version.ts', import.meta.url);
const source = await readFile(file, 'utf8');
const match = source.match(/export const BUILD_NUMBER = (\d+);/);
if (!match) throw new Error('BUILD_NUMBER was not found');
const current = Number(match[1]);
const next = current + 1;
await writeFile(file, source.replace(`export const BUILD_NUMBER = ${current};`, `export const BUILD_NUMBER = ${next};`));
stdout.write(`Build incremented: ${current} → ${next}\n`);
