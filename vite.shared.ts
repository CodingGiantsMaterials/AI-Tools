import { defineConfig, type Plugin, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

const developmentCsp: Plugin = {
  name: 'development-csp',
  apply: 'serve',
  transformIndexHtml: (html) => html
    .replace("script-src 'self' 'wasm-unsafe-eval'", "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'")
    .replace("style-src 'self'", "style-src 'self' 'unsafe-inline'"),
};

/** The application name is the case-sensitive published directory under /AI-Tools/. */
export function appConfig(app: 'Album' | 'Player', plugins: PluginOption[] = []) {
  return defineConfig({
    base: `/AI-Tools/${app}/`,
    build: { outDir: `../../dist/${app}`, emptyOutDir: true },
    plugins: [react(), basicSsl(), developmentCsp, ...plugins],
    worker: { format: 'es' },
  });
}
