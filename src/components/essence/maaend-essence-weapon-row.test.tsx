// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MaaEndEssenceWeaponRow } from './maaend-essence-weapon-row'
import type { Weapon } from '@/types/matrix'

afterEach(cleanup)

const weapon: Weapon = { id: 'wpn_funnel_0008', iconId: 'wpn_funnel_0010', name: '爆破单元', rarity: 6, type: '施术单元', primaryStat: null, elementalDamage: null, specialAbility: null, chars: [] }

it('shows a weapon name and the artwork from its iconId, with an editable checkbox', () => {
  const change = vi.fn()
  render(<MaaEndEssenceWeaponRow weapon={weapon} name="爆破单元" checked onCheckedChange={change} />)
  expect(screen.getByText('爆破单元')).toBeTruthy()
  expect(screen.getByTestId('rarity-frame-image').getAttribute('src')).toContain('/images/weapon/wpn_funnel_0010.avif')
  expect(screen.getByTestId('rarity-frame-image').getAttribute('alt')).toBe('')
  fireEvent.click(screen.getByRole('checkbox', { name: '爆破单元' }))
  expect(change).toHaveBeenCalledWith(false, expect.anything())
})

it('keeps existing marks read-only and uses a fallback icon for custom weapons', () => {
  render(<MaaEndEssenceWeaponRow weapon={{ ...weapon, id: 'custom-test', name: '自定义' }} name="自定义" checked />)
  expect(screen.queryByTestId('rarity-frame-image')).toBeNull()
  expect(screen.getByText('自定义')).toBeTruthy()
  expect(screen.getByRole('checkbox', { name: '自定义' }).getAttribute('aria-disabled')).toBe('true')
})
