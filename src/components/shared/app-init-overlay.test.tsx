// @vitest-environment jsdom

import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AppInitOverlay } from './app-init-overlay'
import { useAppInitStore } from '@/stores/useAppInitStore'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/components/shared/guard-layout', () => ({
  FEEDBACK_CHANNELS: { github: { href: '' }, forum: { href: '' }, qqGroup: { href: '' } },
  GuardFeedback: () => null,
}))

/** Let the component's own requestAnimationFrame reveal callback run. */
async function flushAnimationFrames() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
  })
}

beforeEach(() => {
  sessionStorage.clear()
  useAppInitStore.setState({
    hasCompleted: false,
    phase: 'splash',
    progress: 0,
    tasks: new Set(),
    completedTasks: new Set(),
  })
})

afterEach(() => {
  cleanup()
  delete document.documentElement.dataset.cepHydrated
})

it('sets the hydration sentinel for the inline JS-resource guard on mount', () => {
  expect(document.documentElement.getAttribute('data-cep-hydrated')).toBeNull()
  render(<AppInitOverlay />)
  expect(document.documentElement.getAttribute('data-cep-hydrated')).toBe('1')
})

it('still sets the hydration sentinel when init already completed (early-return path)', () => {
  // hasCompleted=true 时组件渲染 null,但 hydration 哨兵 effect 仍在挂载时执行
  useAppInitStore.setState({ hasCompleted: true })
  render(<AppInitOverlay />)
  expect(document.documentElement.getAttribute('data-cep-hydrated')).toBe('1')
})

it('renders the curtain while init has not completed', () => {
  const { container } = render(<AppInitOverlay />)
  expect(container.querySelector('[data-app-init]')).not.toBeNull()
})

it('renders nothing once init has completed', () => {
  useAppInitStore.setState({ hasCompleted: true })
  const { container } = render(<AppInitOverlay />)
  expect(container.querySelector('[data-app-init]')).toBeNull()
})

it('reveals on hydration alone, without waiting for registered data tasks', async () => {
  // A registered-but-incomplete task must no longer hold the curtain up: the
  // overlay used to gate on `/version.json` plus the announcement index and all
  // markdown, which measured 300 ms past hydration on Fast 3G and much longer
  // on slow links. See the AppInitOverlay doc comment.
  useAppInitStore.getState().registerTask('announcements')
  render(<AppInitOverlay />)
  expect(useAppInitStore.getState().phase).toBe('splash')

  await flushAnimationFrames()

  expect(useAppInitStore.getState().phase).toBe('ready')
})

it('marks init completed after the exit animation, so it is persisted for the session', async () => {
  vi.useFakeTimers()
  try {
    render(<AppInitOverlay />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50)
    })
    expect(useAppInitStore.getState().phase).toBe('ready')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(useAppInitStore.getState().hasCompleted).toBe(true)

    const stored = JSON.parse(sessionStorage.getItem('cep-app-init') ?? 'null') as {
      state?: { hasCompleted?: boolean }
    } | null
    expect(stored?.state?.hasCompleted).toBe(true)
  } finally {
    vi.useRealTimers()
  }
})

it('does not persist the task bookkeeping (Set fields would serialize to {})', async () => {
  useAppInitStore.getState().registerTask('version')
  await flushAnimationFrames()

  const stored = JSON.parse(sessionStorage.getItem('cep-app-init') ?? 'null') as {
    state?: Record<string, unknown>
  } | null
  expect(Object.keys(stored?.state ?? {})).toEqual(['hasCompleted'])
})
