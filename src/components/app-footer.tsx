export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-1 px-4 py-4 text-xs text-slate-500 sm:flex-row">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-extrabold text-blue-700">OtoStok</span>
        </div>
        <p>
          Software stok &amp; katalog showroom motor bekas — &copy; {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  )
}
