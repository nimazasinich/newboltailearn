import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Use VITE_BASE_PATH if provided (e.g. '/newboltailearn/'), otherwise '/'
  const base = env.VITE_BASE_PATH && env.VITE_BASE_PATH.trim() !== '' ? env.VITE_BASE_PATH : '/';

  return defineConfig({
    resolve: { 
      alias: { 
        '@': path.resolve(__dirname, 'src') 
      } 
    },
    plugins: [react()],
    base,
    server: {
      port: 5173,
      strictPort: true,
      host: true,
      proxy: {
        '/api': { target: 'http://localhost:8080', changeOrigin: true },
        '/ws':  { target: 'ws://localhost:8080',  changeOrigin: true, ws: true },
        '/health': { target: 'http://localhost:8080', changeOrigin: true }
      }
    },
    build: {
      outDir: 'docs',
      sourcemap: true,
      emptyOutDir: true
    }
  });
};