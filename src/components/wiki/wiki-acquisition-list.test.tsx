// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { WikiAcquisitionList } from './wiki-acquisition-list'
import type { WikiAcquisitionGroup } from '@/types/wiki-acquisition'

const messages = {
  wiki: {
    showMoreAcquisitionSources: 'Show {count} more sources…',
    collapseAcquisitionSources: 'Collapse sources',
  },
}

function renderList(groups: WikiAcquisitionGroup[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <WikiAcquisitionList groups={groups} />
    </NextIntlClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// getGridColumns reads computed styles and clientWidth — jsdom has neither.
// Stub ResizeObserver (never fires) and control the measured column count by
// stubbing getComputedStyle to report explicit grid tracks.
function stubColumns(columns: number): void {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  const tracks = Array.from({ length: columns }, () => '100px').join(' ')
  vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
    const style = { ...(el as HTMLElement).style } as Record<string, unknown>
    return new Proxy(style, {
      get(target, prop) {
        if (prop === 'gridTemplateColumns') return tracks
        if (prop === 'columnGap' || prop === 'gap') return '8px'
        if (prop === 'getPropertyValue') return (name: string) => (name === 'grid-template-columns' ? tracks : '')
        return Reflect.get(target, prop)
      },
    }) as unknown as CSSStyleDeclaration
  })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 100 * columns + 8 * (columns - 1) })
}

function group(categoryId: string, label: string, count: number): WikiAcquisitionGroup {
  return {
    categoryId,
    label,
    sources: Array.from({ length: count }, (_, index) => ({ name: `${label}-${index}`, description: `说明 ${index}` })),
  }
}

describe('WikiAcquisitionList', () => {
  it('renders every group and all sources when each fits one row', () => {
    stubColumns(3)
    const groups = [group('gacha', '武器抽取', 3), group('shop', '商店兑换', 2)]
    renderList(groups)

    expect(screen.getByText('武器抽取')).toBeDefined()
    expect(screen.getByText('商店兑换')).toBeDefined()
    for (const source of [...groups[0].sources, ...groups[1].sources]) {
      expect(screen.getByText(source.name)).toBeDefined()
    }
    expect(screen.queryByRole('button', { name: /more sources/ })).toBeNull()
  })

  it('collapses a group to one measured row and expands it on click', () => {
    stubColumns(2)
    const groups = [group('gacha', '武器抽取', 5)]
    renderList(groups)

    // Collapsed: only the first two sources are visible.
    expect(screen.getByText('武器抽取-0')).toBeDefined()
    expect(screen.getByText('武器抽取-1')).toBeDefined()
    expect(screen.queryByText('武器抽取-2')).toBeNull()
    expect(screen.queryByText('武器抽取-4')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /3 more sources/ }))

    // Expanded: all five sources appear and the button flips to collapse.
    for (let index = 0; index < 5; index++) {
      expect(screen.getByText(`武器抽取-${index}`)).toBeDefined()
    }
    expect(screen.getByRole('button', { name: /Collapse sources/ })).toBeDefined()
  })

  it('collapses each group independently', () => {
    stubColumns(2)
    const groups = [group('gacha', '武器抽取', 4), group('shop', '商店兑换', 1)]
    renderList(groups)

    expect(screen.getByText('商店兑换-0')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /2 more sources/ }))
    expect(screen.getByText('武器抽取-3')).toBeDefined()
    // The fitting group never got a toggle button.
    expect(screen.queryByRole('button', { name: /商店/ })).toBeNull()
  })

  it('renders an empty group without cards or a toggle', () => {
    stubColumns(2)
    renderList([{ categoryId: 'chest', label: '自选箱', sources: [] }])
    expect(screen.getByText('自选箱')).toBeDefined()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
