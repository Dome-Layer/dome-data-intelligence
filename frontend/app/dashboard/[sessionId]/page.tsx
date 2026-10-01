import DashboardClient from './DashboardClient'

// Static export (Sprint H phase 2): one prebuilt page, /dashboard/_, serves every session id.
// The Worker maps /dashboard/<id> to it (worker/site.ts), and DashboardClient reads the id from
// the URL. Any other id 404s at build time, which is why dynamicParams is off.
export const dynamicParams = false

export function generateStaticParams() {
  return [{ sessionId: '_' }]
}

export default function DashboardPage() {
  return <DashboardClient />
}
