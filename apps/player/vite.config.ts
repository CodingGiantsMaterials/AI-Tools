import { VitePWA } from 'vite-plugin-pwa';
import { appConfig } from '../../vite.shared';

// The service worker's base and scope default to the Vite base that appConfig sets.
export default appConfig('Player', [VitePWA({
  strategies: 'generateSW',
  registerType: 'prompt',
  injectRegister: false,
  manifest: false,
  filename: 'sw.js',
  workbox: { globPatterns: ['**/*.{js,css,html,png}'] },
})]);
