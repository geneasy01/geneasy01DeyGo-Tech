import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'DEYGO — Help Dey Go',
  description:
    'DEYGO is Nigeria\u2019s next-generation emergency response platform. One tap can save your life.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'DEYGO',
  },
  openGraph: {
    title: 'DEYGO — Help Dey Go',
    description: 'One tap can save your life.',
    type: 'website',
  },
};

export const viewport = {
  themeColor: '#0a0e1a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
