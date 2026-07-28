import { getLocale, getTranslations } from 'next-intl/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { WikiMaterialList } from '@/components/shared/wiki-material-list'
import { WikiRichText } from '@/components/wiki/wiki-rich-text'
import { WikiTable, WikiTableFrame } from '@/components/wiki/wiki-table'
import {
  AdministratorHero,
  CharacterLevelTableIsland,
  CharacterSkillLevelsIsland,
  MaterialDisclosureClient,
  PotentialImageDialog,
  WeaponLevelTableIsland,
  WeaponSkillLevelsIsland,
  WikiAssetIcon,
  WikiDetailHero,
} from '@/components/wiki/wiki-detail-interactive'
import {
  EQUIPMENT_STAT_LEVELS,
  getAdjacentSpans,
  getCharacterDetailSectionIds,
  getEquipmentDetailSectionIds,
  formatWikiStatText,
  getEquipmentStatValues,
  getSkillDisplayVariants,
  getVoiceActorDisplayName,
  groupCharacterLogisticsSkills,
  isCharacterLevelStat,
  packCharacterLevels,
  packSkillLevels,
  packWeaponLevels,
} from '@/components/wiki/wiki-detail-utils'
import { cn } from '@/lib/utils'
import { localizeText, type LocalizeDeep } from '@/lib/wiki-locale-detail'
import wikiEnums from '@/generated/data/wiki/enums.json'
import equipStatsEn from '@/generated/i18n/equipStats/en.json'
import equipStatsJa from '@/generated/i18n/equipStats/ja.json'
import equipStatsZhCN from '@/generated/i18n/equipStats/zh-CN.json'
import equipStatsZhTW from '@/generated/i18n/equipStats/zh-TW.json'
import type {
  LocalizedText,
  WikiCharacterDetail,
  WikiEquipmentDetail,
  WikiLocale,
  WikiWeaponDetail,
} from '@/types/wiki'

export {
  EQUIPMENT_STAT_LEVELS,
  easeWikiScroll,
  getAdjacentSpans,
  getCharacterDetailSectionIds,
  getEquipmentDetailSectionIds,
  getEquipmentStatValues,
  getSkillDisplayVariants,
  getVisibleCharacterLevels,
  getVisibleSkillLevels,
  getVisibleWeaponLevels,
  getVoiceActorDisplayName,
  getWidestTableValue,
  isCharacterLevelStat,
} from '@/components/wiki/wiki-detail-utils'

export { WikiDetailShell, WikiDetailHero, WIKI_DETAIL_HERO_META_CLASS } from '@/components/wiki/wiki-detail-interactive'

/**
 * 装备属性/特效名优先查 equipStats 目录 (含 AllSkillDamageIncrease 等字符串 id),
 * enums.json attributes 仅覆盖数字 id。服务端专用, 不进客户端载荷。
 * 与客户端 useWikiTranslations().equipmentStatLabel 的查找顺序保持一致。
 */
const equipStatsCatalogs: Record<WikiLocale, Record<string, string>> = {
  'zh-CN': equipStatsZhCN,
  'zh-TW': equipStatsZhTW,
  ja: equipStatsJa,
  en: equipStatsEn,
}


type CharacterDetailView = LocalizeDeep<WikiCharacterDetail>
type WeaponDetailView = LocalizeDeep<WikiWeaponDetail>
type EquipmentDetailView = LocalizeDeep<WikiEquipmentDetail>
type LocaleText = string | LocalizedText
type MaterialRef = { itemId: string; count: number; name?: LocaleText; iconId?: string; rarity?: number }

function textOf(value: LocaleText | undefined | null, locale: string): string {
  return localizeText(value, locale)
}

function Section({
  id,
  title,
  actions,
  children,
}: {
  id: string
  title: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-4">
      <Card size="sm" className="min-w-0 gap-3">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          {/* CardTitle 渲染的是 <div>, 区块标题必须是真 heading, 否则"技能/天赋/潜能"
              这一层在文档大纲里整层缺失 (读屏按 H 会从"声优"直接跳到某个技能名)。
              类名与 CardTitle 保持一致 (size=sm 由 group-data 变体降到 text-sm)。 */}
          <h2 className="font-heading text-base font-medium leading-snug group-data-[size=sm]/card:text-sm">{title}</h2>
          {actions}
        </CardHeader>
        <CardContent className="min-w-0">{children}</CardContent>
      </Card>
    </section>
  )
}

