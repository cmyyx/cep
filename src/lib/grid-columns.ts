/**
 * Measure the actual number of grid columns from computed style.
 *
 * Never relies on counting rendered children — the visible child count
 * is itself derived from this function's return value, so child-based
 * counting creates a circular dependency that traps the grid at
 * defaultColumns forever.
 *
 * Path 1: modern browsers expand auto-fill/auto-fit to explicit track
 *         sizes in the computed value (e.g. "96px 96px 96px 96px").
 * Path 2: if the repeat() syntax is preserved, parse the minmax()
 *         minimum and divide the container width by it.
 */
export function getGridColumns(
  gridEl: HTMLElement | null,
  defaultColumns: number,
): number {
  if (!gridEl) return defaultColumns
  const style = getComputedStyle(gridEl)
  const tpl = style.gridTemplateColumns

  // Path 1 — resolved explicit tracks
  if (tpl && tpl !== 'none' && !tpl.includes('repeat(')) {
    const count = tpl.split(/\s+/).filter(Boolean).length
    if (count > 0) return count
  }

  // Path 2 — repeat() preserved: calculate from minmax() + container width
  const minmaxMatch = tpl?.match(/minmax\(\s*([\d.]+)(px|rem)\s*,/)
  if (minmaxMatch) {
    const value = parseFloat(minmaxMatch[1])
    const minPx = minmaxMatch[2] === 'rem'
      ? value * parseFloat(getComputedStyle(document.documentElement).fontSize)
      : value
    const gap = parseFloat(style.columnGap || style.gap || '0') || 0
    const width = gridEl.clientWidth
    if (minPx > 0 && width > 0) {
      return Math.max(1, Math.floor((width + gap) / (minPx + gap)))
    }
  }

  return defaultColumns
}
