import { defineConfig } from 'vite';
const proxy = {
    '/api': { target: 'http://localhost:5080', changeOrigin: false },
    '/openapi': { target: 'http://localhost:5080', changeOrigin: false },
    '/health': { target: 'http://localhost:5080', changeOrigin: false },
};
export default defineConfig({
  server: { port: 5173, strictPort: true, proxy },
  preview: { port: 5173, strictPort: true, proxy },
});
