import { NextResponse } from 'next/server'
import { isSuperAuthorized } from '@/lib/super-auth'

export const runtime = 'nodejs'

/**
 * POST /api/ai/generate-copy — Marketing Kit AI Generator (khusus Super Admin).
 *
 * Memanggil Gemini REST API (gemini-1.5-flash, fallback gemini-2.0-flash)
 * di sisi SERVER:
 * - API key TIDAK PERNAH dikirim ke client bundle; diambil dari env
 *   GEMINI_API_KEY, atau ditimpa sementara oleh `apiKey` dari body request
 *   (input opsional di UI Super Admin — dipakai sekali, tidak disimpan).
 * - Auth: cookie sesi otostok_sa (isSuperAuthorized) — sama dengan route
 *   super-admin lainnya.
 *
 * Body  : { channel, tone, promo?, target?, apiKey? }
 * Return: { text } (markdown) atau { error } dengan pesan yang jelas.
 */

/** Model utama (stabil & cepat). Bila tak tersedia utk API Key → fallback. */
const GEMINI_PRIMARY_MODEL = 'gemini-1.5-flash'
const GEMINI_FALLBACK_MODEL = 'gemini-2.0-flash'
const TIMEOUT_MS = 60_000

/** Endpoint REST resmi Google AI: .../v1beta/models/<model>:generateContent */
function geminiUrl(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
}

/** System instruction — copywriter SaaS B2B otomotif (sesuai spesifikasi). */
const SYSTEM_INSTRUCTION = `Anda adalah Copywriter Kelas Dunia spesialis B2B & Software SaaS untuk industri Otomotif (Showroom Motor Bekas di Indonesia). Gaya bahasa persuasif, berbobot, to-the-point, dan berorientasi pada peningkatan penjualan serta efisiensi operasional showroom.

Konteks produk yang dipromosikan (MotoStock):
- Aplikasi web tanpa install untuk manajemen stok showroom motor bekas multi-cabang.
- Fitur inti: web katalog digital per showroom (link mandiri /s/nama-showroom siap dibagikan ke calon pembeli), status unit real-time (Ready / Ditahan / Terjual), catat booking & uang tanda jadi (DP), komisi marketing/makelar terrekap otomatis per unit deal, mutasi kas & laporan laba kotor, cetak nota/kuitansi otomatis, hak akses terpisah owner/admin cabang/staf.
- Harga: mulai Rp99.000/bulan (Paket Starter 30 unit), Paket Pro Rp199.000/bulan (unit unlimited, 3 cabang, multi-akun staf).
- Target pasar: pemilik showroom motor bekas yang masih mencatat stok manual di buku/grup WhatsApp.

Aturan output:
- Bahasa Indonesia natural (bukan terjemahan kaku), format Markdown (bold, bullet, heading kecil bila perlu).
- Jangan mengarang fitur yang tidak ada di konteks produk; jangan menyebut nama showroom/brand lain.
- Selalu akhiri dengan call-to-action yang jelas.`

