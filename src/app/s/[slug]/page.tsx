import type { Metadata } from 'next'
import { CatalogClient } from './catalog-client'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  return {
    title: `Katalog ${slug}`,
    description:
      'Katalog stok motor bekas untuk tim marketing — harga jelas, komisi transparan, siap diposting.',
  }
}

export default async function CatalogPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <main className="flex-1">
      <CatalogClient slug={slug} />
    </main>
  )
}
