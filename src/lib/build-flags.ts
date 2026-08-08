/** Build-time flags that are intentionally independent from SEO policy. */
export function isDevBuildValue(value: string | undefined): boolean {
  return value === 'true'
}

/** Set NEXT_PUBLIC_DEV_BUILD=true only for the dev deployment. */
export const IS_DEV_BUILD = isDevBuildValue(process.env.NEXT_PUBLIC_DEV_BUILD)
