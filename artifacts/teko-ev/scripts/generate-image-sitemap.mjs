// Writes sitemap-images.xml after `vite build`.
//
// The model photos are imported from src, so Vite emits them with content
// hashes that change whenever a photo changes. A static sitemap in public/
// cannot name those files, so this reads the build manifest and resolves the
// real emitted paths, then deletes the manifest so it is not served.

import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

const SITE_URL = process.env.SITE_URL ?? 'https://tekodealership.com';
const OUT_DIR = path.resolve(import.meta.dirname, '..', 'dist', 'public');
const MANIFEST = path.join(OUT_DIR, '.vite', 'manifest.json');

// Model photos live at attached_assets/teko-ev/<slug>/image.jpg; the directory
// name is the model slug, which is also its route.
const MODEL_IMAGE = /teko-ev\/([^/]+)\/image\.jpg$/;

const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));

const images = new Map();
for (const [source, entry] of Object.entries(manifest)) {
  const slug = source.match(MODEL_IMAGE)?.[1];
  if (slug && entry.file) images.set(slug, `${SITE_URL}/${entry.file}`);
}

if (images.size === 0) {
  // Better to fail the build than to publish an empty sitemap: Search Console
  // reports one as an error.
  console.error('generate-image-sitemap: no model images found in the build manifest');
  process.exit(1);
}

// Each photo is listed under every page it appears on. The home and models
// pages both render the full set of model cards; each model page shows its own.
const pages = [
  { loc: `${SITE_URL}/`, images: [...images.values()] },
  { loc: `${SITE_URL}/models`, images: [...images.values()] },
  ...[...images].map(([slug, image]) => ({
    loc: `${SITE_URL}/models/${slug}`,
    images: [image],
  })),
];

const body = pages
  .map(page => {
    const tags = page.images.map(image => `    <image:image><image:loc>${image}</image:loc></image:image>`).join('\n');
    return `  <url>\n    <loc>${page.loc}</loc>\n${tags}\n  </url>`;
  })
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${body}
</urlset>
`;

await writeFile(path.join(OUT_DIR, 'sitemap-images.xml'), xml);
await rm(path.join(OUT_DIR, '.vite'), { recursive: true, force: true });

const total = pages.reduce((n, page) => n + page.images.length, 0);
console.log(`sitemap-images.xml: ${pages.length} pages, ${total} image references`);
