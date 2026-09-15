'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { slugify } from '@/lib/slug'

/** Form buka katalog publik berdasarkan slug showroom. */
export function CatalogLookupForm() {
  const router = useRouter()
  const [slug, setSlug] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const s = slugify(slug)
    if (s.length < 3) {
      setError('Masukkan alamat katalog showroom, contoh: showroom-jaya')
      return
    }
    router.push(`/s/${s}`)
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <label htmlFor="catalog-slug" className="text-sm font-extrabold text-slate-900">
        Buka Katalog Marketing
      </label>
      <p className="mt-0.5 text-xs text-slate-500">
        Punya link dari showroom? Masukkan nama katalognya di sini.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-sm text-slate-400">
            /s/
          </span>
          <Input
            id="catalog-slug"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value)
              setError(null)
            }}
            placeholder="showroom-jaya"
            className="h-11 pl-10 text-sm font-semibold"
            autoComplete="off"
          />
        </div>
        <Button
          type="submit"
          className="h-11 bg-blue-700 px-6 text-sm font-extrabold hover:bg-blue-800"
        >
          Buka Katalog
        </Button>
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>}
    </form>
  )
}
