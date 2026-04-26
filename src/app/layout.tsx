import type { Metadata, Viewport } from "next";

import "./globals.css";

const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "https://baywire.app";

export const metadata: Metadata = {
  title: {
    default: "Baywire — Tampa Bay events, this week & weekend",
    template: "%s • Baywire",
  },
  description:
    "Baywire is the live wire for Tampa Bay. AI-curated music, festivals, food, and family fun across Tampa, St. Pete, Clearwater, Brandon, and Bradenton — refreshed every few hours.",
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  openGraph: {
    title: "Baywire — Tampa Bay events, this week & weekend",
    description:
      "The live wire for Tampa Bay. Real-time, AI-curated things to do across the Bay this week.",
    url: SITE_URL,
    siteName: "Baywire",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Baywire — Tampa Bay events",
    description:
      "Real-time, AI-curated things to do across the Bay this week.",
  },
  applicationName: "Baywire",
  robots: { index: true, follow: true },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdf9f3" },
    { media: "(prefers-color-scheme: dark)", color: "#14130f" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-dvh min-w-0 overflow-x-hidden antialiased">{children}</body>
    </html>
  );
}
