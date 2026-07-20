'use client'

import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { DonationSection } from '@/components/about/donation-section'
import {
  Swords,
  Wrench,
  Calendar,
  Eye,
  ExternalLink,
} from 'lucide-react'

const FEATURE_KEYS = [
  { key: 'essencePlanner', icon: Swords },
  { key: 'refinementPlanner', icon: Wrench },
  { key: 'bannerCalendar', icon: Calendar },
  { key: 'backgroundPreview', icon: Eye },
] as const

const TECH_KEYS = [
  'techFramework',
  'techLanguage',
  'techUI',
  'techState',
  'techForm',
  'techI18n',
  'techDesign',
] as const

const TECH_VALUES: Record<string, string> = {
  techFramework: 'Next.js 16 (App Router)',
  techLanguage: 'TypeScript (strict)',
  techUI: 'Shadcn/UI + Tailwind CSS v4',
  techState: 'Zustand',
  techForm: 'react-hook-form + zod',
  techI18n: 'next-intl (zh-CN / zh-TW / ja / en)',
  techDesign: 'Geist + Vercel Design Language',
}

const LINK_KEYS = [
  { key: 'akedata', url: 'https://akedata.top' },
  { key: 'jeiweb', url: 'https://jeiweb.sirrus.cc/#/' },
] as const

const AD_SLOT_CONTACTS = [
  { key: 'adSlotEmail', value: 'admin@canmoe.com', href: 'mailto:admin@canmoe.com', external: false },
  { key: 'adSlotQQGroup', value: '1045523485', href: null, external: false },
  { key: 'adSlotBilibili', value: null, href: 'https://space.bilibili.com/1580942601', external: true },
] as const

export default function AboutPage() {
  const t = useTranslations()

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
        <SidebarTrigger />
        <h1 className="text-base font-semibold tracking-tight">
          {useTranslations()('nav.about')}
        </h1>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          {/* Hero: left-right layout (stacked on mobile) */}
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8 mb-10">
            <div className="relative w-32 md:w-48 aspect-[9/16] shrink-0">
              <Image
                src="/CEP.png"
                alt="CEP Endfield Planner"
                fill
                className="object-contain mix-blend-multiply dark:mix-blend-screen rounded-lg"
                unoptimized
              />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2 tracking-tight">CEP Endfield Planner</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-1">
                {t('about.description')}
              </p>
              <p className="text-xs text-muted-foreground">
                Cep Endfield Planner &middot; C·E·P
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="outline">AGPL-3.0</Badge>
                <a
                  href="https://github.com/cmyyx/cep"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                >
                  GitHub
                </a>
                <span className="text-xs text-muted-foreground">&copy; 璨梦踏月</span>
              </div>
              <div className="mt-1">
                <a
                  href="mailto:admin@canmoe.com"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                >
                  {t('about.contactEmail')}
                </a>
              </div>
            </div>
          </div>

          {/* Ad slot */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground">{t('about.adSlotTitle')}</h3>
            <div className="rounded-lg p-4 shadow-[var(--shadow-border)]">
              <p className="text-sm text-muted-foreground leading-relaxed">{t('about.adSlotDesc')}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">{t('about.adSlotContact')}：</span>
                {AD_SLOT_CONTACTS.map(({ key: contactKey, value, href, external }) => {
                  const label = t(`about.${contactKey}`)
                  const display = value ? `${label}: ${value}` : label
                  if (!href) {
                    return (
                      <span key={contactKey} className="text-muted-foreground">{display}</span>
                    )
                  }
                  return (
                    <a
                      key={contactKey}
                      href={href}
                      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2 inline-flex items-center gap-1"
                    >
                      {display}
                      {external && <ExternalLink className="size-3" />}
                    </a>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Donation */}
          <DonationSection />

          {/* Acknowledgements & Links */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground">{t('about.acknowledgements')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {LINK_KEYS.map(({ key: linkKey, url }) => (
                <a
                  key={linkKey}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start justify-between gap-3 rounded-lg p-3 shadow-[var(--shadow-border)] transition-shadow hover:shadow-[var(--shadow-card)]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t(`about.${linkKey}Name`)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t(`about.${linkKey}Desc`)}</p>
                  </div>
                  <ExternalLink className="size-4 mt-0.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                </a>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground">{t('about.features')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FEATURE_KEYS.map(({ key: featureKey, icon: Icon }) => (
                <div key={featureKey} className="flex items-start gap-3 rounded-lg p-3 shadow-[var(--shadow-border)]">
                  <Icon className="size-4 mt-0.5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t(`about.${featureKey}`)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t(`about.${featureKey}Desc`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tech stack */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground">{t('about.techStack')}</h3>
            <div className="rounded-lg shadow-[var(--shadow-border)] divide-y divide-border">
              {TECH_KEYS.map((techKey) => (
                <div key={techKey} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-muted-foreground">{t(`about.${techKey}`)}</span>
                  <span className="text-sm font-mono">{TECH_VALUES[techKey]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
