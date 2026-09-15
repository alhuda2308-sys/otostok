'use client'

import { Input } from '@/components/ui/input'
import { formatNumber } from '@/lib/format'

/** Input angka uang Rupiah dengan pemisah ribuan otomatis (cth: 18.500.000). */
export function MoneyInput({
  value,
  onChange,
  placeholder,
  id,
  className,
}: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  id?: string
  className?: string
}) {
  return (
    <Input
      id={id}
      inputMode="numeric"
      className={className ?? 'h-11 text-sm font-bold'}
      placeholder={placeholder ?? '0'}
      value={value == null ? '' : formatNumber(value)}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '')
        onChange(digits ? parseInt(digits, 10) : null)
      }}
    />
  )
}
