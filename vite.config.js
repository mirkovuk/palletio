import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * `base` must match the repository name when deploying to a GitHub project
 * page (username.github.io/palletio/). Set it to '/' for a user page or a
 * custom domain.
 */
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES_BASE || '/palletio/',
  build: { outDir: 'dist', sourcemap: false },
});
