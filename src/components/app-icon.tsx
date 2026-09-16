export function AppIcon({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <img
      src="/icon-1024.png"
      alt="Logo MotoStock"
      className={`${className} rounded-md ring-1 ring-slate-200`}
    />
  )
}
