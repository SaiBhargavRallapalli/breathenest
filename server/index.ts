// ============================================================
// server/index.ts
// Process entry point: loads config, builds the app and listens.
// Kept separate from app.ts so tests never start a real listener.
// ============================================================

import { loadConfig } from './config';
import { createApp, engineLabel } from './app';

const config = loadConfig();
const app = createApp(config);

if (!config.isTest) {
  app.listen(config.port, () => {
    console.log(`[breathenest] listening on http://localhost:${config.port} — ${engineLabel(config)}`);
  });
}

export { app };
