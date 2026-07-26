// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, expect, it, vi } from 'vitest'
import {
  AdministratorHero,
  CharacterLevelTableIsland,
  MaterialDisclosureClient,
  PotentialImageDialog,
  WeaponLevelTableIsland,
} from './wiki-detail-interactive'
import { packCharacterLevels, packWeaponLevels } from './wiki-detail-utils'

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }))

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
      title="等级数据"
    />,
  )

  expect(screen.queryByText('55')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /展开全部等级/ }))
  expect(screen.getByText('55')).toBeTruthy()
  expect(screen.getByRole('button', { name: /收起等级/ })).toBeTruthy()
})

it('weapon level table shows only the top level until expanded', () => {
  wrap(
    <WeaponLevelTableIsland
      levels={packWeaponLevels([
        { level: 1, baseAttack: 51 },
        { level: 90, baseAttack: 640 },
      ])}
      title="等级数据"
    />,
  )

  expect(screen.getByText('640')).toBeTruthy()
  expect(screen.queryByText('51')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /展开全部等级/ }))
  expect(screen.getByText('51')).toBeTruthy()
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
