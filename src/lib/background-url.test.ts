import { expect, it } from 'vitest'
import { isValidBackgroundUrl } from './background-url'

it('accepts absolute http and https image URLs', () => {
  expect(isValidBackgroundUrl('https://img.canmoe.com/image?img=ua')).toBe(true)
  expect(isValidBackgroundUrl('http://example.com/bg.png')).toBe(true)
  expect(isValidBackgroundUrl('  https://example.com/bg.png  ')).toBe(true)
})

it('rejects empty, relative and non-http schemes', () => {
  expect(isValidBackgroundUrl('')).toBe(false)
  expect(isValidBackgroundUrl('   ')).toBe(false)
  expect(isValidBackgroundUrl('/background.jpg')).toBe(false)
  expect(isValidBackgroundUrl('example.com/bg.png')).toBe(false)
  expect(isValidBackgroundUrl('javascript:alert(1)')).toBe(false)
  expect(isValidBackgroundUrl('data:image/png;base64,AAAA')).toBe(false)
  expect(isValidBackgroundUrl('ftp://example.com/bg.png')).toBe(false)
})
