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

/**
 * Wraps next/link to trigger the navigation loading overlay
 * on normal left-clicks (excludes new-tab / modifier-key clicks).
 *
 * Skips overlay when the target href matches the current pathname
 * (same-page clicks would never resolve, causing an infinite spinner).
 */
export function NavLink({ loadingLabel, onClick, href, ref, ...props }: NavLinkProps) {
  const pathname = usePathname()
  const startNavigation = useNavigationStore((s) => s.startNavigation)

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

      // Skip overlay for same-page clicks — pathname won't change,
      // so finishNavigation would never fire.
      const hrefPathname =
        typeof href === 'string'
          ? new URL(href, 'http://localhost').pathname
          : href && typeof href === 'object' && 'pathname' in href
            ? String(href.pathname || '')
            : undefined
      if (hrefPathname !== undefined && pathname === hrefPathname) {
        onClick?.(e)
        return
      }

      if (loadingLabel) {
        startNavigation(loadingLabel)
      }
      onClick?.(e)
    },
    [onClick, loadingLabel, startNavigation, pathname, href]
  )

  return <Link ref={ref} href={href} onClick={handleClick} {...props} />
}
