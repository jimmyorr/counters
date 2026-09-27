import { defineConfig } from 'vite';
import fs from 'fs';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'child_process';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
const manifestData = JSON.parse(fs.readFileSync('./public/manifest.json', 'utf-8'));

// Files the release workflow modifies; they don't affect the web source
const releaseFiles = ['package.json', 'package-lock.json', 'RELEASE_NOTES.md'];
const releaseDirs = ['docs/', 'ios/', 'android/'];

function getGitInfo(isBuild = false) {
  let commitHash = 'unknown';
  try {
    // Use the latest source commit rather than HEAD so the release commit
    // (build output + version bump) doesn't change the hash on rebuild
    const excludes = [...releaseFiles, ...releaseDirs]
      .map((p) => `':(exclude)${p}'`)
      .join(' ');
    commitHash =
      execSync(`git log -1 --format=%h -- . ${excludes}`).toString().trim() ||
      'unknown';
  } catch {
    // fallback if git is unavailable
  }

  let isDirty = false;
  try {
    const status = execSync('git status --porcelain', {
      encoding: 'utf-8',
    });
    if (status.trim()) {
      const lines = status.split('\n').filter((l) => l.length > 0);
      const dirtyFiles = lines
        .map((line) => {
          const match = line.match(/^.. (.+)$/);
          if (!match) return line.trim();
          const filePath = match[1].trim();
          if (filePath.includes(' -> ')) {
            return filePath.split(' -> ')[1].trim();
          }
          return filePath;
        })
        .filter((file) => {
          // Always ignore build output directory
          if (file.startsWith('docs/')) return false;
          // During production builds, ignore files modified as part of the release workflow
          if (isBuild) {
            if (
              releaseFiles.includes(file) ||
              releaseDirs.some((dir) => file.startsWith(dir))
            ) {
              return false;
            }
          }
          return true;
        });
      isDirty = dirtyFiles.length > 0;
    }
  } catch {
    // fallback if git is unavailable
  }

  const version = pkg.version || '0.0.0';

  return { commitHash, isDirty, version };
}

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  optimizeDeps: {
    // Only scan the app entry; otherwise Vite crawls the built copies under
    // ios/ and android/ and fails on their externalized imports
    entries: ['index.html'],
  },
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    rollupOptions: {
      external: ['firebase/analytics'],
    },
  },
  plugins: [
    {
      name: 'dynamic-git-info',
      transformIndexHtml: {
        order: 'pre',
        handler(html, ctx) {
          const isBuild = !ctx.server;
          const { commitHash, isDirty, version } = getGitInfo(isBuild);
          return [
            {
              tag: 'script',
              children: `window.__APP_VERSION__ = ${JSON.stringify(version)};\nwindow.__COMMIT_HASH__ = ${JSON.stringify(commitHash)};\nwindow.__IS_DIRTY__ = ${JSON.stringify(isDirty)};`,
              injectTo: 'head-prepend',
            },
          ];
        },
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'icon-512.png'],
      manifest: manifestData,
      workbox: {
        // Precache the bundled Latin font files so text renders offline
        globPatterns: ['**/*.{js,css,html}', '**/*latin*-wght-normal-*.woff2'],
      },
    })
  ]
});
