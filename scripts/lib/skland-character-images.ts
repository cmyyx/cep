export interface SklandCatalogItem {
  itemId: string
  name: string
  brief: { cover: string }
}

export interface CharacterImageTarget {
  itemId: string
  name: string
  avatarUrl: string
  avatarId?: string
  fullBodyId?: string
}

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null
}

export function getCatalogItems(payload: unknown): SklandCatalogItem[] {
  const data = asRecord(asRecord(payload)?.data)
  const catalog = data?.catalog
  if (!Array.isArray(catalog)) throw new Error('Skland operator catalog is missing')

  const root = catalog.map(asRecord).find((entry) => entry?.id === '1')
  const typeSub = root?.typeSub
  if (!Array.isArray(typeSub)) throw new Error('Skland operator catalog is missing')

  const operators = typeSub.map(asRecord).find((entry) => entry?.id === '1')
  if (!Array.isArray(operators?.items)) throw new Error('Skland operator catalog is missing')

  return operators.items.map((value) => {
    const item = asRecord(value)
    const brief = asRecord(item?.brief)
    if (
      typeof item?.itemId !== 'string' ||
      typeof item.name !== 'string' ||
      typeof brief?.cover !== 'string'
    ) {
      throw new Error('Skland operator catalog contains an invalid item')
    }
    return { itemId: item.itemId, name: item.name, brief: { cover: brief.cover } }
  })
}

interface JsonResponse {
  json(): Promise<unknown>
}

export async function waitForValidCatalogResponse(
  responses: Iterable<Promise<JsonResponse>>
): Promise<unknown> {
  let lastError: unknown
  for (const responsePromise of responses) {
    try {
      const payload = await (await responsePromise).json()
      getCatalogItems(payload)
      return payload
    } catch (error) {
      lastError = error
    }
  }
  throw lastError ?? new Error('Skland operator catalog is missing')
}

export function buildCharacterImageTargets(
  items: SklandCatalogItem[],
  releasedNameToId: Readonly<Record<string, string>>
): CharacterImageTarget[] {
  const targets: CharacterImageTarget[] = []

  for (const item of items) {
    const releasedId = releasedNameToId[item.name]
    if (releasedId) {
      targets.push({
        itemId: item.itemId,
        name: item.name,
        avatarUrl: item.brief.cover,
        avatarId: releasedId,
        fullBodyId: releasedId,
      })
      continue
    }

    if (/^管理员\s*[（(]男[)）]$/.test(item.name)) {
      targets.push({
        itemId: item.itemId,
        name: item.name,
        avatarUrl: item.brief.cover,
        fullBodyId: 'chr_9000_endmin-male',
      })
      continue
    }

    if (/^管理员\s*[（(]女[)）]$/.test(item.name)) {
      targets.push({
        itemId: item.itemId,
        name: item.name,
        avatarUrl: item.brief.cover,
        avatarId: 'chr_9000_endmin',
        fullBodyId: 'chr_9000_endmin-female',
      })
      continue
    }

    if (item.itemId === '1683' && item.name === '梨诺') {
      targets.push({
        itemId: item.itemId,
        name: item.name,
        avatarUrl: item.brief.cover,
        avatarId: 'skland-1683',
      })
    }
  }

  return targets
}

export async function collectIllustrationUrls(
  targets: CharacterImageTarget[],
  loadDetail: (itemId: string) => Promise<unknown>
): Promise<Record<string, string>> {
  const fullBodyTargets = targets.filter(
    (target): target is CharacterImageTarget & { fullBodyId: string } => Boolean(target.fullBodyId)
  )
  const results = await Promise.allSettled(
    fullBodyTargets.map(async (target) => ({
      id: target.fullBodyId,
      url: getIllustrationUrl(await loadDetail(target.itemId)),
    }))
  )
  return Object.fromEntries(
    results.flatMap((result) => result.status === 'fulfilled' ? [[result.value.id, result.value.url]] : [])
  )
}

export function getIllustrationUrl(payload: unknown): string {
  const data = asRecord(asRecord(payload)?.data)
  const item = asRecord(data?.item)
  const document = asRecord(item?.document)
  const extraInfo = asRecord(document?.extraInfo)
  if (typeof extraInfo?.illustration !== 'string' || !extraInfo.illustration) {
    throw new Error('Skland operator illustration is missing')
  }
  return extraInfo.illustration
}
