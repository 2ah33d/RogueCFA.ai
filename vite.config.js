import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

let commitSha = 'dev';
try {
  commitSha = (process.env.VERCEL_GIT_COMMIT_SHA || execSync('git rev-parse --short HEAD').toString()).slice(0, 7);
} catch {}

export default defineConfig({
  plugins: [react()],
  define: {
    __COMMIT_SHA__: JSON.stringify(commitSha),
  },
});
