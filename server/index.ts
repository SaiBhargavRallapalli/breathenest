// ============================================================
// server/index.ts
// Process entry point: loads config, builds the app and listens.
// Kept separate from app.ts so tests never start a real listener.
// ============================================================

import { loadConfig } from './config';
import { createApp } from './app';

const config = loadConfig();
const app = createApp(config);

if (!config.isTest) {
  app.listen(config.port, () => {
    const mode = config.geminiApiKey ? 'Gemini + local fallback' : 'local planner (no API key set)';
    console.log(`[breathenest] listening on http://localhost:${config.port} — ${mode}`);
  });
}

export { app };
