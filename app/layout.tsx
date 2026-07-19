import type { Metadata } from 'next';
import { Inter, Inter_Tight, JetBrains_Mono } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';
import { AppShell } from '@/components/app-shell';
import { Header } from '@/components/header';
import { IdleLogout } from '@/components/idle-logout';
import { auth } from '@/lib/auth';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

const interTight = Inter_Tight({
  variable: '--font-heading',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
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
    <html
      lang='en'
      className={`${inter.variable} ${interTight.variable} ${jetbrainsMono.variable}`}
    >
      <body className='antialiased'>
        {session?.user ? (
          <AppShell user={session.user}>{children}</AppShell>
        ) : (
          <>
            <Header />
            {children}
          </>
        )}
        {session && <IdleLogout />}
      </body>
    </html>
  );
}
