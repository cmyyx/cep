// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from './collapsible'

afterEach(cleanup)

describe('Collapsible', () => {
  it('hides content by default and shows it after clicking the trigger', () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>toggle</CollapsibleTrigger>
        <CollapsibleContent>panel-content</CollapsibleContent>
      </Collapsible>,
    )
    expect(screen.queryByText('panel-content')).toBeNull()
    fireEvent.click(screen.getByText('toggle'))
    expect(screen.getByText('panel-content')).toBeDefined()
  })

  it('shows content when defaultOpen and closes on trigger click', () => {
    render(
      <Collapsible defaultOpen>
        <CollapsibleTrigger>toggle</CollapsibleTrigger>
        <CollapsibleContent>panel-content</CollapsibleContent>
      </Collapsible>,
    )
    expect(screen.getByText('panel-content')).toBeDefined()
    fireEvent.click(screen.getByText('toggle'))
    expect(screen.queryByText('panel-content')).toBeNull()
  })

  it('exposes data-slot attributes and the data-open state hook', () => {
    render(
      <Collapsible defaultOpen data-testid="root">
        <CollapsibleTrigger data-testid="trigger">t</CollapsibleTrigger>
        <CollapsibleContent data-testid="content">c</CollapsibleContent>
      </Collapsible>,
    )
    const root = screen.getByTestId('root')
    expect(root.getAttribute('data-slot')).toBe('collapsible')
    // The sidebar chevron rotation relies on [data-open] being set on the root.
    expect(root.hasAttribute('data-open')).toBe(true)
    expect(screen.getByTestId('trigger').getAttribute('data-slot')).toBe('collapsible-trigger')
    expect(screen.getByTestId('content').getAttribute('data-slot')).toBe('collapsible-content')
  })
})
