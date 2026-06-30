import { NextResponse, type NextRequest } from 'next/server'

import { deleteObjects } from '@/lib/storage/s3'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// Deletes a freshly uploaded object that has not yet been saved to a work
// order. The uploader calls this when the user removes an image before
// submitting the form, so an abandoned upload does not linger in the bucket.
//
// It refuses to delete an object already linked to a work order: those are
// removed through the work order edit flow, where RLS authorizes the change.
// That guard means this endpoint cannot be used to wipe saved attachments.
export async function DELETE(request: NextRequest): Promise<Response> {
  const supabase = await createClient()
  const { data: claimData } = await supabase.auth.getClaims()
  if (!claimData?.claims?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const key = request.nextUrl.searchParams.get('key')
  if (!key || !key.startsWith('work-orders/')) {
    return NextResponse.json({ error: 'Invalid key.' }, { status: 400 })
  }

  const { data: linked } = await supabase
    .from('work_order_attachments')
    .select('id')
    .eq('object_key', key)
    .maybeSingle()
  if (linked) {
    return NextResponse.json(
      { error: 'Attachment is linked to a work order.' },
      { status: 409 }
    )
  }

  try {
    await deleteObjects([key])
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Failed to delete attachment object', error)
    return NextResponse.json(
      { error: 'Could not delete the object.' },
      { status: 500 }
    )
  }
}
