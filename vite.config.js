import { defineConfig } from 'vite';

export default defineConfig({
  base: '/editorv2/',
  server: {
    port: 5176,
    strictPort: true, // 若 Port 被佔用，將拋出錯誤而不是換一個
    proxy: {
      '/api/clipdrop': {
        target: 'https://clipdrop-api.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/clipdrop/, '')
      }
    }
  },
});
