import { NextResponse, type NextRequest } from 'next/server'

import { presignRequestSchema } from '@/lib/schemas/attachment'
import { generateObjectKey, presignUploadUrl } from '@/lib/storage/s3'
import { createClient } from '@/lib/supabase/server'

// The AWS SDK relies on Node APIs, so this handler must run on the Node
// runtime, not the Edge runtime.
export const runtime = 'nodejs'

// Presigning is the one upload case AGENTS.md routes through an API endpoint:
// the browser asks for a short-lived PUT URL, then uploads the file straight to
// MinIO. No file bytes pass through this handler, so Vercel's request body
// limit does not apply to the upload itself.
export async function POST(request: NextRequest): Promise<Response> {
  const supabase = await createClient()
  const { data: claimData } = await supabase.auth.getClaims()
  if (!claimData?.claims?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const parsed = presignRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request.' },
      { status: 400 }
    )
  }

  // The key is generated server-side so the client cannot choose where the
  // object lands. The row that links this key to a work order is inserted later
  // by the create/update action, gated by RLS.
  const key = generateObjectKey(parsed.data.filename)

  try {
    const uploadUrl = await presignUploadUrl(key, parsed.data.contentType)
    return NextResponse.json({ key, uploadUrl })
  } catch (error) {
    console.error('Failed to presign attachment upload', error)
    return NextResponse.json(
      { error: 'Could not prepare the upload.' },
      { status: 500 }
    )
  }
}
