import 'server-only'

import { randomUUID } from 'node:crypto'
import { extname } from 'node:path'

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import type { AllowedAttachmentType } from '@/lib/schemas/attachment'

// How long a presigned URL stays valid. Uploads are immediate, so the PUT
// window is short. Display URLs are minted per page render, so an hour balances
// page lifetime against keeping links from being shared long after the fact.
const PUT_URL_TTL_SECONDS = 600
const GET_URL_TTL_SECONDS = 3600

// All attachment objects live under one prefix in the bucket, which keeps a
// later MinIO lifecycle rule (for orphan cleanup) simple to target.
const OBJECT_PREFIX = 'work-orders'

let cachedClient: S3Client | null = null

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

// MinIO is reached over a custom endpoint and needs path-style addressing
// (bucket in the path, not the hostname), unlike AWS S3's virtual-host style.
function getClient(): S3Client {
  if (cachedClient) return cachedClient
  cachedClient = new S3Client({
    endpoint: requireEnv('S3_ENDPOINT'),
    region: process.env.S3_REGION ?? 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: requireEnv('S3_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY'),
    },
  })
  return cachedClient
}

export function getBucket(): string {
  return requireEnv('S3_BUCKET')
}

// A random, unguessable key keeps the object name from leaking the original
// filename and avoids collisions. The extension is preserved so the object is
// recognizable in the bucket.
export function generateObjectKey(filename: string): string {
  const ext = extname(filename).toLowerCase().slice(0, 10)
  return `${OBJECT_PREFIX}/${randomUUID()}${ext}`
}

// Presigned PUT URL the browser uploads to directly, bypassing the app server
// (and Vercel's request body limit). The browser must send the same
// Content-Type it was signed with.
export async function presignUploadUrl(
  key: string,
  contentType: AllowedAttachmentType
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(getClient(), command, { expiresIn: PUT_URL_TTL_SECONDS })
}

// Presigned GET URL for displaying a private object. Minted on the server when
// rendering an authenticated page, so only someone who loaded that page gets a
// working link.
export async function presignDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: key })
  return getSignedUrl(getClient(), command, { expiresIn: GET_URL_TTL_SECONDS })
}

// Removes objects from the bucket. Used when an attachment is detached from a
// work order during editing. No-ops on an empty list.
export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  await getClient().send(
    new DeleteObjectsCommand({
      Bucket: getBucket(),
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    })
  )
}
