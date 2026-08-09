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
        avatarId: 'preview-1683',
        fullBodyId: 'preview-1683',
        isPreview: true,
      },
      {
        itemId: '9999',
        name: '未知角色',
        avatarUrl: 'unknown-avatar',
        avatarId: 'preview-9999',
        fullBodyId: 'preview-9999',
        isPreview: true,
      },
    ])
    expect(JSON.stringify(targets)).not.toContain('chr_0002_endminm')
    expect(JSON.stringify(targets)).not.toContain('chr_0003_endminf')
  })

  it('assigns stable preview IDs to catalog items without a released mapping', () => {
    const targets = buildCharacterImageTargets(getCatalogItems(catalogPayload), {
      佩丽卡: 'chr_0004_pelica',
    })
    expect(targets).toContainEqual({
      itemId: '1683',
      name: '梨诺',
      avatarUrl: 'liino-avatar',
      avatarId: 'preview-1683',
      fullBodyId: 'preview-1683',
      isPreview: true,
    })
    expect(targets).toContainEqual({
      itemId: '9999',
      name: '未知角色',
      avatarUrl: 'unknown-avatar',
      avatarId: 'preview-9999',
      fullBodyId: 'preview-9999',
      isPreview: true,
    })
    expect(JSON.stringify(targets)).not.toContain('skland-1683')
  })

  it('maps released names to official IDs regardless of Skland itemId', () => {
    const targets = buildCharacterImageTargets(getCatalogItems(catalogPayload), {
      梨诺: 'chr_0035_liino',
    })
    expect(targets).toContainEqual({
      itemId: '1683',
      name: '梨诺',
      avatarUrl: 'liino-avatar',
      avatarId: 'chr_0035_liino',
      fullBodyId: 'chr_0035_liino',
    })
  })

  it('reads the full-body illustration URL from detail payloads', () => {
    expect(
      getIllustrationUrl({
        data: { item: { document: { extraInfo: { illustration: 'full-body' } } } },
      })
    ).toBe('full-body')
  })
  it('loads all full-body illustrations sequentially and isolates failures', async () => {
    const started: string[] = []
    const targets = buildCharacterImageTargets(getCatalogItems(catalogPayload), {
      佩丽卡: 'chr_0004_pelica',
    })
    const resultPromise = collectIllustrationUrls(targets, (itemId) => {
      started.push(itemId)
      const details: Record<string, unknown> = {
        '5': { data: { item: { document: { extraInfo: { illustration: 'pelica-full' } } } } },
        '89': { data: {} },
        '156': { data: { item: { document: { extraInfo: { illustration: 'female-full' } } } } },
      }
      return Promise.resolve(details[itemId])
    })

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
