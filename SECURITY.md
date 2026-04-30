# Security Policy

## Reporting a vulnerability

Please do **not** open a public GitHub issue for security vulnerabilities.

Email **security@domelayer.com** with:
- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- The affected file(s) or endpoint(s)

You will receive an acknowledgement within 48 hours and a resolution update within 7 days.

## Scope

This policy covers the `dome-data-intelligence` repository and its deployed instance at `https://data-intelligence.domelayer.com`.

## Out of scope

- Denial-of-service attacks
- Social engineering
- Issues in third-party dependencies (report those upstream)

## Contact

| Purpose | Address |
|---|---|
| Security vulnerabilities | security@domelayer.com |
| Privacy and data queries | privacy@domelayer.com |
| General enquiries | hello@domelayer.com |

## Secrets handling

This repo follows the Dome portfolio standard:

- Real secrets live in Railway environment variables, never in the repo.
- `.env.example` is committed; any `.env*` file with real values is local-only and gitignored.
- Secrets are rotated when there is any suspicion of exposure, on contractor offboarding, and at least annually.

### Secrets inventory

| Variable | Where used | Sensitivity |
|---|---|---|
| `ANTHROPIC_API_KEY` | Backend Claude provider | **Secret — high impact** |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend DB writes (bypasses RLS) | **Secret — critical impact** |
| `SESSION_SIGNING_SECRET` | Backend HMAC for session-id integrity | **Secret — set at production parity** |
| `API_KEY` | Backend `X-API-Key` header (legacy; SSO Bearer is the primary mechanism) | Shared secret; scheduled for removal in P1 |
| `SUPABASE_URL` | Backend + frontend | Public |
| `NEXT_PUBLIC_*` env vars | Frontend build | Public by Next.js convention |
| `ALLOWED_ORIGINS`, `ENVIRONMENT` | Backend config | Public (config, not secrets) |
| `AZURE_OPENAI_KEY`, `AZURE_OPENAI_ENDPOINT` | Backend (stub provider) | Secret when populated; not used today |

### Rotation log

| Date | Reason | Notes |
|------|--------|-------|
| 2026-04 | Pre-publication audit — repo made public | Keys rotated as part of pre-publication hardening |
