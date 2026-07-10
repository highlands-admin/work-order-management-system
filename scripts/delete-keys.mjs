// Dev utility: delete specific attachment objects from the MinIO bucket by key.
//
//   node scripts/delete-keys.mjs work-orders/<uuid>.jpg work-orders/<uuid>.png
//
// Keys present in the bucket are reported and deleted; keys that are not found
// are reported and skipped. Reads S3 credentials from .env.local.

import { existsSync, readFileSync } from 'node:fs'

import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3'

const PREFIX = 'work-orders/'

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

const requested = process.argv.slice(2).filter(Boolean)
if (requested.length === 0) {
  console.error('Pass one or more object keys to delete.')
  process.exit(1)
}

loadEnv('.env.local')

const s3 = new S3Client({
  endpoint: requireEnv('S3_ENDPOINT'),
  region: process.env.S3_REGION ?? 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: requireEnv('S3_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY'),
  },
})
const bucket = requireEnv('S3_BUCKET')

// List what is actually in the bucket so we can distinguish present from
// missing keys (S3 delete is idempotent and would not tell us otherwise).
const present = new Set()
let continuationToken
do {
  const res = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: PREFIX,
      ContinuationToken: continuationToken,
    })
  )
  for (const object of res.Contents ?? []) present.add(object.Key)
  continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
} while (continuationToken)

const toDelete = requested.filter((key) => present.has(key))
const missing = requested.filter((key) => !present.has(key))

if (missing.length > 0) {
  console.log(`Not found (skipped): ${missing.length}`)
  for (const key of missing) console.log(`  ${key}`)
}

if (toDelete.length === 0) {
  console.log('Nothing to delete.')
  process.exit(0)
}

await s3.send(
  new DeleteObjectsCommand({
    Bucket: bucket,
    Delete: { Objects: toDelete.map((Key) => ({ Key })) },
  })
)

console.log(`Deleted: ${toDelete.length}`)
for (const key of toDelete) console.log(`  ${key}`)
