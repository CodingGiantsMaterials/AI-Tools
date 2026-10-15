import { defineConfig, type Plugin, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

/** Vite's development client needs inline scripts and styles, whatever else the directives allow. */
function allowInline(policy: string): string {
  return policy.split(';').map((directive) => /^\s*(script|style)-src(\s|$)/i.test(directive) && !directive.includes("'unsafe-inline'")
    ? `${directive.trimEnd()} 'unsafe-inline'` : directive).join(';');
}

const developmentCsp: Plugin = {
  name: 'development-csp',
  apply: 'serve',
  transformIndexHtml: (html) => html.replace(/<meta\s[^>]*http-equiv="Content-Security-Policy"[^>]*>/i,
    (tag) => tag.replace(/content="([^"]*)"/, (_, policy: string) => `content="${allowInline(policy)}"`)),
};

/** The application name is the case-sensitive published directory under /AI-Tools/. */
export function appConfig(app: 'Album' | 'Player', plugins: PluginOption[] = []) {
  // Chrome rejects service worker registration with the self-signed certificate, so the Player preview stays on HTTP.
  const https: Plugin = { ...basicSsl(), apply: (_, env) => app !== 'Player' || !env.isPreview };
  return defineConfig({
    base: `/AI-Tools/${app}/`,
    build: { outDir: `../../dist/${app}`, emptyOutDir: true },
    plugins: [react(), https, developmentCsp, ...plugins],
    // Linked workspace packages must import the application's React, even if their real path differs in case.
    resolve: { dedupe: ['react', 'react-dom'] },
    worker: { format: 'es' },
  });
}
