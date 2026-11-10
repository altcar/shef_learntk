import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

import starlight from '@astrojs/starlight';
import vercel from '@astrojs/vercel';
import tailwind from '@astrojs/tailwind';

const LESSONS_DIR = fileURLToPath(new URL('./src/assets/lessons', import.meta.url));
const LESSON_MODULE = 'virtual:learntk-lessons';

/**
 * Course PDFs must never end up in the public directory, otherwise they are
 * served as static files before Astro or its middleware ever run.
 *
 * This plugin inlines them into a lazily imported server-only module, so
 * `/api/lessons/:file` can stream them after the session has been verified.
 */
function lessonAssets() {
  return {
    name: 'learntk-lesson-assets',
    resolveId(id) {
      if (id === LESSON_MODULE) return `\0${LESSON_MODULE}`;
      return null;
    },
    load(id) {
      if (id !== `\0${LESSON_MODULE}`) return null;

      if (!fs.existsSync(LESSONS_DIR)) return 'export default {};';

      const files = fs
        .readdirSync(LESSONS_DIR)
        .filter((file) => !file.startsWith('.'));

      const entries = files.map((file) => {
        const data = fs.readFileSync(path.join(LESSONS_DIR, file)).toString('base64');
        return `  ${JSON.stringify(file)}: ${JSON.stringify(data)}`;
      });

      return `export default {\n${entries.join(',\n')}\n};`;
    },
  };
}

// https://astro.build/config
const SITE_ORIGIN = process.env.SITE_URL ?? 'https://learntk.vercel.app';

/**
 * Astro only trusts the Host / X-Forwarded-* headers for domains listed here.
 * With the default empty list the request URL becomes `https://localhost`,
 * which breaks `Astro.url.origin` behind Vercel's proxy — notably Astro's
 * built-in CSRF check, which rejects every same-origin form POST.
 */
function allowedDomains() {
  let siteHostname = 'learntk.vercel.app';
  try {
    siteHostname = new URL(SITE_ORIGIN).hostname;
  } catch {
    /* keep the default */
  }

  return [
    { hostname: siteHostname, protocol: 'https' },
    // Preview and branch deployments: <project>-<hash>-<team>.vercel.app
    { hostname: '**.vercel.app', protocol: 'https' },
    { hostname: 'localhost', protocol: 'http' },
    { hostname: '127.0.0.1', protocol: 'http' },
  ];
}

export default defineConfig({
  site: SITE_ORIGIN,
  output: 'server',

  security: {
    checkOrigin: true,
    allowedDomains: allowedDomains(),
  },

  vite: {
    plugins: [lessonAssets()],
  },

  integrations: [
    starlight({
      // Course pages must be rendered on demand so the auth middleware can run.
      // With `prerender: true` (Starlight's default) every lesson is a static
      // HTML file and is readable by anyone with the URL.
      prerender: false,
      pagefind: false,
      disable404Route: true,
      title: 'code creators',
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Beginner · Python Foundations',
          autogenerate: { directory: '24b' },
        },
        {
          label: 'Advanced · Python in Practice',
          autogenerate: { directory: 'advanced' },
        },
      ],
    }),
    tailwind(),
  ],

  adapter: vercel(),
});
