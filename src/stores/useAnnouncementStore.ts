import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Announcement } from '@/types/announcement'
import { withCacheVersion } from '@/lib/cache-url'
import { announcementHashManifest } from '@/generated/announcement-hash-manifest'

/**
 * Announcement markdown is served `max-age=31536000, immutable`, but the
 * filenames carry no content fingerprint — so the client used to append
 * `?t=Date.now()`, which defeated `immutable` entirely and re-downloaded every
 * file on every navigation. The build emits a content hash per file
 * (`scripts/generate-version.mjs` → `announcementHashManifest`), so the URL now
 * changes only when the content does and the long cache is actually usable.
 *
 * The index (`index.generated.json`) deliberately gets NO version param: it is
 * the only way to discover a new announcement, so it must stay short-lived and
 * revalidate (it is already `max-age=0, must-revalidate` + ETag).
 */
function announcementContentUrl(file: string): string {
  return withCacheVersion(`/announcements/${file}`, announcementHashManifest)
}

interface AnnouncementState {
  announcements: Announcement[]
  readIds: string[]
  isLoading: boolean
  loadError: boolean
  loadAnnouncements: () => Promise<void>
  markAsRead: (id: string) => void
  markAllAsRead: () => void
}

/** Fetch and parse JSON, throwing on a non-OK response. */
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

/** Raw item shape from index.generated.json — content is optional (loaded from .md file) */
interface AnnouncementIndexItem {
  id: string
  title: string
  content?: string
  file?: string
  publishTime: string
  updatedTime?: string
  priority?: 'normal' | 'important'
}

/** Module-level fetch lock so initial isLoading:true (skeleton) doesn't block the first call */
let fetching = false

/**
 * Set once the catalog has loaded successfully in this tab.
 *
 * `AnnouncementLoader` re-runs `loadAnnouncements` on every route change, so
 * without this guard each navigation re-fetched the index plus all four
 * markdown files. Failures deliberately do NOT set it, so a later navigation
 * retries. Urgent notices are unaffected: those come from the ops notice
 * endpoint (polled by EmergencyNoticeBanner), not from this static catalog.
 */
let loadedOnce = false

/**
 * Wait until zustand/persist has restored `readIds` from localStorage.
 * Any `set()` before hydration would re-persist the default empty array and wipe history.
 */
function waitForPersistHydration(): Promise<void> {
  if (useAnnouncementStore.persist.hasHydrated()) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    const unsub = useAnnouncementStore.persist.onFinishHydration(() => {
      unsub()
      resolve()
    })
    // Race: hydration may finish between hasHydrated() check and subscribe
    if (useAnnouncementStore.persist.hasHydrated()) {
      unsub()
      resolve()
    }
  })
}

/**
 * Drop read markers only for announcements confirmed removed from the catalog index.
 * Must NOT use the successfully-loaded content list — failed .md fetches on a slow
 * network would otherwise wipe read history for those IDs.
 */
export function pruneReadIds(readIds: string[], indexIds: ReadonlySet<string>): string[] {
  return readIds.filter((id) => indexIds.has(id))
}

