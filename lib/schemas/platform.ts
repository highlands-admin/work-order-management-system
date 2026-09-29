import * as z from 'zod'

// Consumer email providers. Registering one as an organization's signup domain
// would let anyone with an address there join that organization.
export const PUBLIC_EMAIL_DOMAINS = new Set([
  'aol.com',
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'icloud.com',
  'live.com',
  'mail.com',
  'me.com',
  'msn.com',
  'outlook.com',
  'proton.me',
  'protonmail.com',
  'yahoo.com',
  'ymail.com',
])

const DOMAIN_PATTERN = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/

// Blank means invitation only.
const signupDomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => v.replace(/^@/, ''))
  .refine((v) => v === '' || DOMAIN_PATTERN.test(v), {
    message: 'Enter a domain such as example.com',
  })
  .refine((v) => !PUBLIC_EMAIL_DOMAINS.has(v), {
    message: 'A public email provider cannot be a signup domain',
  })

const organizationNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a name')
  .max(80, 'Keep the name under 80 characters')

const optionalName = z.string().trim().max(50).optional().or(z.literal(''))

export const createOrganizationSchema = z.object({
  name: organizationNameSchema,
  domain: signupDomainSchema,
  adminEmail: z.email('Enter a valid email address'),
  adminFirstName: optionalName,
  adminLastName: optionalName,
})

export const updateOrganizationSchema = z.object({
  organizationId: z.uuid('Invalid organization'),
  name: organizationNameSchema,
  domain: signupDomainSchema,
})

export const inviteOrganizationAdminSchema = z.object({
  organizationId: z.uuid('Invalid organization'),
  email: z.email('Enter a valid email address'),
  firstName: optionalName,
  lastName: optionalName,
})

// Builds a URL-safe slug from an organization name ("Acme Senior Living"
// becomes "acme-senior-living"). Mirrors the check constraint on
// organizations.slug. Returns null when the name has no usable characters.
export function slugFromName(name: string): string | null {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '')
  return slug.length > 0 ? slug : null
}
