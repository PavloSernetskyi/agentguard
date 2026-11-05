import { defineConfig } from 'vite';
export default defineConfig({
  server: { port: 5174, strictPort: true, proxy: { '/soc-api': 'http://127.0.0.1:8001' } },
  preview: { port: 4174, strictPort: true },
});