export const useAnnouncementStore = create<AnnouncementState>()(
  persist(
    (set, get) => ({
      announcements: [],
      readIds: [],
      isLoading: true,
      loadError: false,

      loadAnnouncements: async () => {
        // Already loaded in this tab — AnnouncementLoader fires on every route
        // change, and re-fetching here would cost the index round-trip plus all
        // markdown on every navigation.
        if (loadedOnce) return
        // Prevent concurrent fetches (independent of isLoading, which starts as true for skeleton)
        if (fetching) return
        fetching = true

        let didError = false
        // Only an index-level failure blanks the list. When a single markdown file
        // fails, the announcements that did load stay in the store (their banners
        // and unread counts keep working) while `didError` blocks `loadedOnce`, so a
        // later call retries the missing one.
        let indexFailed = false

        try {
          // Ensure persisted readIds are restored before any set() that would re-write storage
          await waitForPersistHydration()

          set({ isLoading: true, loadError: false })

          // Phase 1: fetch the announcement index (the only discovery channel
          // for new announcements, so it stays unversioned and revalidated).
          const indexItems = await fetchJSON<AnnouncementIndexItem[]>(
            '/announcements/index.generated.json'
          )

          if (!Array.isArray(indexItems)) throw new Error('Invalid data format')

          const validatedIndex = indexItems.filter(
            (item): item is AnnouncementIndexItem =>
              typeof item === 'object' &&
              item !== null &&
              typeof item.id === 'string' &&
              typeof item.title === 'string' &&
              typeof item.publishTime === 'string'
          )

          // Catalog IDs from the index — authoritative for pruning read markers.
          // Content may fail to load on slow networks; that must not erase read history.
          const indexIds = new Set(validatedIndex.map((item) => item.id))

          // Phase 2: load .md content in parallel for items that use file references
          const loadedItems = await Promise.all(
            validatedIndex.map(async (item): Promise<Announcement | null> => {
              let content = ''

              if (item.file) {
                try {
                  // Versioned URL: cached for a year, invalidated by content hash.
                  const mdRes = await fetch(announcementContentUrl(item.file))
                  if (mdRes.ok) {
                    content = await mdRes.text()
                  } else {
                    // Fall back to inline content if .md load fails
                    content = typeof item.content === 'string' ? item.content : ''
                    if (!content) {
                      // Recorded as a load error: this announcement is missing, so
                      // the load must not be remembered as complete — the next call
                      // retries it instead of returning early forever.
                      console.error(`[announcements] Failed to load ${item.file} and no inline content for ${item.id}`)
                      didError = true
                      return null
                    }
                  }
                } catch {
                  content = typeof item.content === 'string' ? item.content : ''
                  if (!content) {
                    console.error(`[announcements] Network error loading ${item.file} for ${item.id}`)
                    // Same as above: a missing announcement is a load error, not a
                    // successful load that happens to be short one entry.
                    didError = true
                    return null
                  }
                }
              } else if (typeof item.content === 'string') {
                content = item.content
              } else {
                // Neither file nor content — skip
                return null
              }

              return {
                id: item.id,
                title: item.title,
                content,
                publishTime: item.publishTime,
                updatedTime: item.updatedTime,
                priority: item.priority === 'important' ? 'important' : 'normal',
                file: item.file,
              }
            })
          )

          const announcements: Announcement[] = loadedItems.filter(
            (a): a is Announcement => a !== null
          )

          // Sort: important first, then by publishTime desc
          announcements.sort(
            (a, b) => {
              const aImp = a.priority === 'important' ? 0 : 1
              const bImp = b.priority === 'important' ? 0 : 1
              if (aImp !== bImp) return aImp - bImp
              return new Date(b.publishTime).getTime() - new Date(a.publishTime).getTime()
            }
          )

          const { readIds } = get()
          const pruned = pruneReadIds(readIds, indexIds)

          // Only touch readIds when something was actually removed (deleted announcements).
          // Avoids unnecessary persist writes and accidental empty-array clobbering.
          if (pruned.length !== readIds.length) {
            set({ announcements, readIds: pruned })
          } else {
            set({ announcements })
          }
        } catch {
          didError = true
          indexFailed = true
        } finally {
          // No minimum-display sleep here any more: it existed so the skeleton
          // would not flash while the curtain was still up, but the curtain no
          // longer waits on this task — the sleep only delayed the panel.
          set({
            isLoading: false,
            loadError: didError,
            ...(indexFailed ? { announcements: [] } : {}),
          })
          fetching = false
          // Only a fully clean load is remembered: a failed markdown request (with no
          // inline fallback) leaves the load retryable, so the missing announcement can
          // still appear once the network recovers.
          if (!didError) loadedOnce = true
        }
      },

      markAsRead: (id: string) => {
        const { readIds } = get()
        if (readIds.includes(id)) return
        set({ readIds: [...readIds, id] })
      },

      markAllAsRead: () => {
        const { announcements } = get()
        set({ readIds: announcements.map((a) => a.id) })
      },
    }),
    {
      name: 'cep-announcement-read-ids',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ readIds: state.readIds }),
    }
  )
)

/** Derived selector: count of unread important announcements */
export function useImportantUnreadCount(): number {
  return useAnnouncementStore((s) =>
    s.announcements.filter(
      (a) => a.priority === 'important' && !s.readIds.includes(a.id)
    ).length
  )
}

/**
 * Test helper — clears the module-level fetch guards.
 *
 * `fetching` and `loadedOnce` live outside the store (they must survive
 * re-renders without triggering them), so tests need an explicit reset between
 * cases, same as `resetGameI18nCatalogCacheForTests` in lib/game-i18n-catalogs.
 */
export function resetAnnouncementLoadStateForTests(): void {
  fetching = false
  loadedOnce = false
}
