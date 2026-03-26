import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://aiintelligence.dev";

export const metadata: Metadata = {
  title: {
    default: "AI Intelligence — Daily AI News & Developments",
    template: "%s | AI Intelligence",
  },
  description:
    "Curated AI news dashboard tracking model releases, tools, open source projects, and industry developments. Stay ahead of the curve.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "AI Intelligence — Daily AI News & Developments",
    description:
      "Curated AI news dashboard tracking model releases, tools, open source projects, and industry developments.",
    url: siteUrl,
    siteName: "AI Intelligence",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Intelligence",
    description:
      "Curated AI news dashboard tracking model releases, tools, open source, and industry developments.",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
