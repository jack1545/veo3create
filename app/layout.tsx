import './globals.css'
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="min-h-screen bg-gray-50 text-gray-900 overflow-x-hidden">
        <header className="sticky top-0 z-20 bg-white border-b shadow-sm">
          <nav className="max-w-screen-xl mx-auto px-4 flex items-center gap-2 sm:gap-6 py-2 sm:py-3">
            <a href="/" className="font-semibold text-brand hover:opacity-90 transition-opacity px-2 py-1 rounded">API Guide</a>
            <a href="/veo3" className="hover:text-brand transition-colors px-2 py-1 rounded hover:bg-gray-50">Veo3</a>
            <a href="/sora2" className="hover:text-brand transition-colors px-2 py-1 rounded hover:bg-gray-50">Sora2</a>
            <a href="https://yunwu.ai/register?aff=nXmR" className="hover:text-brand transition-colors px-2 py-1 rounded hover:bg-gray-50">获取Token</a>
            <a href="/history" className="ml-auto hover:text-brand transition-colors px-2 py-1 rounded hover:bg-gray-50">历史</a>
          </nav>
        </header>
        <main className="max-w-screen-xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  )
}