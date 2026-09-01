import { loadConfig } from './config.js';
import { buildApp } from './app.js';
import { db } from './db.js';
const config = loadConfig();
const app = await buildApp(config);
const shutdown = async () => {
  await app.close();
  await db.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
await app.listen({ port: config.API_PORT, host: '0.0.0.0' });
