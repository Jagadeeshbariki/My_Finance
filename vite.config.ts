import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Ensures assets load correctly on GitHub Pages and other subfolder-based hosting
  base: './',
  define: {
    // Specifically shim needed variables for browser context
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'recharts'],
          genai: ['@google/genai']
        }
      }
    }
  },
  server: {
    port: 3000,
    strictPort: true,
  }
});