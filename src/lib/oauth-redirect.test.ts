import { beforeEach, describe, expect, it, vi } from 'vitest'

const { features } = vi.hoisted(() => ({
  features: { forumUrl: '' as string | undefined, allowedDomains: [] as string[] },
}))

vi.mock('@/lib/features', () => ({ FEATURES: features }))

const { buildOAuthDenyRedirect, getAllowedRedirectHosts } = await import('./oauth-redirect')

const ALLOWED = ['forum.example.com']

beforeEach(() => {
  features.forumUrl = ''
  features.allowedDomains = []
})

describe('getAllowedRedirectHosts', () => {
  it('collects the forum host, the site domains and the current host', () => {
    features.forumUrl = 'https://forum.example.com/'
    features.allowedDomains = ['end.example.com', 'END.MIRROR.COM']
    expect(getAllowedRedirectHosts('localhost:3000')).toEqual([
      'forum.example.com',
      'end.example.com',
      'end.mirror.com',
      'localhost:3000',
    ])
  })

  it('ignores a malformed forum URL', () => {
    features.forumUrl = 'not a url'
    expect(getAllowedRedirectHosts()).toEqual([])
  })
})

describe('buildOAuthDenyRedirect', () => {
  it('appends the denial params to an allowed https callback', () => {
    const url = buildOAuthDenyRedirect('https://forum.example.com/auth/cep/callback', 'st4te', ALLOWED)
    expect(url).toBe(
      'https://forum.example.com/auth/cep/callback?error=access_denied' +
        '&error_description=The+user+denied+the+authorization+request&state=st4te',
    )
  })

  it('merges into an existing query string instead of adding a second "?"', () => {
    const url = buildOAuthDenyRedirect('https://forum.example.com/cb?next=%2Ftopic%2F1', '', ALLOWED)
    expect(url).not.toBeNull()
    expect((url ?? '').match(/\?/g)).toHaveLength(1)
    const parsed = new URL(url ?? '')
    expect(parsed.searchParams.get('next')).toBe('/topic/1')
    expect(parsed.searchParams.get('error')).toBe('access_denied')
    expect(parsed.searchParams.has('state')).toBe(false)
  })

  it('rejects hosts that are not allowed (open redirect)', () => {
    expect(buildOAuthDenyRedirect('https://evil.example.com/steal', 's', ALLOWED)).toBeNull()
    // Host-prefix tricks must not pass either.
    expect(buildOAuthDenyRedirect('https://forum.example.com.evil.test/x', 's', ALLOWED)).toBeNull()
  })

  it('rejects non-https and non-absolute targets', () => {
    expect(buildOAuthDenyRedirect('http://forum.example.com/cb', 's', ALLOWED)).toBeNull()
    expect(buildOAuthDenyRedirect('javascript:alert(1)', 's', ALLOWED)).toBeNull()
    expect(buildOAuthDenyRedirect('//evil.example.com/cb', 's', ALLOWED)).toBeNull()
    expect(buildOAuthDenyRedirect('/local/path', 's', ALLOWED)).toBeNull()
    expect(buildOAuthDenyRedirect('', 's', ALLOWED)).toBeNull()
  })

  it('allows loopback over http on any port for local clients', () => {
    const url = buildOAuthDenyRedirect('http://localhost:4567/auth/cep/callback', 's', [])
    expect(url).toBe(
      'http://localhost:4567/auth/cep/callback?error=access_denied' +
        '&error_description=The+user+denied+the+authorization+request&state=s',
    )
    expect(buildOAuthDenyRedirect('http://127.0.0.1:8080/cb', '', [])).not.toBeNull()
  })

  it('matches allowed hosts case-insensitively', () => {
    expect(buildOAuthDenyRedirect('https://FORUM.example.com/cb', '', ['forum.example.com'])).not.toBeNull()
  })
})
