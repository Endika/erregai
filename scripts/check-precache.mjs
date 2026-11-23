// The service worker answers every navigation with index.html, and Workbox refuses to install a
// worker whose fallback is not precached: an empty manifest would leave installed apps stuck on
// an old release without any error at build time.
import { readFileSync } from 'node:fs'

const sw = readFileSync('dist/sw.js', 'utf8')
const urls = [...sw.matchAll(/url:"([^"]+)"/g)].map((m) => m[1])
const needs = {
  'index.html': urls.includes('index.html'),
  'a script': urls.some((u) => u.endsWith('.js')),
  'a stylesheet': urls.some((u) => u.endsWith('.css')),
}
const missing = Object.keys(needs).filter((need) => !needs[need])
if (missing.length > 0) {
  console.error(`dist/sw.js precaches ${urls.length} files and lacks: ${missing.join(', ')}`)
  process.exit(1)
}
console.log(`dist/sw.js precaches ${urls.length} files, index.html included`)
