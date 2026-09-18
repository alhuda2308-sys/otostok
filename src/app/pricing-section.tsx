'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { formatRupiah } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface PricingPlan {
  id: string
  name: string
  tagline: string
  target: string
  /** Harga per bulan (Rp). */
  monthly: number
  /** Harga per tahun (Rp). */
  yearly: number
  features: string[]
  ctaLabel: string
  ctaHref: string
  popular?: boolean
}

type BillingPeriod = 'bulanan' | 'tahunan'

/**
 * Seksi harga landing page — satu-satunya bagian interaktif (client component
 * minimalis). Data paket & link CTA disiapkan server-side lalu dikirim sebagai
 * props, sehingga JS klien tetap seringan mungkin.
 */
export function PricingSection({ plans }: { plans: PricingPlan[] }) {
  const [period, setPeriod] = useState<BillingPeriod>('bulanan')
  const yearly = period === 'tahunan'

  return (
    <div>
      {/* Toggle periode tagihan */}
      <div className="flex justify-center">
        <div
          role="group"
          aria-label="Periode tagihan"
          className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-sm"
        >
          <button
            type="button"
            onClick={() => setPeriod('bulanan')}
            aria-pressed={!yearly}
            className={cn(
              'rounded-full px-4 py-2 text-xs font-extrabold transition-colors sm:px-5 sm:text-sm',
              !yearly ? 'bg-blue-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            Bulanan
          </button>
          <button
            type="button"
            onClick={() => setPeriod('tahunan')}
            aria-pressed={yearly}
            className={cn(
              'rounded-full px-4 py-2 text-xs font-extrabold transition-colors sm:px-5 sm:text-sm',
              yearly ? 'bg-blue-700 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            Tahunan
            <span
              className={cn(
                'ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold',
                yearly ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700',
              )}
            >
              Hemat 2 Bulan
            </span>
          </button>
        </div>
      </div>

      {/* Kartu paket */}
      <div className="mt-10 grid items-stretch gap-5 lg:grid-cols-3">
        {plans.map((plan) => {
          const price = yearly ? plan.yearly : plan.monthly
          const savings = plan.monthly * 12 - plan.yearly
          return (
            <article
              key={plan.id}
              className={cn(
                'relative flex h-full flex-col rounded-2xl border bg-white p-6 shadow-sm',
                plan.popular
                  ? 'border-blue-700 shadow-xl shadow-blue-700/10 ring-2 ring-blue-700 lg:-translate-y-3'
                  : 'border-slate-200',
              )}
            >
              {plan.popular && (
                <p className="absolute -top-3.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-blue-700 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow">
                  <Sparkles className="h-3 w-3" aria-hidden /> Paling Populer
                </p>
              )}

              <header>
                <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                  <h3 className="text-lg font-extrabold text-slate-900">{plan.name}</h3>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-600">
                    {plan.tagline}
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-500">{plan.target}</p>
              </header>

              <div className="mt-5 flex items-end gap-1.5">
                <span className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-[2rem]">
                  {formatRupiah(price)}
                </span>
                <span className="pb-1 text-xs font-bold text-slate-500">
                  /{yearly ? 'tahun' : 'bulan'}
                </span>
              </div>
              <div className="mt-1 min-h-4">
                {yearly && (
                  <p className="text-[11px] font-bold text-emerald-700">
                    Hemat {formatRupiah(savings)} vs langganan bulanan
                  </p>
                )}
              </div>

              <ul className="mt-5 flex-1 space-y-2.5 border-t border-slate-100 pt-5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs leading-relaxed text-slate-700">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                    <span className="font-semibold">{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href={plan.ctaHref}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  'mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg text-sm font-extrabold transition-colors',
                  plan.popular
                    ? 'bg-blue-700 text-white hover:bg-blue-800'
                    : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
                )}
              >
                {plan.ctaLabel}
              </a>
            </article>
          )
        })}
      </div>

      {/* Footer pricing */}
      <div className="mt-10 text-center">
        <p className="text-sm font-semibold text-slate-600">
          Sudah punya kode lisensi?{' '}
          <Link
            href="/activate"
            className="font-extrabold text-blue-700 underline decoration-blue-200 underline-offset-4 transition-colors hover:decoration-blue-700"
          >
            Aktivasi Sekarang
          </Link>
        </p>
        <p className="mt-2 text-[11px] text-slate-400">
          Semua paket termasuk web katalog publik, pembaruan fitur, dan pendampingan setup awal.
        </p>
      </div>
    </div>
  )
}
