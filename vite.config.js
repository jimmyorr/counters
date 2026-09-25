import { defineConfig } from 'vite';
import fs from 'fs';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
const manifestData = JSON.parse(fs.readFileSync('./public/manifest.json', 'utf-8'));

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'icon-512.png'],
      manifest: manifestData
    })
  ]
});
