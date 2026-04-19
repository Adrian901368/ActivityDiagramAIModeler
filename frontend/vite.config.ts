// frontend/vite.config.ts
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    define: {
      __API_BASE_URL__: JSON.stringify(
        env.VITE_API_URL ?? 'http://localhost:8000'
      ),
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
    server: {
      port: 5173,
    },
  };
});