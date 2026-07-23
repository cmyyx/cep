// @vitest-environment jsdom

import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { NumberField } from './number-field'

afterEach(cleanup)

function ControlledNumberField() {
  const [value, setValue] = useState(90)
  return <NumberField value={value} minimum={1} maximum={90} ariaLabel="level" onValueChange={setValue} />
}

it('allows clearing and replacing a controlled numeric value without snapping to the minimum', () => {
  render(<ControlledNumberField />)
  const input = screen.getByRole('spinbutton', { name: 'level' }) as HTMLInputElement
  fireEvent.change(input, { target: { value: '' } })
  expect(input.value).toBe('')
  fireEvent.change(input, { target: { value: '12' } })
  expect(input.value).toBe('12')
  fireEvent.blur(input)
  expect(input.value).toBe('12')
})
