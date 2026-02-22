import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-geist-sans', display: 'swap' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-geist-display', display: 'swap' });

export const metadata: Metadata = {
  title: 'Committed | Verified Relationships, Real Connections',
  description: 'The app where couples verify their commitment, singles find real connections, and everyone builds trust. Dating, social feed, and professional support.',
  icons: { icon: '/brand/icon.png', apple: '/brand/icon.png' },
  openGraph: {
    title: 'Committed | Verified Relationships, Real Connections',
    description: 'The app where couples verify their commitment, singles find real connections, and everyone builds trust.',
    url: 'https://committed.dreambig.org.za',
    siteName: 'Committed',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Committed | Verified Relationships, Real Connections' },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://committed.dreambig.org.za'),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
