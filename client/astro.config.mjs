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
export default defineConfig({
  site: 'https://learntk.vercel.app',
  output: 'server',

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
    }),
    tailwind(),
  ],

  adapter: vercel(),
});
