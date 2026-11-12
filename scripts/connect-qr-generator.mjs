// Run locally with database access. The raw integration token is written only to private storage.
import { createRequire } from 'node:module';
import { randomBytes, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import dotenv from 'dotenv';
const root = fileURLToPath(new URL('../', import.meta.url));
dotenv.config({ path: join(root, '.env'), quiet: true });
const require = createRequire(join(root, 'apps/api/package.json'));
const { PrismaClient } = require('@prisma/client');
const [businessId, directory, url = 'http://127.0.0.1:4000'] = process.argv.slice(2);
if (!businessId || !directory) {
  console.error('Usage: node scripts/connect-qr-generator.mjs BUSINESS_ID ABSOLUTE_PRIVATE_DIRECTORY [API_URL]');
  process.exit(1);
}
const db = new PrismaClient();
let tokenId;
try {
  const business = await db.business.findUniqueOrThrow({ where: { id: businessId } });
  const token = randomBytes(32).toString('hex');
  const record = await db.integrationToken.create({ data: {
    businessId, name: 'QR Code Generator', tokenHash: createHash('sha256').update(token).digest('hex'),
  } });
  tokenId = record.id;
  await mkdir(resolve(directory), { recursive: true, mode: 0o700 });
  await writeFile(join(resolve(directory), 'click-marketing.json'), JSON.stringify({ url, businessId, token }), { flag: 'wx', mode: 0o600 });
  console.log(`QR Code Generator connected to ${business.name}. Private configuration saved; token not displayed.`);
} catch {
  if (tokenId) await db.integrationToken.delete({ where: { id: tokenId } });
  console.error('Connection setup failed. Check business ID, private directory and whether configuration already exists.');
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
