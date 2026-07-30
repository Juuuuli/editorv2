import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  base: '/editorv2/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
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
