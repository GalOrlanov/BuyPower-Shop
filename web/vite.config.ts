import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/shop/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/shop/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/shop/, ''),
      },
    },
  },
});
