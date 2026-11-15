import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './tokens.css';
import './frostbox.css';
import './app.css';

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Frostbox',
  description: 'What is in the deep freeze',
  appleWebApp: { capable: true, title: 'Frostbox', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f8fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0f14' },
  ],
};

const applySavedTheme = `try{var t=localStorage.getItem('frostbox:theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: applySavedTheme }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
