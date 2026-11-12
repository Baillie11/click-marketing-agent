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
const port = Number(process.env.PORT ?? config.API_PORT);
await app.listen({ port, host: '0.0.0.0' });
