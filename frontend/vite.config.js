import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://192.168.31.86:3001',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://192.168.31.86:3001',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://192.168.31.86:3001',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
