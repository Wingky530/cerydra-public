import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://cerydra.my.id',
  output: 'server',
  integrations: [
    react(),
    tailwind(),
    sitemap(),
    {
      name: 'append-sitemap',
      hooks: {
        'astro:build:done': async ({ dir }) => {
          const fs = await import('fs');
          const path = await import('path');
          const indexPath = path.join(new URL(dir).pathname, 'sitemap-index.xml');
          console.log('[append-sitemap] Looking for', indexPath);
          if (fs.existsSync(indexPath)) {
            let content = fs.readFileSync(indexPath, 'utf-8');
            console.log('[append-sitemap] Found sitemap! Modifying...');
            if (!content.includes('sitemap-anime.xml')) {
              content = content.replace('</sitemapindex>', '  <sitemap>\n    <loc>https://cerydra.my.id/api/sitemap-anime.xml</loc>\n  </sitemap>\n</sitemapindex>');
              fs.writeFileSync(indexPath, content);
            }
          } else {
            console.log('[append-sitemap] Sitemap not found at', indexPath);
          }
        }
      }
    }
  ],
  adapter: vercel({
    webAnalytics: { enabled: true },
  }),
  vite: {
    ssr: {
      noExternal: ['react-transition-group'],
    },
    server: {
      allowedHosts: true,
      hmr: {
        overlay: false,
      },
    },
  },
});
