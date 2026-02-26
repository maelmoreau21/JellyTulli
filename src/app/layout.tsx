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
    <html lang="en" className="dark">
      <body className="bg-background text-foreground antialiased min-h-screen font-sans">
        {children}
      </body>
    </html>
  )
}
