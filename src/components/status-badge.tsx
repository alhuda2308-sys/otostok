import type { VehicleStatus } from '@/lib/types'

const MAP: Record<VehicleStatus, { label: string; cls: string }> = {
  available: { label: 'READY', cls: 'bg-emerald-600 text-white' },
  hold: { label: 'HOLD', cls: 'bg-amber-500 text-white' },
  sold: { label: 'TERJUAL', cls: 'bg-red-700 text-white' },
}

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
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${s.cls} ${className}`}
    >
      {s.label}
    </span>
  )
}