/** 5 channel konten + arahan format masing-masing. */
const CHANNELS: Record<string, { label: string; directive: string }> = {
  wa_broadcast: {
    label: 'Broadcast WhatsApp',
    directive:
      'Format: Broadcast WhatsApp (direct pitch ke owner showroom). Maksimal ~150 kata, paragraf pendek maksimal 2-3 baris per paragraf, ramah dibaca di HP, gunakan bold untuk poin kunci dan sedikit emoji relevan. Akhiri dengan ajakan balas chat / klaim demo.',
  },
  ig_fb_caption: {
    label: 'Caption Instagram & Facebook',
    directive:
      'Format: Caption Instagram & Facebook Feed dengan alur storytelling & problem-solution: buka dengan persoalan nyata owner showroom, bangun empati, perkenalkan MotoStock sebagai solusi, tutup dengan CTA. Tambahkan 1 blok hashtag relevan (5-8 hashtag) di akhir.',
  },
  tiktok_reels: {
    label: 'Naskah TikTok / Reels',
    directive:
      'Format: Naskah video singkat TikTok/Reels 30-45 detik dengan struktur jelas: HOOK 3 DETIK (kalimat pembuka yang menghentikan scroll), BODY (poin masalah -> demo solusi, tulis sebagai scene/dialog singkat), CALL TO ACTION (ajakan kunjungi link katalog / chat sales). Beri label bagian [HOOK], [BODY], [CTA].',
  },
  meta_google_ads: {
    label: 'Iklan Meta / Google Ads',
    directive:
      'Format: Iklan berbayar. Sajikan 3 alternatif HEADLINE (maks 40 karakter, tajam & spesifik manfaat) lalu 1 PRIMARY TEXT (maks 90 kata, fokus manfaat + bukti + CTA). Tambahkan saran 1 deskripsi singkat (maks 90 karakter).',
  },
  edukasi_softselling: {
    label: 'Edukasi / Soft-Selling',
    directive:
      'Format: Konten edukasi soft-selling. Berikan tips praktis mengelola stok showroom (misal cara mencatat mutasi, mencegah unit dobel tawar, menghitung komisi) dalam bullet yang actionable, lalu tutup dengan paragraf jembatan halus bagaimana MotoStock mengotomatiskan hal tersebut. Tidak ada hard pitch.',
  },
}

/** 3 tone of voice. */
const TONES: Record<string, { label: string; directive: string }> = {
  santai: {
    label: 'Santai & Akrab',
    directive:
      'Tone: santai & akrab seperti rekan sesama pebisnis motor yang ngobrol langsung — kalimat ringkas, sedikit humor sehat, tanpa jargon teknis berlebihan.',
  },
  formal: {
    label: 'Formal & Profesional',
    directive:
      'Tone: formal & profesional seperti konsultan teknologi showroom — data-driven, tenang, kredibel, struktur kalimat rapi, tanpa emoji berlebihan.',
  },
  hardselling: {
    label: 'Hard Selling & Urgensi Promo',
    directive:
      'Tone: hard selling dengan urgensi — tekankan keuntungan langsung, scarcity/urgensi (slot terbatas, promo periode terbatas), ajakan bertindak sekarang, tanpa menjanjikan hal palsu.',
  },
}

function unauthorized() {
  return NextResponse.json(
    { error: 'Akses ditolak. Masuk ke panel Super Admin terlebih dahulu.' },
    { status: 401 },
  )
}

/** Pesan error Gemini yang ramah untuk ditampilkan di UI. */
function friendlyGeminiError(status: number, apiMessage: string, model: string): string {
  if (status === 400 && /api key/i.test(apiMessage)) {
    return 'API Key Gemini tidak valid atau tidak berlaku. Periksa kembali API Key (input form menimpa env GEMINI_API_KEY untuk request ini).'
  }
  if (status === 429) {
    return 'Kuota / rate limit Gemini AI habis untuk API Key ini. Tunggu beberapa saat, atau gunakan API Key lain lewat form.'
  }
  if (status === 403) {
    return 'API Key ditolak (403). Pastikan Generative Language API aktif untuk project Google AI Studio pemilik key.'
  }
  if (status === 503 || status === 500) {
    return 'Model AI sedang sibuk / gangguan sementara. Coba lagi beberapa saat (tombol Regenerate).'
  }
  if (status === 404) {
    return `Model ${model} tidak tersedia untuk API Key ini. Pastikan API Key berasal dari Google AI Studio.`
  }
  const trimmed = apiMessage.trim().slice(0, 240)
  return `Gemini AI menolak request (HTTP ${status}).${trimmed ? ` Detail: ${trimmed}` : ''}`
}

