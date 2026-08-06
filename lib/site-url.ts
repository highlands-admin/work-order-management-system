import 'server-only'

// Base URL used to build absolute links in outgoing email.
//
// SITE_URL is read from the server environment at request time, so changing the
// canonical domain is an edit to /var/www/wo/.env plus a reload. NEXT_PUBLIC_
// values are inlined into the bundle during next build, so the older
// NEXT_PUBLIC_SITE_URL required a full rebuild to change and is kept only as a
// fallback for existing deployments. Nothing in the browser calls this, which is
// why the runtime variable does not need the NEXT_PUBLIC_ prefix.
export function getSiteUrl(): string {
  const configured = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL
  if (configured) {
    return configured.replace(/\/$/, '')
  }
  return 'http://localhost:3000'
}
