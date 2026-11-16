import 'dotenv/config';
import { loadConfig } from './config.js';
import { buildApp } from './app.js';
import { db } from './db.js';

const start = async () => {
  const config = loadConfig();
  const app = await buildApp(config);
  let discoveryTimer: NodeJS.Timeout | null = null;
  const shutdown = async () => {
    if (discoveryTimer) clearInterval(discoveryTimer);
    await app.close();
    await db.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const port = Number(process.env.PORT ?? config.API_PORT);
  await app.listen({ port, host: '0.0.0.0' });

  if (config.LEAD_DISCOVERY_CRON_SECRET) {
    const runDueDiscovery = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/internal/lead-discovery/run-due`, {
          method: 'POST',
          headers: { authorization: `Bearer ${config.LEAD_DISCOVERY_CRON_SECRET}` },
        });
        if (!response.ok) {
          app.log.error({ statusCode: response.status }, 'Lead discovery scheduler request failed');
          return;
        }
        const result = (await response.json()) as { processed?: number };
        if (result.processed) app.log.info(result, 'Processed scheduled lead discovery profiles');
      } catch (error) {
        app.log.error({ err: error }, 'Lead discovery scheduler failed');
      }
    };

    setTimeout(() => void runDueDiscovery(), 5_000).unref();
    discoveryTimer = setInterval(
      () => void runDueDiscovery(),
      config.LEAD_DISCOVERY_POLL_INTERVAL_MINUTES * 60_000,
    );
    discoveryTimer.unref();
  }
};

void start().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
