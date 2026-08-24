// Runs after `vite build`.
//
// The app is client-rendered, so without this every SEO signal — title,
// description, canonical, Open Graph — only exists once JavaScript has run.
// This writes a real <head> into a static HTML file per route, and builds the
// image sitemap, which needs the same build manifest.

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const SITE_URL = process.env.SITE_URL ?? 'https://tekodealership.com';
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist', 'public');
const MANIFEST = path.join(OUT_DIR, '.vite', 'manifest.json');

// Model photos live at attached_assets/teko-ev/<slug>/image.jpg; the directory
// name is the model slug, which is also its route.
const MODEL_IMAGE = /teko-ev\/([^/]+)\/image\.jpg$/;

const routes = JSON.parse(await readFile(path.join(ROOT, 'src', 'seo-routes.json'), 'utf8'));
const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
const template = await readFile(path.join(OUT_DIR, 'index.html'), 'utf8');

const images = new Map();
for (const [source, entry] of Object.entries(manifest)) {
  const slug = source.match(MODEL_IMAGE)?.[1];
  if (slug && entry.file) images.set(slug, `${SITE_URL}/${entry.file}`);
}

if (images.size === 0) {
  // Better to fail the build than to publish an empty sitemap: Search Console
  // reports one as an error.
  console.error('generate-static-seo: no model images found in the build manifest');
  process.exit(1);
}

const escape = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function headFor(route, meta, { indexable = true } = {}) {
  const url = route === '/' ? `${SITE_URL}/` : SITE_URL + route;
  const image = (meta.slug && images.get(meta.slug)) || `${SITE_URL}/og-image.png`;
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'TEKO Dealership',
    alternateName: 'TEKO EV',
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    description: meta.description,
  };
  return [
    `<title>${escape(meta.title)}</title>`,
    `<meta name="description" content="${escape(meta.description)}" />`,
    `<meta name="robots" content="${indexable ? 'index, follow' : 'noindex, follow'}" />`,
    ...(indexable ? [`<link rel="canonical" href="${url}" />`] : []),
    `<meta property="og:title" content="${escape(meta.title)}" />`,
    `<meta property="og:description" content="${escape(meta.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="TEKO Dealership" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta property="og:image" content="${image}" />`,
    ...(image.endsWith('/og-image.png')
      ? [`<meta property="og:image:width" content="1200" />`, `<meta property="og:image:height" content="630" />`, `<meta property="og:image:alt" content="TEKO Dealership" />`]
      : []),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escape(meta.title)}" />`,
    `<meta name="twitter:description" content="${escape(meta.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<script type="application/ld+json" id="teko-jsonld">${JSON.stringify(organization)}</script>`,
  ].join('\n    ');
}

// The template already carries the shared tags (icons, manifest, fonts). Drop
// the ones this replaces per route, then insert the route's own.
function pageFor(route, meta, options) {
  let html = template
    .replace(/<title>[^<]*<\/title>\s*/, '')
    .replace(/\s*<meta name="description"[^>]*>/, '')
    .replace(/\s*<meta property="og:(title|description|type|image|image:width|image:height|image:alt)"[^>]*>/g, '')
    .replace(/\s*<meta name="twitter:(card|title|description|image)"[^>]*>/g, '')
    .replace(/\s*<meta name="robots"[^>]*>/, '');
  return html.replace('</head>', `  ${headFor(route, meta, options)}\n  </head>`);
}

// Written as <route>.html rather than <route>/index.html: with the latter,
// Workers Assets 307-redirects /models/turbo to /models/turbo/, so every
// canonical and sitemap URL would resolve through a redirect.
let written = 0;
for (const [route, meta] of Object.entries(routes)) {
  const file = route === '/' ? path.join(OUT_DIR, 'index.html') : path.join(OUT_DIR, `${route}.html`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, pageFor(route, meta));
  written++;
}

await writeFile(path.join(OUT_DIR, '404.html'), pageFor('/404', {
  title: 'Page not found | TEKO Dealership',
  description: 'This page could not be found. Explore TEKO electric vehicles, dealers, and financing.',
}, { indexable: false }));

// Every photo is listed under each page it appears on: home and /models render
// the full set of cards, each model page shows its own.
const pages = [
  { loc: `${SITE_URL}/`, images: [...images.values()] },
  { loc: `${SITE_URL}/models`, images: [...images.values()] },
  ...[...images].map(([slug, image]) => ({ loc: `${SITE_URL}/models/${slug}`, images: [image] })),
];

const body = pages
  .map(page => {
    const tags = page.images.map(image => `    <image:image><image:loc>${image}</image:loc></image:image>`).join('\n');
    return `  <url>\n    <loc>${page.loc}</loc>\n${tags}\n  </url>`;
  })
  .join('\n');

await writeFile(path.join(OUT_DIR, 'sitemap-images.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${body}
</urlset>
`);

await rm(path.join(OUT_DIR, '.vite'), { recursive: true, force: true });

const total = pages.reduce((n, page) => n + page.images.length, 0);
console.log(`static SEO: ${written} routes with prerendered head tags, plus 404.html`);
console.log(`sitemap-images.xml: ${pages.length} pages, ${total} image references`);
