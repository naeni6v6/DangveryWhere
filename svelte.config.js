import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { readdirSync } from 'node:fs';

// Group photo directories so static files stay outside the Pages Functions quota.
const staticRoutes = readdirSync(new URL('./static/', import.meta.url), { withFileTypes: true }).map(
  (entry) => `/${entry.name}${entry.isDirectory() ? '/*' : ''}`
);

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      platformProxy: { persist: false },
      routes: { exclude: ['<build>', '<prerendered>', '/service-worker.js', ...staticRoutes] }
    })
  }
};
