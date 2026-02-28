import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://cafe-cursor-sepia.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "CursorContext Architect — Generate .cursorrules from Your Repo",
  description:
    "Paste a GitHub repo or describe your stack. Get a tailored .cursorrules file in seconds. Built for Cursor.sh. Perfect for demos and onboarding.",
  openGraph: {
    title: "CursorContext Architect — Generate .cursorrules from Your Repo",
    description:
      "Paste a GitHub repo or describe your stack. Get a tailored .cursorrules file in seconds. Built for Cursor.sh.",
    url: SITE_URL,
    siteName: "CursorContext Architect",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CursorContext Architect — Generate .cursorrules from Your Repo",
    description:
      "Paste a GitHub repo or describe your stack. Get a tailored .cursorrules file in seconds.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark">
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
