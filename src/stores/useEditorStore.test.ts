import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '@/stores/useEditorStore'

/**
 * Reset the store and seed a single draft with a known ID and name.
 * Must re-read state via getState() after every mutation — captured
 * references become stale when the store creates a new state snapshot.
 */
function seedDraft(id = 'test-1', name = 'Test') {
  useEditorStore.getState().initDrafts([])
  useEditorStore.getState().addDraftCharacter()

  const drafts = useEditorStore.getState().draftCharacters
  if (drafts.length > 0) {
    useEditorStore.setState({
      draftCharacters: [{ ...drafts[0], id, name }],
      selectedId: id,
    })
  }
}

beforeEach(() => {
  useEditorStore.getState().initDrafts([])
  useEditorStore.setState({ selectedId: null })
})

// ---------------------------------------------------------------------------
// updateDraft
// ---------------------------------------------------------------------------

describe('updateDraft', () => {
  it('creates a shallow clone and replaces it in draftCharacters', () => {
    seedDraft('a', 'Alice')

    const original = useEditorStore.getState().draftCharacters[0]
    const originalArray = useEditorStore.getState().draftCharacters

    useEditorStore.getState().updateDraft('a', (d) => {
      d.name = 'Bob'
    })

    const updated = useEditorStore.getState()
    const updatedDraft = updated.draftCharacters[0]
    const updatedArray = updated.draftCharacters

    expect(updatedArray).not.toBe(originalArray)
    expect(updatedDraft).not.toBe(original)
    expect(updatedDraft.name).toBe('Bob')
    expect(original.name).toBe('Alice')
  })

  it('does not modify other drafts in the array', () => {
    seedDraft('a', 'Alice')

    // Add a second draft
    useEditorStore.getState().addDraftCharacter()
    const snap1 = useEditorStore.getState().draftCharacters
    // Rename it predictably (avoid direct mutation)
    useEditorStore.setState({
      draftCharacters: [
        snap1[0],
        { ...snap1[1], id: 'b', name: 'Bob' },
      ],
    })

    const beforeAll = useEditorStore.getState().draftCharacters
    const beforeSecond = beforeAll[1]

    useEditorStore.getState().updateDraft('a', (d) => {
      d.name = 'AliceUpdated'
    })

    const afterAll = useEditorStore.getState().draftCharacters
    expect(afterAll[0].name).toBe('AliceUpdated')
    expect(afterAll[1].name).toBe('Bob')
    // The second draft (not mutated) keeps its reference
    expect(afterAll[1]).toBe(beforeSecond)
  })

  it('returns unchanged state when draft ID is not found', () => {
    seedDraft('a', 'Alice')

    const before = useEditorStore.getState().draftCharacters
    useEditorStore.getState().updateDraft('nonexistent', (d) => {
      d.name = 'ShouldNotHappen'
    })

    const after = useEditorStore.getState().draftCharacters
    expect(after).toBe(before)
    expect(after[0].name).toBe('Alice')
  })

  it('makes nested mutations visible after the update', () => {
    seedDraft('a', 'Alice')

    useEditorStore.getState().updateDraft('a', (d) => {
      d.guide.attributions.push({ role: 'Author', name: 'Jane', url: '', note: '' })
    })

    const after = useEditorStore.getState().draftCharacters[0]
    expect(after.guide.attributions).toHaveLength(1)
    expect(after.guide.attributions[0].role).toBe('Author')
  })

  it('preserves nested object identity for unchanged sub-objects', () => {
    seedDraft('a', 'Alice')

    const before = useEditorStore.getState().draftCharacters[0]
    const guideBefore = before.guide

    useEditorStore.getState().updateDraft('a', (d) => {
      d.name = 'Bob'
    })

    const after = useEditorStore.getState().draftCharacters[0]
    // Shallow clone means unchanged nested objects keep their reference
    expect(after.guide).toBe(guideBefore)
    expect(after).not.toBe(before)
  })

  it('correctly handles the updater mutating the draft ID', () => {
    seedDraft('a', 'Alice')

    const before = useEditorStore.getState().draftCharacters

    useEditorStore.getState().updateDraft('a', (d) => {
      d.id = 'new-id'
    })

    const after = useEditorStore.getState()
    expect(after.draftCharacters[0].id).toBe('new-id')
    expect(after.draftCharacters).toHaveLength(1)
    expect(after.draftCharacters).not.toBe(before)
  })

  it('draftCharacters reference changes on every updateDraft call (re-render signal)', () => {
    seedDraft('a', 'Alice')

    const getDrafts = () => useEditorStore.getState().draftCharacters
    const ref1 = getDrafts()

    useEditorStore.getState().updateDraft('a', (d) => {
      d.name = 'Bob'
    })
    expect(getDrafts()).not.toBe(ref1)

    const ref2 = getDrafts()
    useEditorStore.getState().updateDraft('a', (d) => {
      d.name = 'Bob2'
    })
    expect(getDrafts()).not.toBe(ref2)
  })
})

// ---------------------------------------------------------------------------
// Regression: addDraftCharacter / removeDraftCharacter create new references
// ---------------------------------------------------------------------------

describe('draftCharacters reference stability', () => {
  it('addDraftCharacter creates a new array reference', () => {
    seedDraft('a', 'Alice')
    const before = useEditorStore.getState().draftCharacters

    useEditorStore.getState().addDraftCharacter()

    const after = useEditorStore.getState().draftCharacters
    expect(after).not.toBe(before)
    expect(after).toHaveLength(before.length + 1)
  })

  it('removeDraftCharacter creates a new array reference', () => {
    seedDraft('a', 'Alice')
    useEditorStore.getState().addDraftCharacter()

    const before = useEditorStore.getState().draftCharacters
    useEditorStore.getState().removeDraftCharacter('a')

    const after = useEditorStore.getState().draftCharacters
    expect(after).not.toBe(before)
    expect(after).toHaveLength(before.length - 1)
  })
})
