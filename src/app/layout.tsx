import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans } from 'next/font/google';
import '../styles/globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://ventro.ai'),
  title: {
    default: 'Ventro — AI Investment Intelligence',
    template: '%s | Ventro',
  },
  description: 'Where are investors investing? What are they looking for? Verified AI funding rounds, investor theses, and patterns with inspectable evidence.',
  keywords: ['AI', 'venture capital', 'funding rounds', 'investor thesis', 'startup funding', 'artificial intelligence'],
  authors: [{ name: 'Ventro' }],
  creator: 'Ventro',
  publisher: 'Ventro',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://ventro.ai',
    siteName: 'Ventro',
    title: 'Ventro — AI Investment Intelligence',
    description: 'Where are investors investing? What are they looking for? Verified AI funding rounds, investor theses, and patterns with inspectable evidence.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Ventro - AI Investment Intelligence',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ventro — AI Investment Intelligence',
    description: 'Where are investors investing? What are they looking for? Verified AI funding rounds, investor theses, and patterns with inspectable evidence.',
    images: ['/og-image.png'],
  },
  verification: {
    google: 'google-site-verification-code',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const notoSans = Noto_Sans({
  subsets: ['latin', 'devanagari'],
  display: 'swap',
  variable: '--font-noto',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${notoSans.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="min-h-screen bg-bg-primary text-text-primary antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
