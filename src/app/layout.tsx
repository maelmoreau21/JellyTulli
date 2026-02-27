import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/Sidebar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'JellyTulli Dashboard',
  description: 'Advanced analytics for Jellyfin',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className="dark">
      <body className={`dark bg-zinc-950 text-zinc-50 antialiased min-h-screen ${inter.className} selection:bg-primary selection:text-primary-foreground flex`}>
        <Sidebar />
        <main className="flex-1 h-screen overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  )
}
