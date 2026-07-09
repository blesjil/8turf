import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';
import { Header } from '@/components/header';
import { IdleLogout } from '@/components/idle-logout';
import { auth } from '@/lib/auth';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '8TURF',
  description: 'Manage rental properties, units, tenants, and payments',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <html lang='en' className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className='antialiased'>
        <Header user={session?.user} />
        {session && <IdleLogout />}
        {children}
      </body>
    </html>
  );
}
