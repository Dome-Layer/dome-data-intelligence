/**
 * What is specific to Data Intelligence. The rest of worker/ is the shared tool Worker
 * (dome-docs/templates/tool-worker, Sprint H phase 2), copied unchanged into each tool.
 */

/**
 * The Content-Security-Policy, except script-src, which index.ts adds with the per-request nonce.
 * Copied from the middleware it replaces (2026-10-01), which is what production sent.
 */
export const CSP_DIRECTIVES = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' http://localhost:8000 https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
]

/** Headers on every response (they were in vercel.json and next.config). */
export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

/**
 * Dynamic routes, served from one prebuilt page each: /dashboard/<session id> gets the shell
 * /dashboard/_ (and its client-navigation payloads), and the page reads the id from the URL.
 */
export const SHELL_ROUTES: { prefix: string; shell: string }[] = [{ prefix: '/dashboard/', shell: '/dashboard/_' }]
