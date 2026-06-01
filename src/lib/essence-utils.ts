import { dungeons } from '@/data/dungeons'

/** All primary stats (derived from dungeon s1Pool) */
export const ALL_PRIMARY_STATS = [...new Set(dungeons.flatMap((d) => d.s1Pool))].sort()

/** All elemental damage types (derived from dungeon s2Pool) */
export const ALL_ELEMENTAL_DAMAGE = [...new Set(dungeons.flatMap((d) => d.s2Pool))].sort()

/** All special abilities (derived from dungeon s3Pool) */
export const ALL_SPECIAL_ABILITIES = [...new Set(dungeons.flatMap((d) => d.s3Pool))].sort()
