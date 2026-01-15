Multi-Tenant Upgrade Notes
==========================

What I changed:
- Added a migration to create `organizations` and add `org_id` columns to key tables: `supabase/migrations/20260114120000_add_organizations_and_org_id.sql`.
- Updated TypeScript DB types: `src/lib/database.types.ts` (added `organizations` and `org_id` fields, expanded roles).
- Extended `AuthContext` to include `org_id` in `profile`, exposed `orgId`, and support org-scoped signup.
- Added `CreateOrganization` page/component for onboarding a new org and initial admin.
- Added `OrganizationSettings` component to manage branding (logo + primary color).
- Wired the landing page to open the Create Organization modal.

Important next steps (must be done manually or via CI):
1. Run the new migration against your database (supabase migrate or psql).
2. Add Row-Level Security (RLS) policies on each table to enforce `org_id` scoping — e.g., allow select/insert/update only when `org_id = current_setting('request.jwt.claims.org_id')` or use Supabase policies referencing `auth.jwt()` claims.
3. Adjust Supabase auth JWT to include `org_id` claim on sign-in or implement a server-side function to issue scoped tokens.
4. Review service-role usage: creating organizations and setting `org_id` server-side should use the service role key.
5. Add storage bucket `org-uploads` for logo uploads and configure public access if desired.
6. Update frontend data fetches (events, employees, shifts, beos) to include `.eq('org_id', orgId)` using `useAuth().orgId`.
7. Harden API and functions so clients cannot create orgs or assign `org_id` without proper validation.

Security notes:
- Do not rely solely on client-side inserts for organizations or profiles — use server-side checks.
- Rotate any service role keys if they were used during testing.
