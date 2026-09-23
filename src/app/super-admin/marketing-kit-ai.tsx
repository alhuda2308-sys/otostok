'use client'

import { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'
import {
  Briefcase,
  ClipboardCopy,
  Flame,
  Instagram,
  KeyRound,
  Lightbulb,
  Loader2,
  Megaphone,
  MessageCircle,
  RefreshCcw,
  Sparkles,
  Video,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { copyToClipboard } from '@/lib/format'

/**
 * Tab "Marketing Kit AI" di panel Super Admin.
 *
 * Generator copywriting promosi MotoStock via Gemini AI (gemini-1.5-flash,
 * fallback otomatis ke gemini-2.0-flash bila model utama tak tersedia).
 * Semua pemanggilan AI terjadi di server (/api/ai/generate-copy) — API key
 * dari form hanya dikirim sekali per request dan tidak pernah disimpan.
 */

type ChannelId = 'wa_broadcast' | 'ig_fb_caption' | 'tiktok_reels' | 'meta_google_ads' | 'edukasi_softselling'
type ToneId = 'santai' | 'formal' | 'hardselling'

const CHANNELS: Array<{ id: ChannelId; label: string; desc: string; icon: typeof MessageCircle }> = [
  {
    id: 'wa_broadcast',
    label: 'Broadcast WhatsApp',
    desc: 'Direct pitch ke owner showroom',
    icon: MessageCircle,
  },
  {
    id: 'ig_fb_caption',
    label: 'Caption Instagram & Facebook',
    desc: 'Storytelling & problem-solution',
    icon: Instagram,
  },
  {
    id: 'tiktok_reels',
    label: 'Naskah TikTok / Reels',
    desc: 'Hook 3 detik + body + CTA',
    icon: Video,
  },
  {
    id: 'meta_google_ads',
    label: 'Iklan Meta / Google Ads',
    desc: 'Headline tajam + primary text',
    icon: Megaphone,
  },
  {
    id: 'edukasi_softselling',
    label: 'Edukasi / Soft-Selling',
    desc: 'Tips kelola stok vs solusi MotoStock',
    icon: Lightbulb,
  },
]

const TONES: Array<{ id: ToneId; label: string; desc: string; icon: typeof Briefcase }> = [
  { id: 'santai', label: 'Santai & Akrab', desc: 'Rekan sesama pebisnis motor', icon: Sparkles },
  { id: 'formal', label: 'Formal & Profesional', desc: 'Konsultan teknologi showroom', icon: Briefcase },
  {
    id: 'hardselling',
    label: 'Hard Selling & Urgensi Promo',
    desc: 'Penawaran terbatas / diskon aktivasi',
    icon: Flame,
  },
]

/** Styling markdown hasil AI agar rapi di box responsif. */
const MD_COMPONENTS = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mt-4 text-base font-extrabold text-slate-900 first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mt-4 text-sm font-extrabold text-slate-900 first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mt-3 text-sm font-extrabold text-slate-800 first:mt-0">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="my-2 text-sm leading-relaxed text-slate-700">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="my-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="my-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-extrabold text-slate-900">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
  hr: () => <hr className="my-3 border-slate-200" />,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-2 border-l-4 border-blue-300 bg-blue-50/60 py-1.5 pl-3 pr-2 text-sm italic text-slate-700">
      {children}
    </blockquote>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-800">
      {children}
    </code>
  ),
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-[13px] leading-relaxed text-slate-100">
      {children}
    </pre>
  ),
} as const

