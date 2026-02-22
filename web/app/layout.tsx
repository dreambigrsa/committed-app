import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-geist-sans', display: 'swap' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-geist-display', display: 'swap' });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://committed.dreambig.org.za';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Committed | Verified Dating & Relationships – Trust Before You Connect',
    template: '%s | Committed',
  },
  description:
    'Verified singles. Verified couples. Real connections. Join Committed – the trust-first dating app where everyone is ID verified. Safe, real, intentional. Download now.',
  keywords: [
    'verified dating app',
    'trust dating',
    'ID verified singles',
    'verified relationships',
    'real connections',
    'dating app South Africa',
  ],
  authors: [{ name: 'Committed' }],
  creator: 'Committed',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  icons: { icon: '/brand/icon.png', apple: '/brand/icon.png' },
  openGraph: {
    title: 'Committed | Verified Dating & Relationships – Trust Before You Connect',
    description:
      'Verified singles. Verified couples. Real connections. The trust-first dating app where everyone is ID verified. Safe, real, intentional.',
    url: siteUrl,
    siteName: 'Committed',
    type: 'website',
    locale: 'en_ZA',
    images: [
      {
        url: '/brand/logo.png',
        width: 1200,
        height: 630,
        alt: 'Committed – Verified relationships, real connections',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Committed | Verified Dating & Relationships',
    description: 'Verified singles. Verified couples. Real connections. Trust-first dating. Download now.',
    site: '@committedapp',
  },
  alternates: {
    canonical: siteUrl,
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Committed',
  description:
    'Verified singles. Verified couples. Real connections. The trust-first dating app where everyone is ID verified.',
  url: siteUrl,
  applicationCategory: 'SocialNetworkingApplication',
  operatingSystem: 'iOS, Android',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'ZAR',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
