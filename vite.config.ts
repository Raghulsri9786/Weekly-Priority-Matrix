import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
  },
  build: {
    target: 'esnext'
  },
  server: {
    port: 3000,
    host: '0.0.0.0'
  },
  preview: {
    port: parseInt(process.env.PORT || "3000"),
    host: '0.0.0.0'
  }
});