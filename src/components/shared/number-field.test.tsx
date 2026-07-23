// @vitest-environment jsdom

import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NumberField } from './number-field'

afterEach(cleanup)

function ControlledNumberField({ onChange }: { onChange?: (value: number) => void }) {
  const [value, setValue] = useState(90)
  return <NumberField value={value} minimum={1} maximum={90} ariaLabel="level" onValueChange={(next) => { onChange?.(next); setValue(next) }} />
}

it('keeps clear, replacement, and out-of-range drafts local until blur', () => {
  const onChange = vi.fn()
  render(<ControlledNumberField onChange={onChange} />)
  const input = screen.getByRole('spinbutton', { name: 'level' }) as HTMLInputElement

  fireEvent.change(input, { target: { value: '' } })
  expect(input.value).toBe('')
  expect(onChange).not.toHaveBeenCalled()

  fireEvent.change(input, { target: { value: '120' } })
  expect(input.value).toBe('120')
  expect(onChange).not.toHaveBeenCalled()

  fireEvent.blur(input)
  expect(onChange).toHaveBeenCalledOnce()
  expect(onChange).toHaveBeenLastCalledWith(90)
  expect(input.value).toBe('90')
})

it('submits the final bounded draft when Enter blurs the field', () => {
  const onChange = vi.fn()
  render(<ControlledNumberField onChange={onChange} />)
  const input = screen.getByRole('spinbutton', { name: 'level' }) as HTMLInputElement

  fireEvent.change(input, { target: { value: '0' } })
  expect(onChange).not.toHaveBeenCalled()
  fireEvent.keyDown(input, { key: 'Enter' })

  expect(onChange).toHaveBeenCalledOnce()
  expect(onChange).toHaveBeenLastCalledWith(1)
  expect(input.value).toBe('1')
})
