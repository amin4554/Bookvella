import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// metadataBase makes any relative OG/Twitter image URLs resolve against the
// real public host so social cards, Google's site preview, and similar tools
// don't fall back to localhost (or to scraping a stale icon from when the
// project still shipped Next.js defaults).
const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://www.bookvella.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Bookvella",
  description: "Booking and scheduling for service providers.",
  openGraph: {
    type: "website",
    title: "Bookvella",
    description: "Booking and scheduling for service providers.",
    url: "/",
    siteName: "Bookvella",
    images: [
      {
        url: "/bookvella-icon.png",
        width: 512,
        height: 512,
        alt: "Bookvella",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <script
          dangerouslySetInnerHTML={{
            __html: `
try {
  var params = new URLSearchParams(window.location.search);
  var requestedTheme = params.get("theme");
  var theme =
    requestedTheme === "dark" || requestedTheme === "light"
      ? requestedTheme
      : window.localStorage.getItem("bookvella.theme");
  if (requestedTheme === "dark" || requestedTheme === "light") {
    window.localStorage.setItem("bookvella.theme", requestedTheme);
  }
  document.documentElement.classList.toggle("dark", theme === "dark");
} catch (_) {}
            `.trim(),
          }}
        />
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
