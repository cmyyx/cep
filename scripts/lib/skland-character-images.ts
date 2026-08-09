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
  isPreview?: boolean
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

    // Preview characters: not yet in game data, so no official chr_ ID
    // exists. Use a stable `preview-<itemId>` asset ID (the Skland itemId is
    // stable and unique) so the UI can still show real images; the mapping
    // name -> preview ID is emitted into a generated file for the frontend,
    // and once the character ships the released mapping takes over
    // automatically.
    targets.push({
      itemId: item.itemId,
      name: item.name,
      avatarUrl: item.brief.cover,
      avatarId: `preview-${item.itemId}`,
      fullBodyId: `preview-${item.itemId}`,
      isPreview: true,
    })
  }

  return targets
}

export async function collectIllustrationUrls(
  targets: CharacterImageTarget[],
  loadDetail: (itemId: string) => Promise<unknown>
): Promise<Record<string, string>> {
  // Page navigation cannot run concurrently — each detail page visit issues
  // its own signed API request, so walk targets sequentially and skip failures.
  const results: [string, string][] = []
  for (const target of targets) {
    if (!target.fullBodyId) continue
    try {
      results.push([target.fullBodyId, getIllustrationUrl(await loadDetail(target.itemId))])
    } catch {
      // per-target failures are isolated; the caller decides what to do
    }
  }
  return Object.fromEntries(results)
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
