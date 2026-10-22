// Tells IndexNow search engines (Bing, Yandex and others; not Google) that the site's pages changed.
// Run after a deploy, once the new pages are live:  node indexnow.mjs
// It sends every URL in the sitemap. Only run it when pages actually changed.
import { readFileSync, readdirSync } from 'node:fs';

const STATIC = new URL('../src/main/resources/static/', import.meta.url);
const HOST = 'jsonxmleditor.com';

const keyFile = readdirSync(STATIC).find(f => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) throw new Error('No IndexNow key file (32 hex characters + .txt) in src/main/resources/static');
const key = keyFile.slice(0, -4);

const sitemap = readFileSync(new URL('sitemap.xml', STATIC), 'utf8');
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${keyFile}`, urlList }),
});
console.log(`IndexNow: ${res.status} ${res.statusText} for ${urlList.length} URLs`);
if (res.status >= 400) console.log(await res.text());
