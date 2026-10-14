import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  base: '/AI-Tools/',
  plugins: [react(), basicSsl(), {
    name: 'development-csp',
    apply: 'serve',
    transformIndexHtml: (html) => html
      .replace("script-src 'self' 'wasm-unsafe-eval'", "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'")
      .replace("style-src 'self'", "style-src 'self' 'unsafe-inline'"),
  }],
  worker: { format: 'es' },
});
