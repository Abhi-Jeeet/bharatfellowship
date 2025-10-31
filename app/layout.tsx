import './globals.css'
import { ReactNode } from 'react'

export const metadata = {
  title: 'MGNREGA District Insights',
  description: 'Simple MGNREGA dashboard for districts'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="hi">
      <body className="min-h-screen bg-white">
        <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur border-b border-zinc-200">
          <div className="mx-auto w-full px-3 sm:px-4 py-3">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">MGNREGA District Insights</h1>
            <p className="text-xs sm:text-sm text-zinc-600">Select your state, district and financial year to view simple metrics</p>
          </div>
        </header>
        <link rel="manifest" href="/manifest.json" />
        <script dangerouslySetInnerHTML={{__html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js').catch(()=>{});
            });
          }
        `}} />
        {children}
        <footer className="py-6 text-center text-xs text-zinc-500">Data: data.gov.in • For outages, cached last-good data may be shown</footer>
      </body>
    </html>
  )
}
