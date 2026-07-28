// @vitest-environment jsdom

import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

const growthMocks = vi.hoisted(() => ({
  clear: vi.fn(),
  configs: [
    {
      kind: 'weapon' as const,
      id: 'weapon-1',
      currentLevel: 1,
      targetLevel: 90,
      currentBreakStage: 0,
      targetBreakStage: 5,
    },
  ],
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) =>
    values ? `${key}:${Object.values(values).join(',')}` : key,
}))

vi.mock('@/lib/planner/planner-data-loader', () => ({
  usePlannerData: () => ({
    data: {
      plannerGameData: {},
      wikiCharacters: [],
      wikiWeapons: [
        {
          id: 'weapon-1',
          category: 'weapons',
          name: { 'zh-CN': '熔铸火焰', en: 'Forged Flame', ja: 'Forged Flame', 'zh-TW': '熔鑄火焰' },
          rarity: 6,
          imageId: 'weapon-1',
          weaponTypeId: 'sword',
          maxLevel: 90,
        },
      ],
    },
    error: null,
    retry: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-wiki-translations', () => ({
  useWikiTranslations: () => ({
    entityName: () => '熔铸火焰',
    ready: true,
  }),
}))

vi.mock('@/stores/useGrowthPlannerStore', () => ({
  useGrowthPlannerStore: (
    selector: (state: { configs: typeof growthMocks.configs; clear: typeof growthMocks.clear }) => unknown,
  ) => selector(growthMocks),
}))

vi.mock('@/components/ui/sidebar', () => ({ SidebarTrigger: () => <span /> }))
vi.mock('@/components/shared/data-load-error', () => ({ DataLoadError: () => <span /> }))
vi.mock('@/components/shared/rarity-frame', () => ({ RarityFrame: () => <span data-testid="rarity-frame" /> }))
vi.mock('@/components/growth-planner/growth-entity-picker', () => ({ GrowthEntityPicker: () => null }))
vi.mock('@/components/growth-planner/growth-floating-picker', () => ({ GrowthFloatingPicker: () => null }))
vi.mock('@/components/growth-planner/growth-summary', () => ({ GrowthSummary: () => null }))
vi.mock('@/components/growth-planner/growth-target-card', () => ({
  GrowthTargetCard: ({ config }: { config: { id: string } }) => <div>target-card:{config.id}</div>,
}))
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

import GrowthPlannerPage from './page'

afterEach(() => cleanup())

it('exposes the selected target as a visible configuration action', () => {
  render(<GrowthPlannerPage />)

  expect(screen.getByText('configureTarget')).toBeTruthy()
  const configureButton = screen.getByRole('button', { name: 'configureTargetLabel:熔铸火焰' })
  fireEvent.click(configureButton)

  expect(screen.getByText('target-card:weapon-1')).toBeTruthy()
  expect(screen.getByText('targetConfigurationDescription')).toBeTruthy()
})
