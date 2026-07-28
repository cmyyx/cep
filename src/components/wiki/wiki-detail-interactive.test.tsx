// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  AdministratorHero,
  CharacterLevelTableIsland,
  MaterialDisclosureClient,
  MATERIAL_ICON_ROW_CLASS,
  PotentialImageDialog,
  WeaponLevelTableIsland,
} from './wiki-detail-interactive'
import { packCharacterLevels, packWeaponLevels } from './wiki-detail-utils'

const viewport = vi.hoisted(() => ({ isMobile: false }))
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => viewport.isMobile }))

afterEach(() => {
  viewport.isMobile = false
})

const messages = {
  wiki: {
    level: '等级',
    breakStage: '突破阶段',
    showAllLevels: '展开全部等级',
    collapseLevels: '收起等级',
    showAllSkillLevels: '展开技能等级',
    collapseSkillLevels: '收起技能等级',
    coolDown: '冷却',
    skillCost: '技力消耗',
    materials: '材料',
    materialCount: '{count} 项材料',
    baseAttack: '基础攻击力',
    closePreview: '关闭预览',
  },
}

afterEach(cleanup)

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="zh-CN" messages={messages} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  )
}

const characterLevels = [
  { level: 1, breakStage: 0, stats: [{ attributeId: 'hp', value: 55 }] },
  { level: 90, breakStage: 3, stats: [{ attributeId: 'hp', value: 987 }] },
]

it('character level table shows only the top level until expanded', () => {
  wrap(
    <CharacterLevelTableIsland
      levels={packCharacterLevels(characterLevels)}
      attributeIds={['hp']}
      attributeLabels={{ hp: '生命值' }}
    />,
  )

  expect(screen.queryByText('55')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /展开全部等级/ }))
  expect(screen.getByText('55')).toBeTruthy()
  expect(screen.getByRole('button', { name: /收起等级/ })).toBeTruthy()
})

it('rounds level stats for display and keeps full precision in the title', () => {
  wrap(
    <CharacterLevelTableIsland
      levels={packCharacterLevels([
        { level: 89, breakStage: 3, stats: [{ attributeId: 'crit', value: 91.85567 }] },
        { level: 90, breakStage: 3, stats: [{ attributeId: 'crit', value: 1.45408 }] },
      ])}
      attributeIds={['crit']}
      attributeLabels={{ crit: '暴击' }}
    />,
  )

  expect(screen.queryByText('1.45408')).toBeNull()
  const cell = screen.getByText('1.45').closest('td')
  expect(cell?.getAttribute('title')).toBe('1.45408')
})

it('weapon level table shows only the top level until expanded', () => {
  wrap(
    <WeaponLevelTableIsland
      levels={packWeaponLevels([
        { level: 1, baseAttack: 51 },
        { level: 90, baseAttack: 640 },
      ])}
    />,
  )

  expect(screen.getByText('640')).toBeTruthy()
  expect(screen.queryByText('51')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /展开全部等级/ }))
  expect(screen.getByText('51')).toBeTruthy()
})

it('weapon level table reuses the formatted attack and keeps full precision in the title', () => {
  wrap(
    <WeaponLevelTableIsland
      levels={packWeaponLevels([{ level: 90, baseAttack: 91.85567 }])}
    />,
  )

  const cell = screen.getByText('91.86').closest('td')
  expect(cell?.getAttribute('title')).toBe('91.85567')
})

it('material disclosure renders a placeholder for empty materials', () => {
  wrap(<MaterialDisclosureClient materials={[]} />)

  expect(screen.getByText('—')).toBeTruthy()
})

it('material disclosure shows the localized material count', () => {
  wrap(
    <MaterialDisclosureClient
      materials={[
        { itemId: 'mat-a', count: 1 },
        { itemId: 'mat-b', count: 2 },
      ]}
    />,
  )

  expect(screen.getByRole('button', { name: '2 项材料' })).toBeTruthy()
})

const threeMaterials = [
  { itemId: 'mat-a', count: 1 },
  { itemId: 'mat-b', count: 2 },
  { itemId: 'mat-c', count: 3 },
]

it('keeps the desktop material icon row on a single line so table rows never grow', () => {
  wrap(<MaterialDisclosureClient materials={threeMaterials} />)

  const trigger = screen.getByRole('button', { name: '3 项材料' })
  const iconRow = trigger.firstElementChild
  // flex-nowrap: 窄列里换行会把技能表整行拉长几倍, 列宽不足时改由表格横向滚动承接。
  expect(MATERIAL_ICON_ROW_CLASS).toContain('flex-nowrap')
  expect(iconRow?.className).toContain('flex-nowrap')
  expect(iconRow?.className).not.toMatch(/\bflex-wrap\b/)
  expect(trigger.querySelectorAll('[data-testid="rarity-frame"]')).toHaveLength(3)
  expect(trigger.textContent).not.toContain('3 项材料')
})

it('falls back to the text trigger on mobile widths instead of a stacked icon column', () => {
  viewport.isMobile = true
  wrap(<MaterialDisclosureClient materials={threeMaterials} />)

  const trigger = screen.getByRole('button', { name: '3 项材料' })
  expect(trigger.textContent).toBe('3 项材料')
  expect(trigger.querySelectorAll('[data-testid="rarity-frame"]')).toHaveLength(0)
})

it('prerenders the text trigger so the static HTML carries no icon row', () => {
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="zh-CN" messages={messages} timeZone="UTC">
      <MaterialDisclosureClient materials={threeMaterials} />
    </NextIntlClientProvider>,
  )

  expect(html).toContain('3 项材料')
  expect(html).not.toContain('rarity-frame')
})

it('administrator hero switches between female and male variants', () => {
  wrap(
    <AdministratorHero
      name="管理员"
      rarity={6}
      meta={<span>档案</span>}
      femaleImage="chr_f"
      maleImage="chr_m"
      femaleLabel="女性形象"
      maleLabel="男性形象"
    />,
  )

  expect(screen.getByText('女性形象')).toBeTruthy()
  fireEvent.click(screen.getByRole('switch'))
  expect(screen.getByText('男性形象')).toBeTruthy()
})

it('administrator switch announces the variant it will switch to', () => {
  wrap(
    <AdministratorHero
      name="管理员"
      rarity={6}
      meta={<span>档案</span>}
      femaleImage="chr_f"
      maleImage="chr_m"
      femaleLabel="女"
      maleLabel="男"
      switchToFemaleLabel="切换为女性形象"
      switchToMaleLabel="切换为男性形象"
    />,
  )

  expect(screen.getByRole('switch', { name: '切换为男性形象' })).toBeTruthy()
  fireEvent.click(screen.getByRole('switch'))
  expect(screen.getByRole('switch', { name: '切换为女性形象' })).toBeTruthy()
})

it('potential preview falls back to a labelled placeholder when the artwork fails', () => {
  wrap(<PotentialImageDialog name="潜能一" imagePath="/images/wiki/character-potential/missing.avif" openLabel="预览潜能一" />)

  const trigger = screen.getByRole('button', { name: '预览潜能一' })
  const image = trigger.querySelector('img')
  if (!image) throw new Error('expected the potential image to render')
  fireEvent.error(image)

  expect(screen.queryByRole('button', { name: '预览潜能一' })).toBeNull()
  expect(screen.getByRole('img', { name: '潜能一' })).toBeTruthy()
})
