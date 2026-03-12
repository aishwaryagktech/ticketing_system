import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GKT Ticketing System',
  description: 'AI-Enabled Ticketing System',
};

import { ThemeProvider } from './theme-provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="https://checkout.razorpay.com/v1/checkout.js" async />
      </head>
      <body style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
