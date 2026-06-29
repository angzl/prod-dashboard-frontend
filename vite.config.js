import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,              // разрешаем доступ с любого хоста
    allowedHosts: [
      'localhost',
      '.ngrok-free.dev'      // разрешаем все поддомены ngrok
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
});