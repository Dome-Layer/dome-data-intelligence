import { withSentryConfig } from "@sentry/nextjs";

/**
 * A static export (Sprint H phase 2): Cloudflare serves out/ as static assets and the Worker in
 * worker/ adds the per-request CSP nonce and the security headers (worker/site.ts) that
 * middleware.ts, vercel.json and headers() used to set. /dashboard/<id> is served from one
 * prebuilt shell (app/dashboard/[sessionId]/page.tsx). Nothing here may need a server at
 * request time.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: { unoptimized: true },
}

export default withSentryConfig(nextConfig, {
  silent: true,
  disableSourceMapUpload: true,
})
