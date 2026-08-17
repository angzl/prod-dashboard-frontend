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
  },
  build: {
    // Разбиваем вендорный код на отдельные чанки для лучшего кеширования
    // в браузере: react и react-select меняются редко, их можно держать
    // в отдельном файле, который не инвалидируется при правках бизнес-логики.
    // В Vite 8 (rolldown) manualChunks — это функция, а не объект.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // plotly.js (~3.5 МБ) и react-plotly.js НЕ группируем в vendor —
            // они должны остаться в lazy-чанках Graph/MultiGraph и грузиться
            // только при открытии вкладок с графиками.
            if (id.includes('plotly')) return undefined;
            if (id.includes('react-select') || id.includes('@emotion') || id.includes('@floating-ui')) {
              return 'react-select';
            }
            // Проверяем точный путь к react/react-dom, чтобы случайно не
            // захватить react-plotly.js и другие react-* библиотеки.
            if (/node_modules[\\/]react[\\/]/.test(id) ||
                /node_modules[\\/]react-dom[\\/]/.test(id) ||
                id.includes('scheduler')) {
              return 'react-vendor';
            }
          }
        },
      },
    },
    // plotly.js ~3.5 МБ даже после минификации — поднимаем порог предупреждения
    chunkSizeWarningLimit: 5000,
  },
});