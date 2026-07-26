// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Dialog } from '@/components/ui/dialog'
import { FullscreenImageDialogContent } from './fullscreen-image-dialog'

afterEach(cleanup)

function renderOpen(onOpenChange = vi.fn()) {
  render(
    <Dialog open onOpenChange={onOpenChange}>
      <FullscreenImageDialogContent
        src="/images/test.avif"
        alt="测试图"
        title="测试标题"
        closeLabel="关闭预览"
      />
    </Dialog>,
  )
  return onOpenChange
}

it('renders the image fullscreen with an accessible title', () => {
  renderOpen()

  expect(screen.getByAltText('测试图')).toBeTruthy()
  expect(screen.getByText('测试标题')).toBeTruthy()
  expect(screen.getAllByLabelText('关闭预览')).toHaveLength(2)
})

it('closes when clicking anywhere on the image area', () => {
  const onOpenChange = renderOpen()

  const [imageArea] = screen.getAllByLabelText('关闭预览')
  fireEvent.click(imageArea)

  expect(onOpenChange).toHaveBeenCalled()
  expect(onOpenChange.mock.calls[0][0]).toBe(false)
})

it('applies the caller-provided object-fit class', () => {
  render(
    <Dialog open>
      <FullscreenImageDialogContent
        src="/images/wallpaper.avif"
        alt="壁纸"
        title="壁纸预览"
        closeLabel="关闭"
        imageClassName="object-cover"
      />
    </Dialog>,
  )

  expect(screen.getByAltText('壁纸').className).toContain('object-cover')
})
