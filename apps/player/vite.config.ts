import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { appConfig } from '../../vite.shared';

// The service worker's base and scope default to the Vite base that appConfig sets.
const baseConfig = appConfig('Player', [VitePWA({
  strategies: 'generateSW',
  registerType: 'prompt',
  injectRegister: false,
  manifest: false,
  filename: 'sw.js',
  workbox: { globPatterns: ['**/*.{js,css,html,png}'] },
})]);

export default mergeConfig(baseConfig, {
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        demo: fileURLToPath(new URL('demo/index.html', import.meta.url)),
      },
    },
  },
});
