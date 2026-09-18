/**
 * One-off helper: unduh semua foto unit dari agent-ctx/vehicle-images.json
 * ke public/uploads/ lalu tulis ulang JSON-nya ke path lokal /uploads/...
 * Alasan: next/image hanya mengoptimalkan host terdaftar; URL CDN eksternal
 * (z-cdn.chatglm.cn) memicu error "next-image-unconfigured-host".
 * Jalankan: bun run scripts/localize-vehicle-images.ts
 */
import fs from 'fs'
import path from 'path'

const JSON_PATH = path.join(process.cwd(), 'agent-ctx', 'vehicle-images.json')
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads')

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const raw = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8')) as Record<string, string[]>
const out: Record<string, string[]> = {}

for (const [slug, urls] of Object.entries(raw)) {
  out[slug] = []
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    if (url.startsWith('/uploads/')) {
      out[slug].push(url)
      continue
    }
    const ext = path.extname(new URL(url).pathname) || '.jpg'
    const filename = `${slug}-${i + 1}${ext}`
    const dest = path.join(UPLOADS_DIR, filename)
    if (!fs.existsSync(dest)) {
      console.log(`↓ ${url} -> /uploads/${filename}`)
      const buf = Buffer.from(await fetch(url).then((r) => r.arrayBuffer()))
      fs.writeFileSync(dest, buf)
    }
    out[slug].push(`/uploads/${filename}`)
  }
}

fs.writeFileSync(JSON_PATH, JSON.stringify(out, null, 2))
console.log('✔ vehicle-images.json ditulis ulang ke path lokal')
