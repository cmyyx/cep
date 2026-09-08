/** One active advertisement slot served by the ops service. */
export interface AdItem {
  id: number
  /** Alt text from the admin console (optional); empty string falls back to the i18n label. */
  title: string
  /** 280x380 creative URL; null when this ad has no desktop creative — the desktop slot then renders nothing. */
  desktopImageUrl: string | null
  /** 320x100 creative URL; null when this ad has no mobile creative — the mobile banner then renders nothing. */
  mobileImageUrl: string | null
  /** Direct https target link; null when the ad is a pure display creative. */
  targetUrl: string | null
}

/** Response shape of GET /api/v1/creatives.json on the ops service. */
export interface AdFeed {
  serverTime: string
  /** Currently active ads, newest starts_at first. */
  ads: AdItem[]
}
