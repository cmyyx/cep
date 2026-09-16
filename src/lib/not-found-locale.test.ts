import { describe, it, expect } from 'vitest'
import vm from 'node:vm'
import {
  DEFAULT_LOCALE,
  NOT_FOUND_LOCALES,
  buildNotFoundLocaleScript,
} from '@/lib/not-found-locale'

describe('not-found-locale', () => {
  it('covers exactly the four locale routes', () => {
    expect([...NOT_FOUND_LOCALES]).toEqual(['zh-CN', 'zh-TW', 'ja', 'en'])
  })

  it('falls back to zh-CN', () => {
    expect(DEFAULT_LOCALE).toBe('zh-CN')
  })

  describe('buildNotFoundLocaleScript', () => {
    const script = buildNotFoundLocaleScript()

    it('embeds every locale plus the default', () => {
      for (const locale of NOT_FOUND_LOCALES) {
        expect(script).toContain(`"${locale}"`)
      }
    })

    it('sets both the attribute and the lang property, matching the CSS contract', () => {
      expect(script).toContain("setAttribute('data-notfound-lang',l)")
      expect(script).toContain('document.documentElement.lang=l')
    })

    it('reads the locale from the first path segment', () => {
      expect(script).toContain("location.pathname.split('/')[1]")
    })

    it('swallows errors so a throw can never blank the 404 page', () => {
      expect(script).toContain('catch(e){}')
    })

    it('contains no </script> sequence (it is inlined via dangerouslySetInnerHTML)', () => {
      expect(script).not.toContain('</script>')
    })

    it('resolves the correct locale for representative paths', () => {
      // Execute the emitted script in a vm sandbox so the assertion tracks the
      // real output rather than a re-implementation of it. Test-only: the
      // script is our own build-time constant, never user input.
      const run = (pathname: string) => {
        const attributes: Record<string, string> = {}
        const sandbox = {
          location: { pathname },
          document: {
            documentElement: {
              lang: '',
              setAttribute(name: string, value: string) { attributes[name] = value },
            },
          },
        }
        vm.runInNewContext(script, sandbox)
        return {
          attribute: attributes['data-notfound-lang'],
          lang: sandbox.document.documentElement.lang,
        }
      }

      expect(run('/zh-TW/wiki')).toEqual({ attribute: 'zh-TW', lang: 'zh-TW' })
      expect(run('/ja')).toEqual({ attribute: 'ja', lang: 'ja' })
      expect(run('/en/about')).toEqual({ attribute: 'en', lang: 'en' })
      expect(run('/zh-cn')).toEqual({ attribute: 'zh-CN', lang: 'zh-CN' })
      expect(run('/unknown')).toEqual({ attribute: 'zh-CN', lang: 'zh-CN' })
      expect(run('/')).toEqual({ attribute: 'zh-CN', lang: 'zh-CN' })
    })

    it('does not throw when documentElement access fails', () => {
      const sandbox = {
        location: { pathname: '/ja' },
        document: {
          get documentElement(): never {
            throw new Error('boom')
          },
        },
      }
      expect(() => vm.runInNewContext(script, sandbox)).not.toThrow()
    })
  })
})
