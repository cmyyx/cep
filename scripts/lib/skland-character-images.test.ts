import { describe, expect, it } from 'vitest'
import {
  buildCharacterImageTargets,
  collectIllustrationUrls,
  getCatalogItems,
  getIllustrationUrl,
  waitForValidCatalogResponse,
} from './skland-character-images'

const catalogPayload = {
  data: {
    catalog: [
      {
        id: '1',
        typeSub: [
          {
            id: '1',
            items: [
              { itemId: '5', name: '佩丽卡', brief: { cover: 'pelica-avatar' } },
              { itemId: '89', name: '管理员 (男)', brief: { cover: 'male-avatar' } },
              { itemId: '156', name: '管理员 (女)', brief: { cover: 'female-avatar' } },
              { itemId: '1683', name: '梨诺', brief: { cover: 'liino-avatar' } },
              { itemId: '9999', name: '未知角色', brief: { cover: 'unknown-avatar' } },
            ],
          },
        ],
      },
    ],
  },
}

describe('Skland character image metadata', () => {
  it('reads the operator catalog from the signed response payload', () => {
    expect(getCatalogItems(catalogPayload)).toHaveLength(5)
  })

  it('maps released characters and administrator variants without deprecated IDs', () => {
    const targets = buildCharacterImageTargets(getCatalogItems(catalogPayload), {
      佩丽卡: 'chr_0004_pelica',
    })

    expect(targets).toEqual([
      {
        itemId: '5',
        name: '佩丽卡',
        avatarUrl: 'pelica-avatar',
        avatarId: 'chr_0004_pelica',
        fullBodyId: 'chr_0004_pelica',
      },
      {
        itemId: '89',
        name: '管理员 (男)',
        avatarUrl: 'male-avatar',
        fullBodyId: 'chr_9000_endmin-male',
      },
      {
        itemId: '156',
        name: '管理员 (女)',
        avatarUrl: 'female-avatar',
        avatarId: 'chr_9000_endmin',
        fullBodyId: 'chr_9000_endmin-female',
      },
      {
        itemId: '1683',
        name: '梨诺',
        avatarUrl: 'liino-avatar',
        avatarId: 'skland-1683',
      },
    ])
    expect(JSON.stringify(targets)).not.toContain('chr_0002_endminm')
    expect(JSON.stringify(targets)).not.toContain('chr_0003_endminf')
  })

  it('reads the full-body illustration URL from detail payloads', () => {
    expect(
      getIllustrationUrl({
        data: { item: { document: { extraInfo: { illustration: 'full-body' } } } },
      })
    ).toBe('full-body')
  })

  it('loads all full-body illustrations concurrently and isolates failures', async () => {
    const started: string[] = []
    const pending = new Map<string, (payload: unknown) => void>()
    const targets = buildCharacterImageTargets(getCatalogItems(catalogPayload), {
      佩丽卡: 'chr_0004_pelica',
    })
    const resultPromise = collectIllustrationUrls(targets, (itemId) => {
      started.push(itemId)
      const { promise, resolve } = Promise.withResolvers<unknown>()
      pending.set(itemId, resolve)
      return promise
    })

    expect(started).toEqual(['5', '89', '156'])
    pending.get('5')?.({ data: { item: { document: { extraInfo: { illustration: 'pelica-full' } } } } })
    pending.get('89')?.({ data: {} })
    pending.get('156')?.({ data: { item: { document: { extraInfo: { illustration: 'female-full' } } } } })

    await expect(resultPromise).resolves.toEqual({
      chr_0004_pelica: 'pelica-full',
      'chr_9000_endmin-female': 'female-full',
    })
  })

  it('skips malformed matching responses until a valid catalog arrives', async () => {
    const invalid = Promise.resolve({ json: async () => ({ data: {} }) })
    const valid = Promise.resolve({ json: async () => catalogPayload })

    await expect(waitForValidCatalogResponse([invalid, valid])).resolves.toEqual(catalogPayload)
  })

  it('rejects malformed response payloads', () => {
    expect(() => getCatalogItems({ data: {} })).toThrow('operator catalog')
    expect(() => getIllustrationUrl({ data: {} })).toThrow('illustration')
  })
})
