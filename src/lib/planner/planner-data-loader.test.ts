// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { plannerGameData } from '@/generated/data/planner'
import { wikiCharacters } from '@/generated/data/wiki/characters'
import { wikiWeapons } from '@/generated/data/wiki/weapons'
import {
  getCachedPlannerData,
  getCachedPlannerGameData,
  getPlannerGameData,
  getWikiCharacterSummaries,
  getWikiWeaponSummaries,
  loadPlannerData,
  resetPlannerDataCacheForTests,
  setPlannerDataImporterForTests,
  usePlannerData,
} from './planner-data-loader'

afterEach(() => {
  cleanup()
  resetPlannerDataCacheForTests()
})

describe('planner data loader', () => {
  it('exposes nothing synchronously before the bundle has loaded', () => {
    expect(getCachedPlannerData()).toBeNull()
    expect(getCachedPlannerGameData()).toBeUndefined()
    expect(() => getPlannerGameData()).toThrow(/not loaded/)
    expect(() => getWikiCharacterSummaries()).toThrow(/not loaded/)
    expect(() => getWikiWeaponSummaries()).toThrow(/not loaded/)
  })

  it('loads the bundle once and serves it from the module cache', async () => {
    const bundle = await loadPlannerData()
    expect(bundle.plannerGameData).toBe(plannerGameData)
    expect(bundle.wikiCharacters).toBe(wikiCharacters)
    expect(bundle.wikiWeapons).toBe(wikiWeapons)
    expect(Object.isFrozen(bundle)).toBe(true)

    expect(getCachedPlannerData()).toBe(bundle)
    expect(getCachedPlannerGameData()).toBe(plannerGameData)
    expect(getPlannerGameData()).toBe(plannerGameData)
    expect(getWikiCharacterSummaries()).toBe(wikiCharacters)
    expect(getWikiWeaponSummaries()).toBe(wikiWeapons)
    await expect(loadPlannerData()).resolves.toBe(bundle)
  })

  it('shares one in-flight promise across concurrent loads', async () => {
    const [first, second] = await Promise.all([loadPlannerData(), loadPlannerData()])
    expect(first).toBe(second)
  })

  it('rejects, releases the in-flight promise, and stays retryable after a failed import', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('chunk 404'))
    setPlannerDataImporterForTests(failing)

    await expect(loadPlannerData()).rejects.toThrow('chunk 404')
    expect(getCachedPlannerData()).toBeNull()

    // A second call must re-attempt instead of reusing the rejected promise.
    await expect(loadPlannerData()).rejects.toThrow('chunk 404')
    expect(failing).toHaveBeenCalledTimes(2)

    setPlannerDataImporterForTests(null)
    await expect(loadPlannerData()).resolves.toMatchObject({ plannerGameData })
  })
})

describe('usePlannerData', () => {
  it('surfaces the load failure instead of hanging on a null bundle', async () => {
    setPlannerDataImporterForTests(vi.fn().mockRejectedValue(new Error('chunk 404')))
    const { result } = renderHook(() => usePlannerData())

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))
    expect(result.current.error?.message).toBe('chunk 404')
    expect(result.current.data).toBeNull()
  })

  it('wraps a non-Error rejection reason', async () => {
    setPlannerDataImporterForTests(vi.fn().mockRejectedValue('offline'))
    const { result } = renderHook(() => usePlannerData())

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))
    expect(result.current.error?.message).toBe('offline')
  })

  it('recovers through retry() once the import succeeds', async () => {
    const importer = vi.fn<() => Promise<never>>().mockRejectedValueOnce(new Error('chunk 404'))
    setPlannerDataImporterForTests(importer)
    const { result } = renderHook(() => usePlannerData())

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))

    setPlannerDataImporterForTests(null)
    act(() => result.current.retry())

    await waitFor(() => expect(result.current.data).not.toBeNull())
    expect(result.current.error).toBeNull()
    expect(result.current.data?.plannerGameData).toBe(plannerGameData)
  })

  it('resolves to the bundle on the happy path', async () => {
    const { result } = renderHook(() => usePlannerData())

    await waitFor(() => expect(result.current.data).not.toBeNull())
    expect(result.current.error).toBeNull()
    expect(result.current.data?.wikiCharacters).toBe(wikiCharacters)
    expect(result.current.data?.wikiWeapons).toBe(wikiWeapons)
  })
})
