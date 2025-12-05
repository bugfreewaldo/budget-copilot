import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Budget Copilot - Tu Copiloto Financiero Personal',
  description:
    'Toma el control de tus finanzas con Budget Copilot. Gestiona presupuestos, rastrea deudas, alcanza tus metas de ahorro y visualiza tu clima financiero. Simple, intuitivo y en español.',
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