export function MarketingKitAi() {
  const [channel, setChannel] = useState<ChannelId>('wa_broadcast')
  const [tone, setTone] = useState<ToneId>('santai')
  const [promo, setPromo] = useState('')
  const [target, setTarget] = useState('')
  const [apiKey, setApiKey] = useState('')

  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [model, setModel] = useState('')
  const [error, setError] = useState<string | null>(null)

  const waShareHref = useMemo(
    () => `https://wa.me/?text=${encodeURIComponent(text)}`,
    [text],
  )

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          tone,
          promo: promo.trim() || undefined,
          target: target.trim() || undefined,
          apiKey: apiKey.trim() || undefined,
        }),
      })
      const data: { text?: string; model?: string; error?: string } = await res
        .json()
        .catch(() => ({}))
      if (!res.ok || !data.text) {
        setError(data.error ?? `Gagal generate (HTTP ${res.status}). Coba lagi.`)
        return
      }
      setText(data.text)
      setModel(data.model ?? '')
      toast.success('Copywriting berhasil dibuat')
    } catch {
      setError('Gagal menghubungi server. Periksa koneksi lalu coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    const ok = await copyToClipboard(text)
    if (ok) toast.success('Tersalin ke clipboard')
    else toast.error('Gagal menyalin — silakan blok teks manual')
  }

  const busy = loading

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-5">
      {/* ================= Form Generator ================= */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
          <Sparkles className="h-4 w-4 text-blue-700" aria-hidden /> Generator Marketing Kit
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Diproses Gemini AI (<span className="font-mono font-bold">gemini-1.5-flash</span>) di
          sisi server.
        </p>

        {/* Channel */}
        <fieldset className="mt-4">
          <legend className="mb-2 text-xs font-bold text-slate-700">1. Channel / Format Konten</legend>
          <div className="grid gap-2">
            {CHANNELS.map((c) => {
              const active = channel === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setChannel(c.id)}
                  className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${
                    active
                      ? 'border-blue-700 bg-blue-50 ring-1 ring-blue-700'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <c.icon
                    className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-blue-700' : 'text-slate-400'}`}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span
                      className={`block text-xs font-extrabold ${active ? 'text-blue-800' : 'text-slate-800'}`}
                    >
                      {c.label}
                    </span>
                    <span className="block text-[11px] text-slate-500">{c.desc}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>

        {/* Tone */}
        <fieldset className="mt-4">
          <legend className="mb-2 text-xs font-bold text-slate-700">2. Tone of Voice</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {TONES.map((t) => {
              const active = tone === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTone(t.id)}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    active
                      ? 'border-blue-700 bg-blue-50 ring-1 ring-blue-700'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <t.icon
                    className={`h-4 w-4 shrink-0 ${active ? 'text-blue-700' : 'text-slate-400'}`}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span
                      className={`block text-xs font-extrabold ${active ? 'text-blue-800' : 'text-slate-800'}`}
                    >
                      {t.label}
                    </span>
                    <span className="block text-[11px] text-slate-500">{t.desc}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </fieldset>

        {/* Opsional */}
        <fieldset className="mt-4 space-y-3">
          <legend className="mb-2 text-xs font-bold text-slate-700">3. Input Opsional</legend>
          <div>
            <label htmlFor="mk-promo" className="mb-1 block text-xs font-bold text-slate-700">
              Promo Khusus
            </label>
            <Input
              id="mk-promo"
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
              placeholder="Contoh: Promo Akhir Bulan Diskon 50% Paket Pro"
              className="h-10 text-sm"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="mk-target" className="mb-1 block text-xs font-bold text-slate-700">
              Target Khusus
            </label>
            <Input
              id="mk-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Contoh: Showroom motor bekas Jabodetabek dengan 2 cabang"
              className="h-10 text-sm"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="mk-apikey" className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-700">
              <KeyRound className="h-3 w-3" aria-hidden /> API Key Gemini (opsional)
            </label>
            <Input
              id="mk-apikey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Kosongkan bila GEMINI_API_KEY sudah di-set di server"
              className="h-10 font-mono text-sm"
              autoComplete="off"
            />
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Menimpa env GEMINI_API_KEY untuk request ini saja — tidak disimpan & tidak pernah
              tampil di browser lain.
            </p>
          </div>
        </fieldset>

        <Button
          type="button"
          onClick={() => void generate()}
          disabled={busy}
          className="mt-4 h-12 w-full bg-blue-700 text-sm font-extrabold text-white hover:bg-blue-600"
        >
          {busy ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> AI sedang menulis…
            </>
          ) : (
            <>
              <Sparkles className="mr-1.5 h-4 w-4" aria-hidden /> Generate Copywriting AI
            </>
          )}
        </Button>
      </section>

      {/* ================= Hasil ================= */}
      <section className="rounded-lg border border-slate-200 bg-white lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-extrabold text-slate-900">Hasil Copywriting</h2>
          {model && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600">
              {model}
            </span>
          )}
        </div>

        <div className="p-4">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-bold leading-relaxed text-red-700"
            >
              ⚠️ {error}
            </div>
          )}

          {!text && !error && (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
              <Sparkles className="h-8 w-8 text-slate-300" aria-hidden />
              <p className="text-sm font-extrabold text-slate-500">Belum ada hasil</p>
              <p className="max-w-sm text-xs leading-relaxed text-slate-400">
                Pilih channel & tone di panel kiri, isi promo/target bila perlu, lalu klik
                &quot;Generate Copywriting AI&quot;. Hasil akan tampil di sini dengan tombol
                salin, test kirim ke WhatsApp, dan regenerate.
              </p>
            </div>
          )}

          {text && (
            <>
              <div className="max-h-[34rem] overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/60 p-4">
                <ReactMarkdown components={MD_COMPONENTS}>{text}</ReactMarkdown>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleCopy()}
                  disabled={busy}
                  className="h-10 flex-1 border-slate-300 text-xs font-extrabold"
                >
                  <ClipboardCopy className="mr-1.5 h-4 w-4" aria-hidden /> Salin Teks
                </Button>
                <Button
                  type="button"
                  asChild
                  disabled={busy}
                  className="h-10 flex-1 bg-emerald-700 text-xs font-extrabold text-white hover:bg-emerald-600"
                >
                  <a href={waShareHref} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden /> Test Kirim ke WhatsApp
                  </a>
                </Button>
                <Button
                  type="button"
                  onClick={() => void generate()}
                  disabled={busy}
                  className="h-10 flex-1 border border-blue-200 bg-blue-50 text-xs font-extrabold text-blue-800 hover:bg-blue-100"
                >
                  <RefreshCcw
                    className={`mr-1.5 h-4 w-4 ${busy ? 'animate-spin' : ''}`}
                    aria-hidden
                  />{' '}
                  Regenerate
                </Button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
