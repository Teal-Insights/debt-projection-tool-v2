import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path strategy:
//   - Local dev / preview:  VITE_BASE_PATH not set → defaults to './' (relative
//     paths so file:// previews and dev server both work)
//   - GitHub Pages deploy: the deploy workflow sets VITE_BASE_PATH to
//     '/<repo-name>/' so asset URLs resolve at https://<user>.github.io/<repo-name>/
//
// To deploy to a custom domain, set VITE_BASE_PATH=/ in the workflow.
const BASE_PATH = process.env.VITE_BASE_PATH ?? './';

export default defineConfig({
  plugins: [react()],
  base: BASE_PATH,
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