export async function POST(req: Request) {
  if (!isSuperAuthorized(req)) return unauthorized()

  const body: unknown = await req.json().catch(() => ({}))
  const { channel, tone, promo, target, apiKey } = (body ?? {}) as {
    channel?: string
    tone?: string
    promo?: string
    target?: string
    apiKey?: string
  }

  const ch = channel ? CHANNELS[channel] : undefined
  const tn = tone ? TONES[tone] : undefined
  if (!ch || !tn) {
    return NextResponse.json(
      { error: 'Channel atau tone tidak valid. Pilih dari daftar yang tersedia.' },
      { status: 400 },
    )
  }

  // Prioritas API key: input UI (override sementara) → env GEMINI_API_KEY.
  const keyFromForm = typeof apiKey === 'string' ? apiKey.trim() : ''
  const key = keyFromForm || (process.env.GEMINI_API_KEY ?? '').trim()
  if (!key) {
    return NextResponse.json(
      {
        error:
          'GEMINI_API_KEY belum diatur di environment server dan form API Key masih kosong. Isi kolom "API Key Gemini (opsional)" di bawah, atau tambahkan GEMINI_API_KEY di environment lalu deploy ulang.',
        code: 'NO_API_KEY',
      },
      { status: 400 },
    )
  }

  // Prompt pengguna: channel + tone + input opsional.
  const promoLine = promo?.trim()
    ? `Promo khusus yang WAJIB disisipkan: "${promo.trim()}".`
    : 'Tidak ada promo khusus.'
  const targetLine = target?.trim()
    ? `Target audiens khusus: ${target.trim()}.`
    : 'Target audiens: pemilik showroom motor bekas di Indonesia (umum).'

  const userPrompt = [
    'Buatkan copywriting marketing MotoStock.',
    `Jenis konten: ${ch.label}. ${ch.directive}`,
    tn.directive,
    promoLine,
    targetLine,
    'Hasil akhir SIAP PAKAI (tinggal salin-tempel), tanpa komentar di luar konten.',
  ].join('\n')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  const requestBody = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 1, // variasi cukup untuk tombol Regenerate
      maxOutputTokens: 2048,
    },
  })

  try {
    // Percobaan 1 — model utama (endpoint: models/gemini-1.5-flash).
    let usedModel = GEMINI_PRIMARY_MODEL
    let res = await fetch(geminiUrl(usedModel), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        // Key lewat header — tidak ikut tampil di URL/log akses.
        'x-goog-api-key': key,
      },
      body: requestBody,
    })
    let payload: unknown = await res.json().catch(() => null)

    // Fallback — bila model utama 404 (tidak tersedia untuk API Key ini),
    // coba sekali lagi dengan model cadangan gemini-2.0-flash.
    if (!res.ok && res.status === 404 && GEMINI_FALLBACK_MODEL) {
      usedModel = GEMINI_FALLBACK_MODEL
      res = await fetch(geminiUrl(usedModel), {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key,
        },
        body: requestBody,
      })
      payload = await res.json().catch(() => null)
    }

    if (!res.ok) {
      const apiMessage =
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error?: { message?: string } }).error?.message ?? '')
          : ''
      return NextResponse.json(
        {
          error: friendlyGeminiError(res.status, apiMessage, usedModel),
          code: `GEMINI_${res.status}`,
        },
        { status: 502 },
      )
    }

    // Ekstrak teks gabungan dari semua part kandidat pertama.
    let text = ''
    if (payload && typeof payload === 'object' && 'candidates' in payload) {
      const candidates = (
        payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
      ).candidates
      const parts = candidates?.[0]?.content?.parts ?? []
      text = parts
        .map((p) => p.text ?? '')
        .join('')
        .trim()
    }
    if (!text) {
      return NextResponse.json(
        {
          error:
            'AI tidak mengembalikan hasil (kemungkinan prompt disaring safety filter). Ubah sedikit input lalu Regenerate.',
          code: 'EMPTY_RESULT',
        },
        { status: 502 },
      )
    }

    return NextResponse.json({ text, model: usedModel })
  } catch (e) {
    const aborted = e instanceof Error && e.name === 'AbortError'
    return NextResponse.json(
      {
        error: aborted
          ? 'Waktu tunggu AI habis (60 detik). Coba lagi — biasanya berhasil pada percobaan berikutnya.'
          : 'Gagal menghubungi layanan Gemini AI. Periksa koneksi server lalu coba lagi.',
        code: aborted ? 'TIMEOUT' : 'NETWORK',
      },
      { status: 502 },
    )
  } finally {
    clearTimeout(timer)
  }
}
