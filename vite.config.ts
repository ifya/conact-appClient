// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';
// import path from 'path';

// export default defineConfig({
//   plugins: [react()],
//   resolve: {
//     alias: {
//       '@': path.resolve(__dirname, './src'),
//     },
//   },
// server: {
//   port: 5173,
//   proxy: {
//     '/api': {
//       target: 'https://cx.guendogan-consulting.de',
//       changeOrigin: true,
//       secure: true,
//     },
//     '/_matrix': {
//       target: 'https://cx.guendogan-consulting.de',
//       changeOrigin: true,
//       secure: true,
//     },
//   },
// },
//   build: {
//     outDir: 'dist',
//     sourcemap: true,
//   },
//   define: {
//     global: 'globalThis',
//   },
// });

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
  ],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://cx.guendogan-consulting.de',
        changeOrigin: true,
        secure: true,
      },
      '/_matrix': {
        target: 'https://cx.guendogan-consulting.de',
        changeOrigin: true,
        secure: true,
      },
    },
  },

  preview: {
    host: true, // listen on 0.0.0.0
    port: 4173,
    allowedHosts: ['conact-fe.guendogan-consulting.de'], // preview (4173)
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'esnext',
  },
  optimizeDeps: {
    exclude: ['@matrix-org/matrix-sdk-crypto-wasm'],
  },
  define: {
    global: 'globalThis',
  },
});