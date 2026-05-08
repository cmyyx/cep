'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, type Ref } from 'react'
import { useNavigationStore } from '@/stores/useNavigationStore'

interface NavLinkProps
  extends Omit<React.ComponentPropsWithoutRef<typeof Link>, 'onClick'> {
  loadingLabel?: string
  onClick?: React.MouseEventHandler<HTMLAnchorElement>
  ref?: Ref<HTMLAnchorElement>
}

function resolvePathname(
  href: NavLinkProps['href']
): string | undefined {
  if (typeof href === 'string') {
    return new URL(href, 'http://localhost').pathname
  }
  if (href && typeof href === 'object' && 'pathname' in href) {
    return String(href.pathname || '')
  }
  return undefined
}

/**
 * Wraps next/link to trigger the navigation loading overlay
 * on normal left-clicks (excludes new-tab / modifier-key clicks).
 *
 * Skips overlay when the target href matches the current pathname
 * (same-page clicks would never resolve, causing an infinite spinner).
 *
 * When a navigation is already in-flight and the user clicks back to
 * the current page, the in-flight Next.js transition is cancelled but
 * pathname never changes — so we proactively flush the navigation
 * store to prevent a stuck spinner.
 */
export function NavLink({ loadingLabel, onClick, href, ref, ...props }: NavLinkProps) {
  const pathname = usePathname()
  const startNavigation = useNavigationStore((s) => s.startNavigation)
  const navigateStartTime = useNavigationStore((s) => s.navigateStartTime)
  const finishNavigation = useNavigationStore((s) => s.finishNavigation)

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey ||
        e.button !== 0
      ) {
        onClick?.(e)
        return
      }

      const hrefPathname = resolvePathname(href)

      // Same-page click — pathname won't change so finishNavigation would
      // never fire. If a navigation is already in-flight, the upcoming
      // <Link> navigation (same-URL router.push) will cause Next.js to
      // abandon the in-flight transition. We must flush the store now to
      // avoid a stuck spinner.
      if (hrefPathname !== undefined && pathname === hrefPathname) {
        if (navigateStartTime !== null) {
          finishNavigation()
        }
        onClick?.(e)
        return
      }

      if (loadingLabel) {
        startNavigation(loadingLabel)
      }
      onClick?.(e)
    },
    [onClick, loadingLabel, startNavigation, pathname, href, navigateStartTime, finishNavigation]
  )

  return <Link ref={ref} href={href} onClick={handleClick} {...props} />
}
