// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { useSidebarScrollState } from './use-sidebar-scroll-state'

type ScrollMetrics = { scrollTop: number; clientHeight: number; scrollHeight: number }

let resizeCallback: ResizeObserverCallback | null = null
const observedTargets: unknown[] = []

class MockResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback
  }
  observe = vi.fn((target: Element) => {
    observedTargets.push(target)
  })
  unobserve = vi.fn()
  disconnect = vi.fn()
}

function setScrollMetrics(el: HTMLElement, metrics: ScrollMetrics) {
  Object.defineProperty(el, 'scrollTop', { value: metrics.scrollTop, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: metrics.clientHeight, configurable: true })
  Object.defineProperty(el, 'scrollHeight', { value: metrics.scrollHeight, configurable: true })
}

function emitResize() {
  act(() => {
    resizeCallback?.([], {} as ResizeObserver)
  })
}

function Harness() {
  const { canScrollUp, canScrollDown, contentRef, contentInnerRef, handleScroll } =
    useSidebarScrollState()
  return (
    <div>
      <span data-testid="up">{String(canScrollUp)}</span>
      <span data-testid="down">{String(canScrollDown)}</span>
      <div ref={contentRef} onScroll={handleScroll} data-testid="scroller">
        <div ref={contentInnerRef} data-testid="content" />
      </div>
    </div>
  )
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', MockResizeObserver)
  resizeCallback = null
  observedTargets.length = 0
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('reports no scrolling when content fits', () => {
  render(<Harness />)
  const scroller = screen.getByTestId('scroller')
  setScrollMetrics(scroller, { scrollTop: 0, clientHeight: 472, scrollHeight: 472 })
  emitResize()
  expect(screen.getByTestId('up').textContent).toBe('false')
  expect(screen.getByTestId('down').textContent).toBe('false')
})

it('reports content below on mount via ResizeObserver', () => {
  render(<Harness />)
  const scroller = screen.getByTestId('scroller')
  setScrollMetrics(scroller, { scrollTop: 0, clientHeight: 322, scrollHeight: 472 })
  emitResize()
  expect(screen.getByTestId('up').textContent).toBe('false')
  expect(screen.getByTestId('down').textContent).toBe('true')
})

it('observes both the scroll container and the content layer', () => {
  render(<Harness />)
  expect(observedTargets).toContain(screen.getByTestId('scroller'))
  expect(observedTargets).toContain(screen.getByTestId('content'))
})

it('tracks both directions across scroll events', () => {
  render(<Harness />)
  const scroller = screen.getByTestId('scroller')
  setScrollMetrics(scroller, { scrollTop: 0, clientHeight: 322, scrollHeight: 472 })
  emitResize()

  setScrollMetrics(scroller, { scrollTop: 80, clientHeight: 322, scrollHeight: 472 })
  act(() => {
    scroller.dispatchEvent(new Event('scroll'))
  })
  expect(screen.getByTestId('up').textContent).toBe('true')
  expect(screen.getByTestId('down').textContent).toBe('true')

  setScrollMetrics(scroller, { scrollTop: 150, clientHeight: 322, scrollHeight: 472 })
  act(() => {
    scroller.dispatchEvent(new Event('scroll'))
  })
  expect(screen.getByTestId('up').textContent).toBe('true')
  expect(screen.getByTestId('down').textContent).toBe('false')
})
