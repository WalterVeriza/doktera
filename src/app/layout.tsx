import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Radoko — Santé à portée de main',
  description: 'La première plateforme médicale de Madagascar. Trouvez un médecin, réservez un créneau en 2 minutes.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}