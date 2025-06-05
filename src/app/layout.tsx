'use client';

import { ThemeProvider } from '@mui/material/styles';
import { Inria_Sans, Raleway } from 'next/font/google';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';


const inriaSans = Inria_Sans({
  weight: ['300', '400', '700'],
  subsets: ['latin'],
  display: 'swap',
});

const _ = Raleway({
  weight: ['300', '400', '700'],
  subsets: ['latin'],
  display: 'swap',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={inriaSans.className}>
      <body>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
