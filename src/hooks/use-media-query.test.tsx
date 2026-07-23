// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useMediaQuery } from './use-media-query'

function Probe({ query }: { query: string }) {
  const matches = useMediaQuery(query)
  return <span data-testid="match">{matches ? 'yes' : 'no'}</span>
}

class MockMediaQueryList {
  matches: boolean
  media: string
  private listeners = new Set<() => void>()

  constructor(media: string, matches: boolean) {
    this.media = media
    this.matches = matches
  }

  addEventListener(_type: string, listener: () => void) {
    this.listeners.add(listener)
  }

  removeEventListener(_type: string, listener: () => void) {
    this.listeners.delete(listener)
  }

  dispatch(matches: boolean) {
    this.matches = matches
    for (const listener of this.listeners) listener()
  }

  get listenerCount() {
    return this.listeners.size
  }
}

let mediaQuery: MockMediaQueryList

beforeEach(() => {
  mediaQuery = new MockMediaQueryList('(min-width: 1280px)', true)
  vi.stubGlobal('matchMedia', vi.fn((query: string) => {
    mediaQuery.media = query
    return mediaQuery
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('uses false as the server snapshot', () => {
  const html = renderToString(<Probe query="(min-width: 1280px)" />)
  expect(html).toContain('>no<')
})

it('reads the current matchMedia result on the client', () => {
  render(<Probe query="(min-width: 1280px)" />)
  expect(screen.getByTestId('match').textContent).toBe('yes')
  expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 1280px)')
})

it('updates when the media query changes and unsubscribes on unmount', () => {
  const view = render(<Probe query="(min-width: 1280px)" />)
  expect(screen.getByTestId('match').textContent).toBe('yes')
  expect(mediaQuery.listenerCount).toBe(1)

  act(() => {
    mediaQuery.dispatch(false)
  })
  expect(screen.getByTestId('match').textContent).toBe('no')

  view.unmount()
  expect(mediaQuery.listenerCount).toBe(0)
})
