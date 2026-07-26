// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { NextIntlClientProvider, useTranslations } from 'next-intl'
import { afterEach, expect, it } from 'vitest'
import { RouteMessages } from './route-messages'

afterEach(cleanup)

function Probe({ keys }: { keys: string[] }) {
  const t = useTranslations()
  return <span data-testid="probe">{keys.map((key) => t(key)).join('|')}</span>
}

function renderWithProviders(
  coreMessages: Record<string, Record<string, string>>,
  routeMessages: Record<string, unknown>,
  keys: string[],
) {
  return render(
    <NextIntlClientProvider locale="zh-CN" messages={coreMessages} timeZone="UTC">
      <RouteMessages messages={routeMessages}>
        <Probe keys={keys} />
      </RouteMessages>
    </NextIntlClientProvider>,
  )
}

it('merges route messages on top of the core shell bag', () => {
  renderWithProviders(
    { common: { close: '关闭' } },
    { settings: { title: '设置' }, equips: { 'item-equip-a': '装备甲' } },
    ['settings.title', 'equips.item-equip-a', 'common.close'],
  )

  expect(screen.getByTestId('probe').textContent).toBe('设置|装备甲|关闭')
})

it('route full namespace supersedes the core key-level subset', () => {
  renderWithProviders(
    { account: { title: '账户' } },
    { account: { title: '账户', devices: '设备管理' } },
    ['account.title', 'account.devices'],
  )

  expect(screen.getByTestId('probe').textContent).toBe('账户|设备管理')
})

it('keeps core messages resolvable when route messages are empty', () => {
  renderWithProviders({ common: { close: '关闭' } }, {}, ['common.close'])

  expect(screen.getByTestId('probe').textContent).toBe('关闭')
})
