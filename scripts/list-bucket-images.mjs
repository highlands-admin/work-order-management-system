// Dev utility: list attachment objects in the MinIO bucket and build a local
// HTML gallery of presigned thumbnails. The MinIO console (port 9001) is often
// blocked by the server firewall, so this talks to the same S3 API endpoint the
// app already uses.
//
//   node scripts/list-bucket-images.mjs
//
// It reads credentials from .env.local (S3_ENDPOINT, S3_ACCESS_KEY_ID,
// S3_SECRET_ACCESS_KEY, S3_BUCKET, optional S3_REGION) and writes
// bucket-gallery.html in the current directory. The presigned URLs inside are
// valid for about an hour, so the file is disposable, do not commit it.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'

import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const PREFIX = 'work-orders/'
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|heic|heif)$/i
const OUT_FILE = 'bucket-gallery.html'

// Minimal .env loader so the script runs on any Node version without extra
// flags or dependencies. Existing environment variables win.
function loadEnv(file) {
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/)
    if (!match) continue
    const key = match[1]
    const value = match[2].replace(/^["']|["']$/g, '')
    if (!(key in process.env)) process.env[key] = value
  }
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name}. Run from the project root so .env.local is found.`)
  }
  return value
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )
}

loadEnv('.env.local')

const client = new S3Client({
  endpoint: requireEnv('S3_ENDPOINT'),
  region: process.env.S3_REGION ?? 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: requireEnv('S3_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY'),
  },
})
const bucket = requireEnv('S3_BUCKET')

const objects = []
let continuationToken
do {
  const res = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: PREFIX,
      ContinuationToken: continuationToken,
    })
  )
  for (const object of res.Contents ?? []) objects.push(object)
  continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
} while (continuationToken)

const images = objects.filter((o) => IMAGE_EXT.test(o.Key ?? ''))
console.log(
  `Found ${objects.length} objects under "${PREFIX}" (${images.length} images).`
)

const cards = []
for (const object of images) {
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: object.Key }),
    { expiresIn: 3600 }
  )
  const sizeKb = Math.round((object.Size ?? 0) / 1024)
  const modified = object.LastModified
    ? new Date(object.LastModified).toISOString()
    : ''
  cards.push(
    `<figure><a href="${url}" target="_blank" rel="noreferrer">` +
      `<img src="${url}" loading="lazy" alt="${escapeHtml(object.Key)}"></a>` +
      `<figcaption>${escapeHtml(object.Key)}<br>${sizeKb} KB · ${modified}</figcaption>` +
      `</figure>`
  )
}

const html = `<!doctype html>
<meta charset="utf-8">
<title>Bucket gallery</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; background: #0b0b0c; color: #e7e7e9; }
  h1 { font-size: 1.1rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
  figure { margin: 0; background: #17171a; border-radius: 10px; overflow: hidden; }
  img { width: 100%; height: 200px; object-fit: cover; display: block; background: #222; }
  figcaption { padding: .5rem .625rem; font-size: 12px; color: #a7a7ad; word-break: break-all; }
</style>
<h1>Bucket gallery — ${images.length} images (URLs valid ~1 hour)</h1>
<div class="grid">
${cards.join('\n')}
</div>`

writeFileSync(OUT_FILE, html)
console.log(`Wrote ${OUT_FILE}. Open it in a browser.`)
