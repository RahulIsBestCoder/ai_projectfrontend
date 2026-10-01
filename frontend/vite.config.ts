import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@app': path.resolve(__dirname, './src/app'),
      '@core': path.resolve(__dirname, './src/app/core'),
      '@pages': path.resolve(__dirname, './src/app/pages'),
      '@store': path.resolve(__dirname, './src/app/store'),
      '@env': path.resolve(__dirname, './src/environments'),
      '@shared': path.resolve(__dirname, './src/app/shared'),
    },
  },
  server: {
    host: '0.0.0.0',
    // Never bind 3000: the backend API owns it (backend/.env PORT=3000). If Vite
    // won that port the SPA's own API calls (VITE_API_BASE_URL=http://localhost:3000/v1)
    // would hit Vite instead of Express, the response envelope would be missing and
    // every screen would silently render empty with no visible error. `strictPort`
    // makes a taken port fail loudly rather than drifting to 3001/3002.
    port: 5173,
    strictPort: true,
  },
});
