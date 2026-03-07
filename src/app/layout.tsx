import type { Metadata } from "next";
import { Cairo } from 'next/font/google';
const cairo = Cairo({ subsets: ['arabic'], weight: ['400', '700'] });

import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "ذوقوا وإنظروا",
  description: "نظام متابعة المخدومين",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="rtl" suppressHydrationWarning>
      <body className={cairo.className}>
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange>
              {children}
              <Toaster richColors position="top-center" />
            </ThemeProvider>
        </AuthProvider>

      </body>
    </html>
  );
}
