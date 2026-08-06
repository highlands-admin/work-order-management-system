import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Runs on every request except static files, image optimization files,
     * the favicon, and the cron routes.
     *
     * The cron routes are excluded because pg_cron calls them with a bearer
     * token and no session cookie. The session check in updateSession would
     * redirect those calls to /login, and pg_net does not follow redirects, so
     * the job would fail silently. Each cron route authenticates its own caller
     * against CRON_SECRET.
     */
    '/((?!api/cron|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