function MaterialList({ materials }: { materials: MaterialRef[] }) {
  // Client list expands refs via WikiMaterialCatalogProvider.
  return <WikiMaterialList materials={materials} />
}

function MaterialDisclosure({ materials }: { materials?: MaterialRef[] }) {
  return <MaterialDisclosureClient materials={materials ?? []} />
}

interface CharacterMetaRow {
  label: string
  value: string
}

async function CharacterMetaTables({
  rows,
  voices,
}: {
  rows: CharacterMetaRow[]
  voices: CharacterDetailView['cvNames']
}) {
  const t = await getTranslations()
  const locale = (await getLocale()) as WikiLocale
  return (
    <div className={cn('grid min-w-0 items-start gap-3', voices.length > 0 && 'min-[1280px]:grid-cols-2')}>
      <div className="min-w-0 overflow-hidden rounded-md shadow-[var(--shadow-border)]">
        <h3 className="bg-muted/50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-foreground">{t('wiki.baseInfo')}</h3>
        <dl className="grid grid-cols-[minmax(5rem,auto)_minmax(0,1fr)] sm:grid-cols-[minmax(5rem,auto)_minmax(0,1fr)_minmax(5rem,auto)_minmax(0,1fr)]">
          {rows.map((row) => (
            <div key={row.label} className="grid min-w-0 grid-cols-subgrid col-span-2 items-center shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.08)]">
              <dt className="px-2 py-2 text-muted-foreground">{row.label}</dt>
              <dd className="min-w-0 break-words px-2 py-2 font-medium text-foreground shadow-[inset_1px_0_0_0_rgba(0,0,0,0.08)]">{row.value || '—'}</dd>
            </div>
          ))}
        </dl>
      </div>
      {voices.length > 0 && (
        <div className="min-w-0 overflow-hidden rounded-md shadow-[var(--shadow-border)]">
          <h3 className="bg-muted/50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-foreground">{t('wiki.cv')}</h3>
          <dl className="grid grid-cols-[minmax(5rem,auto)_minmax(0,1fr)] sm:grid-cols-[minmax(5rem,auto)_minmax(0,1fr)_minmax(5rem,auto)_minmax(0,1fr)]">
            {voices.map((voice) => (
              <div key={voice.language} className="grid min-w-0 grid-cols-subgrid col-span-2 items-center shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.08)]">
                <dt className="px-2 py-2 text-muted-foreground">{t(`wiki.voiceLanguages.${voice.language}`)}</dt>
                <dd className="min-w-0 break-words px-2 py-2 font-medium text-foreground shadow-[inset_1px_0_0_0_rgba(0,0,0,0.08)]">
                  {getVoiceActorDisplayName(voice, locale)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}

export async function CharacterDetailContent({
  detail,
  name,
  rarity,
  imageIds,
  metaRows,
}: {
  detail: CharacterDetailView
  name: string
  rarity: number
  imageIds: CharacterDetailView['images']
  metaRows: CharacterMetaRow[]
}) {
  const t = await getTranslations()
  const locale = (await getLocale()) as WikiLocale
  const attributes = (wikiEnums as { attributes: Record<string, LocalizedText> }).attributes
  const skillTypes = (wikiEnums as { skillTypes: Record<string, LocalizedText> }).skillTypes
  const sections = new Set(getCharacterDetailSectionIds(detail))
  const fullBodyIds = imageIds.fullBodyIds
  const isAdministrator = Boolean(fullBodyIds.male && fullBodyIds.female)
  const attributeIds = (detail.levels[0]?.stats.map((stat) => stat.attributeId) ?? []).filter(isCharacterLevelStat)
  const attributeLabels = Object.fromEntries(
    attributeIds.map((id) => [id, textOf(attributes[id] ?? { 'zh-CN': id, en: id, ja: id, 'zh-TW': id }, locale)]),
  )
  const meta = (
    // hero 的 meta 容器是 flex-wrap; 干员这块是整宽的表格网格, 需显式占满行宽。
    <div className="w-full min-w-0">
      <CharacterMetaTables
        rows={[
          ...metaRows,
          ...detail.fixedStats.map((stat) => ({
            label: textOf(attributes[stat.attributeId] ?? { 'zh-CN': stat.attributeId, en: stat.attributeId, ja: stat.attributeId, 'zh-TW': stat.attributeId }, locale),
            value: String(stat.value),
          })),
        ]}
        voices={detail.cvNames}
      />
    </div>
  )

  return (
    <>
      {isAdministrator && fullBodyIds.female && fullBodyIds.male ? (
        <AdministratorHero
          name={name}
          rarity={rarity}
          meta={meta}
          femaleImage={fullBodyIds.female}
          maleImage={fullBodyIds.male}
          femaleLabel={t('wiki.female')}
          maleLabel={t('wiki.male')}
          switchToFemaleLabel={t('wiki.switchToVariant', { variant: t('wiki.female') })}
          switchToMaleLabel={t('wiki.switchToVariant', { variant: t('wiki.male') })}
        />
      ) : (
        <WikiDetailHero
          name={name}
          rarity={rarity}
          imagePath={`/images/characters/full/${fullBodyIds.default ?? imageIds.defaultAvatarId}.avif`}
          imageClassName="object-contain object-bottom"
          meta={meta}
        />
      )}
      <div className="mt-5 min-w-0 space-y-4">
        {/* 等级表容器留在服务端用 Section 包裹, 孤岛只负责表格与展开按钮,
            这样全页只有一套卡片规格 (Card size="sm")。 */}
        <Section id="level-data" title={t('wiki.levelData')}>
          <CharacterLevelTableIsland
            levels={packCharacterLevels(detail.levels)}
            attributeIds={attributeIds}
            attributeLabels={attributeLabels}
          />
        </Section>
        {sections.has('attribute-nodes') && (
          <Section id="attribute-nodes" title={t('wikiData.ui|attributeIncrease')}>
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              {detail.attributeNodes.map((node) => (
                <article key={node.id} className="flex min-w-0 items-start justify-between gap-3 rounded-md bg-muted/35 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{textOf(node.title, locale)}</h3>
                      <Badge variant="secondary">{t('wiki.breakStage')} {node.breakStage}</Badge>
                      {/* 真正的解锁门槛是信赖度 (0/60/150/300), 只显示突破阶段会漏掉一半条件。 */}
                      {node.favorability > 0 && (
                        <Badge variant="secondary">{t('wikiData.ui|friendship')} {node.favorability}</Badge>
                      )}
                    </div>
                    <WikiRichText value={textOf(node.description, locale)} className="mt-1 block text-sm leading-relaxed text-muted-foreground" />
                    {node.stats.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {node.stats
                          .map((stat) => `${textOf(attributes[stat.attributeId] ?? { 'zh-CN': stat.attributeId, en: stat.attributeId, ja: stat.attributeId, 'zh-TW': stat.attributeId }, locale)} +${stat.value}`)
                          .join(' / ')}
                      </p>
                    )}
                  </div>
                  {/* 桌面下触发器是单行图标行 (这里恒为 2 种材料), 窄屏退回文字, 两种形态都不换行。 */}
                  <div className="min-w-0">
                    <MaterialDisclosure materials={node.materials} />
                  </div>
                </article>
              ))}
            </div>
          </Section>
        )}
        {sections.has('equipment-nodes') && (
          <Section id="equipment-nodes" title={t('wikiData.ui|equipmentAdaptation')}>
            <div className="grid min-w-0 gap-3 md:grid-cols-3">
              {detail.equipmentNodes.map((node) => (
                <article key={node.id} className="min-w-0 rounded-md bg-muted/35 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium">{textOf(node.name, locale)}</h3>
                    <Badge variant="secondary">{t('wiki.breakStage')} {node.breakStage}</Badge>
                  </div>
                  <WikiRichText value={textOf(node.description, locale)} className="mt-1 block text-sm leading-relaxed text-muted-foreground" />
                  <div className="mt-3">
                    <MaterialList materials={node.materials} />
                  </div>
                </article>
              ))}
            </div>
          </Section>
        )}
        <Section id="skills" title={t('wikiData.ui|operatorSkill')}>
          <div className="space-y-5">
            {detail.skills.map((skill) => {
              const variants = getSkillDisplayVariants(skill)
              const skillName = textOf(skill.name, locale)
              const skillDesc = textOf(skill.description, locale)
              return (
                <article key={skill.id} className="min-w-0 rounded-lg bg-muted/25 p-3 sm:p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <WikiAssetIcon path={`/images/wiki/skills/${skill.iconId}.avif`} alt={skillName} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{skillName}</h3>
                        <Badge variant="secondary">
                          {textOf(skillTypes[skill.typeId] ?? { 'zh-CN': skill.typeId, en: skill.typeId, ja: skill.typeId, 'zh-TW': skill.typeId }, locale)}
                        </Badge>
                      </div>
                      {skillDesc && skillDesc !== '0' ? (
                        <WikiRichText value={skillDesc} className="mt-1 block text-sm leading-relaxed text-muted-foreground" />
                      ) : null}
                    </div>
                  </div>
                  {variants.length > 0 ? (
                    <div className="mt-3 min-w-0 space-y-3">
                      {variants.map((variant) => (
                        <div key={variant.id} className="min-w-0 rounded-md bg-background p-3 shadow-[var(--shadow-border)]">
                          <div className="flex min-w-0 items-start gap-3">
                            <WikiAssetIcon path={`/images/wiki/skills/${variant.iconId}.avif`} alt={textOf(variant.name, locale)} />
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-medium">{textOf(variant.name, locale)}</h4>
                              <WikiRichText value={textOf(variant.condition, locale)} className="mt-1 block text-xs leading-relaxed text-muted-foreground" />
                              <WikiRichText value={textOf(variant.description, locale)} className="mt-2 block text-sm leading-relaxed" />
                            </div>
                          </div>
                          <div className="mt-3 min-w-0">
                            <CharacterSkillLevelsIsland
                              skillId={variant.id}
                              metrics={variant.metrics.map((metric) => ({ id: metric.id, label: textOf(metric.label, locale) }))}
                              levels={packSkillLevels(variant.levels)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 min-w-0">
                      <CharacterSkillLevelsIsland
                        skillId={skill.id}
                        metrics={skill.metrics.map((metric) => ({ id: metric.id, label: textOf(metric.label, locale) }))}
                        levels={packSkillLevels(skill.levels)}
                      />
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </Section>
        <Section id="talents" title={t('wikiData.ui|talent')}>
          <div className="space-y-4">
            {detail.talents.map((talent) => (
              <article key={talent.id} className="flex min-w-0 gap-3">
                {talent.iconId && <WikiAssetIcon path={`/images/wiki/skills/${talent.iconId}.avif`} alt={textOf(talent.name, locale)} />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{textOf(talent.name, locale)}</h3>
                      <Badge variant="secondary">{t('wiki.breakStage')} {talent.breakStage}</Badge>
                    </div>
                    {talent.breakStage === 0 && talent.materials.length === 0 ? (
                      <Badge variant="secondary">{t('wiki.defaultUnlocked')}</Badge>
                    ) : (
                      <MaterialDisclosure materials={talent.materials} />
                    )}
                  </div>
                  <WikiRichText value={textOf(talent.description, locale)} className="mt-1 block text-sm leading-relaxed text-muted-foreground" />
                </div>
              </article>
            ))}
          </div>
        </Section>
        <Section id="potentials" title={t('wikiData.ui|potential')}>
          <div className="space-y-5">
            {detail.potentials.map((potential) => {
              const potentialName = textOf(potential.name, locale)
              return (
                <article key={potential.id} className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{potentialName}</h3>
                    <Badge variant="secondary">{t('wikiData.ui|potentialLevel')} {potential.level}</Badge>
                  </div>
                  <WikiRichText value={textOf(potential.description, locale)} className="mt-1 block text-sm leading-relaxed text-muted-foreground" />
                  {potential.imageIds.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-3">
                      {potential.imageIds.map((imageId) => (
                        <PotentialImageDialog
                          key={imageId}
                          name={potentialName}
                          imagePath={`/images/wiki/character-potential/${imageId}.avif`}
                          openLabel={t('wiki.openPotentialPreview', { name: potentialName })}
                        />
                      ))}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </Section>
        {sections.has('logistics-skills') && (
          <Section id="logistics-skills" title={t('wikiData.ui|logisticsSkill')}>
            {/* 一个后勤位 = 一张卡片, 卡内按档位 (β/γ) 逐条列出。
                只渲染首档会丢掉 ·γ 的名称/解锁提示/描述, 且材料会错指到首档。 */}
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              {groupCharacterLogisticsSkills(detail.logisticsSkills, detail.logisticsNodes).map((group) => (
                <article key={group.index} className="min-w-0 rounded-md bg-muted/25 p-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {group.iconId && (
                      <WikiAssetIcon
                        path={`/images/wiki/logistics/${group.iconId}.avif`}
                        alt={textOf(group.tiers[0]?.skill.name, locale)}
                      />
                    )}
                    <div className="min-w-0 flex-1 space-y-2">
                      {group.tiers.map(({ skill, node }) => (
                        <div key={skill.id} className="min-w-0 rounded-md bg-background p-2.5 shadow-[var(--shadow-border)]">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <h3 className="text-sm font-medium">{textOf(skill.name, locale)}</h3>
                            <Badge variant="secondary" className="shrink-0">{textOf(skill.unlockHint, locale)}</Badge>
                          </div>
                          <WikiRichText value={textOf(skill.description, locale)} className="mt-1 block text-sm leading-relaxed text-muted-foreground" />
                          {node && node.materials.length > 0 && (
                            <div className="mt-2">
                              <MaterialDisclosure materials={node.materials} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </Section>
        )}
        <Section id="promotions" title={t('wikiData.ui|promotion')}>
          <div className="grid min-w-0 gap-3 lg:grid-cols-2">
            {detail.promotions.map((promotion) => (
              <article key={promotion.breakStage} className="min-w-0 rounded-md bg-muted/35 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">{t('wiki.breakStage')} {promotion.breakStage}</h3>
                  <span className="font-geist-mono text-xs text-muted-foreground">Lv.{promotion.requiredLevel}</span>
                </div>
                <MaterialList materials={promotion.materials} />
              </article>
            ))}
          </div>
        </Section>
      </div>
    </>
  )
}

export async function WeaponDetailContent({
  detail,
  name,
  rarity,
  imageId,
  meta,
}: {
  detail: WeaponDetailView
  name: string
  rarity: number
  imageId: string
  meta: React.ReactNode
}) {
  const t = await getTranslations()
  const locale = (await getLocale()) as WikiLocale
  return (
    <>
      <WikiDetailHero name={name} rarity={rarity} imagePath={`/images/weapon/${imageId}.avif`} meta={meta} />
      <div className="mt-5 min-w-0 space-y-4">
        <Section id="level-data" title={t('wiki.levelData')}>
          <WeaponLevelTableIsland levels={packWeaponLevels(detail.levels)} />
        </Section>
        <Section id="skills" title={t('wiki.skills')}>
          <div className="space-y-5">
            {detail.skills.map((skill) => (
              <article key={skill.id} className="min-w-0 rounded-md bg-muted/25 p-3">
                <h3 className="font-medium">{textOf(skill.name, locale)}</h3>
                <WeaponSkillLevelsIsland
                  skillId={skill.id}
                  levels={skill.levels.map((level) => ({
                    level: level.level,
                    description: textOf(level.description, locale),
                  }))}
                />
              </article>
            ))}
          </div>
        </Section>
        <Section id="breakthroughs" title={t('wiki.breakthroughs')}>
          <div className="grid min-w-0 gap-3 lg:grid-cols-2">
            {detail.breakthroughs.map((breakthrough) => (
              <article key={breakthrough.stage} className="min-w-0 rounded-md bg-muted/35 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">{t('wiki.breakStage')} {breakthrough.stage}</h3>
                  <span className="font-geist-mono text-xs text-muted-foreground">Lv.{breakthrough.requiredLevel}</span>
                </div>
                <MaterialList materials={breakthrough.materials} />
              </article>
            ))}
          </div>
        </Section>
      </div>
    </>
  )
}

function statValues(values: Array<string | number>) {
  return values.map((value) => {
    const text = String(value)
    return text.includes('+') ? text.slice(text.indexOf('+') + 1) : text
  })
}

export async function EquipmentDetailContent({
  detail,
  name,
  rarity,
  imageId,
  meta,
}: {
  detail: EquipmentDetailView
  name: string
  rarity: number
  imageId: string
  meta: React.ReactNode
}) {
  const t = await getTranslations()
  const locale = (await getLocale()) as WikiLocale
  const attributes = (wikiEnums as { attributes: Record<string, LocalizedText> }).attributes
  const sections = new Set(getEquipmentDetailSectionIds(detail))
  return (
    <>
      <WikiDetailHero name={name} rarity={rarity} imagePath={`/images/equip/${imageId}.avif`} meta={meta} />
      <div className="mt-5 min-w-0 space-y-4">
        <Section id="stats" title={t('wiki.stats')}>
          {/* TableCell 默认 whitespace-nowrap: 390px + ja 下 "全スキルダメージUP" 会压住 +0 列的数值。
              走 WikiTableFrame 的横向滚动 + 首列可换行, 而不是让两列互相挤压。 */}
          <WikiTableFrame className="min-w-[30rem]">
            <WikiTable className="table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/35 hover:bg-muted/35">
                  <TableHead className="w-[36%]">{t('wiki.stats')}</TableHead>
                  {EQUIPMENT_STAT_LEVELS.map((level) => (
                    <TableHead key={level} className="text-center">+{level}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.stats.map((stat) => {
                  const exactValues = statValues(getEquipmentStatValues(stat))
                  // 先格式化再算合并: 上游 46.32737219 这类值收敛到 46.33 后相邻列才判等。
                  const values = exactValues.map(formatWikiStatText)
                  const spans = getAdjacentSpans(values)
                  const label =
                    stat.attributeId === 'baseAttack'
                      ? t('wiki.baseAttack')
                      : equipStatsCatalogs[locale][stat.attributeId] ??
                        textOf(attributes[stat.attributeId] ?? { 'zh-CN': stat.attributeId, en: stat.attributeId, ja: stat.attributeId, 'zh-TW': stat.attributeId }, locale)
                  return (
                    <TableRow key={stat.attributeId}>
                      <TableCell className="whitespace-normal break-words leading-tight">{label}</TableCell>
                      {values.map((value, level) =>
                        spans[level] > 0 ? (
                          <TableCell
                            key={level}
                            colSpan={spans[level]}
                            title={exactValues[level] === value ? undefined : exactValues[level]}
                            className="text-center align-middle font-geist-mono"
                          >
                            {value}
                          </TableCell>
                        ) : null,
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </WikiTable>
          </WikiTableFrame>
        </Section>
        {sections.has('suit-effects') && (
          <Section id="suit-effects" title={t('wiki.suitEffects')}>
            <div className="space-y-4">
              {detail.suitEffects.map((effect) => (
                <article key={effect.id} className="min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium">{textOf(effect.name, locale)}</h3>
                    <Badge variant="secondary">{t('wiki.requiredPieces', { count: effect.requiredPieces })}</Badge>
                  </div>
                  <WikiRichText value={textOf(effect.description, locale)} className="mt-1 block text-sm leading-relaxed text-muted-foreground" />
                </article>
              ))}
            </div>
          </Section>
        )}
        <Section id="crafting-materials" title={t('wiki.craftingMaterials')}>
          <div className="space-y-3">
            {detail.craftingRecipes.map((recipe) => (
              <article key={recipe.chainId} className="min-w-0 rounded-md bg-muted/35 p-3">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{t('wiki.recipe')} #{recipe.chainId}</h3>
                  {recipe.isDefault && <Badge>{t('wiki.defaultRecipe')}</Badge>}
                  {recipe.discount > 0 && recipe.discount < 1 && (
                    <Badge variant="secondary" className="text-ship-red">-{Math.round((1 - recipe.discount) * 100)}%</Badge>
                  )}
                </div>
                <MaterialList materials={recipe.materials} />
              </article>
            ))}
          </div>
        </Section>
      </div>
    </>
  )
}
