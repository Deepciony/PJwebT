import { existsSync, readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { projectFiles } from './project-files';

// The API listens on PORT from the repo .env (default 3000); follow it so both can move off a busy port.
const envFile = new URL('../../.env', import.meta.url);
const apiPort = process.env.PORT ?? (existsSync(envFile) ? readFileSync(envFile, 'utf8').match(/^PORT=(\d+)/m)?.[1] : undefined) ?? '3000';

// keep the browser's Host so the API document's server URL (and its Test Request) stays on this origin;
// 127.0.0.1, not localhost, so another program on the same port over IPv4 or IPv6 cannot answer instead
const api = { target: `http://127.0.0.1:${apiPort}`, changeOrigin: false };

export default defineConfig({
  plugins: [react(), tailwindcss(), projectFiles()],
  server: {
    port: 5173,
    proxy: { '/api': api, '/uploads': api, '/docs': api, '/openapi.json': api },
  },
});
