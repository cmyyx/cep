'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Heart, ChevronDown, ChevronUp, Coffee } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { donors } from '@/lib/donors'

export function DonationSection() {
  const t = useTranslations()
  const [listExpanded, setListExpanded] = useState(false)

  const sortedDonors = useMemo(
    () => [...donors].sort((a, b) => b.amount - a.amount),
    [],
  )

  return (
    <div className="mb-8">
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-4">
        <Heart className="size-4 text-red-500 shrink-0" />
        <h3 className="text-sm font-semibold text-muted-foreground">
          {t('about.donationTitle')}
        </h3>
      </div>

      <div className="rounded-lg p-4 shadow-[var(--shadow-border)] space-y-4">
        {/* 说明文字 */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t('about.donationDesc')}
        </p>

        {/* 支付宝备注提示 */}
        <p className="text-xs text-muted-foreground/70 leading-relaxed">
          {t('about.donationAlipayNote')}
        </p>

        {/* 收款码区域 */}
        <div className="flex flex-wrap items-start gap-4">
          {/* 支付宝 */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative w-36 h-36 rounded-lg overflow-hidden shadow-[var(--shadow-border)]">
              <Image
                src="/images/payment/alipay.jpg"
                alt={t('about.donationAlipay')}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {t('about.donationAlipay')}
            </span>
          </div>

          {/* 微信 */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative w-36 h-36 rounded-lg overflow-hidden shadow-[var(--shadow-border)]">
              <Image
                src="/images/payment/wechatzs.png"
                alt={t('about.donationWechat')}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {t('about.donationWechat')}
            </span>
          </div>
        </div>

        {/* 赞赏名单（可折叠） */}
        <div className="border-t border-border pt-4">
          <Button
            variant="ghost"
            className="w-full justify-between h-auto px-0 py-1 hover:bg-transparent"
            onClick={() => setListExpanded((v) => !v)}
          >
            <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Coffee className="size-3.5" />
              {t('about.donationListTitle')}
            </span>
            {listExpanded ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </Button>

          {listExpanded && (
            <div className="mt-2">
              {sortedDonors.length === 0 ? (
                <p className="text-sm text-muted-foreground/60 py-2 text-center">
                  {t('about.donationEmpty')}
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {sortedDonors.map((donor, index) => (
                    <div
                      key={`${donor.name}-${donor.date ?? ''}-${index}`}
                      className="flex items-center justify-between py-2 first:pt-1 last:pb-1"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">
                            {donor.name}
                          </span>
                          {index === 0 && (
                            <span className="text-[10px] leading-none font-semibold text-amber-500 shrink-0 bg-amber-500/10 rounded-sm px-1 py-0.5">
                              TOP1
                            </span>
                          )}
                          {index === 1 && (
                            <span className="text-[10px] leading-none font-semibold text-neutral-400 shrink-0 bg-neutral-400/10 rounded-sm px-1 py-0.5">
                              TOP2
                            </span>
                          )}
                          {index === 2 && (
                            <span className="text-[10px] leading-none font-semibold text-amber-700/70 shrink-0 bg-amber-700/10 rounded-sm px-1 py-0.5">
                              TOP3
                            </span>
                          )}
                        </div>
                        {donor.message && (
                          <p className="text-xs text-muted-foreground/60 truncate mt-0.5">
                            {donor.message}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-mono font-medium shrink-0 ml-3">
                        ¥{donor.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
