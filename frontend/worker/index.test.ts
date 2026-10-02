import { describe, expect, it } from 'vitest'
import { contentSecurityPolicy, isNoindexHost, makeNonce, shellFor } from './index'

describe('tool Worker', () => {
  it('builds the same CSP the Vercel middleware sent, with the nonce in script-src', () => {
    const csp = contentSecurityPolicy('abc')
    expect(csp.startsWith("default-src 'self'; script-src 'self' 'nonce-abc' 'strict-dynamic'; ")).toBe(true)
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('makes a fresh 128-bit nonce each time', () => {
    const a = makeNonce()
    expect(atob(a)).toHaveLength(16)
    expect(makeNonce()).not.toBe(a)
  })

  it('serves every dashboard from the one prebuilt shell, payloads included', () => {
    expect(shellFor('/dashboard/3f2a-session')).toBe('/dashboard/_')
    expect(shellFor('/dashboard/3f2a-session/__next._tree.txt')).toBe('/dashboard/_/__next._tree.txt')
    expect(shellFor('/dashboard/3f2a-session.txt')).toBe('/dashboard/_.txt')
    expect(shellFor('/dashboard/3f2a/__next.dashboard.$d$sessionId.__PAGE__.txt')).toBe(
      '/dashboard/_/__next.dashboard.%24d%24sessionId.__PAGE__.txt',
    )
    expect(shellFor('/dashboard/')).toBeUndefined()
    expect(shellFor('/saved')).toBeUndefined()
  })

  it('marks staging and workers.dev noindex, never production', () => {
    expect(isNoindexHost('data-intelligence.domelayer.com', { DOME_NOINDEX: 'true' } as never)).toBe(true)
    expect(isNoindexHost('dome-data-intelligence.x.workers.dev', {} as never)).toBe(true)
    expect(isNoindexHost('data-intelligence.domelayer.com', {} as never)).toBe(false)
  })
})
