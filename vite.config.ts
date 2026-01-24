
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Support both API_KEY (default) and GEMINI_API_KEY (common in Vercel)
        'process.env.API_KEY': JSON.stringify(env.API_KEY || env.GEMINI_API_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve('.'),
        }
      },
      build: {
        outDir: 'dist',
        sourcemap: false
      }
    };
});
