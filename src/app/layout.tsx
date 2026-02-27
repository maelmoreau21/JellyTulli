import type { Metadata } from 'next'

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
      <body className="dark bg-zinc-950 text-zinc-50 antialiased min-h-screen font-sans selection:bg-primary selection:text-primary-foreground">
        {children}
      </body>
    </html>
  )
}
