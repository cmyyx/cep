// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkCanary, COLOR_EXPECTED, getTheme } from './extension-css-detector'

function createCanary(): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('data-cep-canary', '')
  document.body.appendChild(el)
  return el
}

function mockComputedStyle(overrides: Record<string, string>) {
  const base: Record<string, string> = {
    display: 'flex',
    fontSize: '14px',
    padding: '16px',
    color: COLOR_EXPECTED.light,
    ...overrides,
  }
  vi.stubGlobal('getComputedStyle', () => base)
}

beforeEach(() => {
  document.documentElement.classList.remove('dark', 'flashbang')
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('checkCanary', () => {
  it('returns false when no canary element exists', () => {
    expect(checkCanary()).toBe(false)
  })

  it('returns false when styles are unchanged (light theme)', () => {
    createCanary()
    mockComputedStyle({})
    expect(checkCanary()).toBe(false)
  })

  it('returns true when display is overridden', () => {
    createCanary()
    mockComputedStyle({ display: 'block' })
    expect(checkCanary()).toBe(true)
  })

  it('returns true when fontSize is overridden', () => {
    createCanary()
    mockComputedStyle({ fontSize: '20px' })
    expect(checkCanary()).toBe(true)
  })

  it('returns true when padding is overridden', () => {
    createCanary()
    mockComputedStyle({ padding: '8px' })
    expect(checkCanary()).toBe(true)
  })

  it('returns true when color is overridden in light theme', () => {
    createCanary()
    mockComputedStyle({ color: 'rgb(255, 0, 0)' })
    expect(checkCanary()).toBe(true)
  })

  it('returns false when dark theme color matches', () => {
    document.documentElement.classList.add('dark')
    createCanary()
    mockComputedStyle({ color: COLOR_EXPECTED.dark })
    expect(checkCanary()).toBe(false)
  })

  it('returns true when dark theme color does not match', () => {
    document.documentElement.classList.add('dark')
    createCanary()
    mockComputedStyle({ color: COLOR_EXPECTED.light })
    expect(checkCanary()).toBe(true)
  })

  it('returns false when flashbang theme color matches', () => {
    document.documentElement.classList.add('flashbang')
    createCanary()
    mockComputedStyle({ color: COLOR_EXPECTED.flashbang })
    expect(checkCanary()).toBe(false)
  })

  it('returns true when flashbang theme color does not match', () => {
    document.documentElement.classList.add('flashbang')
    createCanary()
    mockComputedStyle({ color: COLOR_EXPECTED.light })
    expect(checkCanary()).toBe(true)
  })
})

describe('getTheme', () => {
  it('returns light by default', () => {
    expect(getTheme()).toBe('light')
  })

  it('returns dark when dark class is present', () => {
    document.documentElement.classList.add('dark')
    expect(getTheme()).toBe('dark')
  })

  it('returns flashbang when flashbang class is present', () => {
    document.documentElement.classList.add('flashbang')
    expect(getTheme()).toBe('flashbang')
  })

  it('returns flashbang when both dark and flashbang are present', () => {
    document.documentElement.classList.add('dark', 'flashbang')
    expect(getTheme()).toBe('flashbang')
  })
})
