// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
// For Vercel deployment: replace adapter with @astrojs/vercel
// See docs/deployment.md for details
export default defineConfig({
  output: 'server',

  integrations: [react()],

  adapter: node({
    mode: 'standalone',
  }),

  vite: {
    plugins: [tailwindcss()],
  },
});