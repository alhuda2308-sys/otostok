import type { VehicleStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const MAP: Record<VehicleStatus, { label: string; cls: string }> = {
  available: { label: 'READY', cls: 'bg-emerald-600 text-white' },
  hold: { label: 'HOLD', cls: 'bg-amber-500 text-white' },
  sold: { label: 'TERJUAL', cls: 'bg-red-700 text-white' },
}

/**
 * Badge status unit.
 * Default ukuran kecil (katalog publik). Terima className utk override ukuran
 * (tailwind-merge menangani konflik px/py/text) — Portal Kerja memakai md.
 */
export function StatusBadge({
  status,
  className = '',
}: {
  status: VehicleStatus
  className?: string
}) {
  const s = MAP[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide',
        s.cls,
        className,
      )}
    >
      {s.label}
    </span>
  )
}
