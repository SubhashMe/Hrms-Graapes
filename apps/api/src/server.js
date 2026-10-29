import { env } from './config/env.js';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';

const app = createApp({ checkDb: () => prisma.$queryRaw`SELECT 1` });

const server = app.listen(env.API_PORT, () => {
  console.log(`Graapes HRMS API listening on http://localhost:${env.API_PORT}`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
