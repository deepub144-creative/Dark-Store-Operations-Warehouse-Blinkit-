import "./globals.css";
import PwaRegistrar from "@/components/ios/PwaRegistrar";
import GlobalCrashGuard from "@/components/GlobalCrashGuard";
import ErrorBoundary from "@/components/ErrorBoundary";

/** @type {import("next").Viewport} */
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F2F7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

/** @type {import("next").Metadata} */
export const metadata = {
  title: "Blinkit: Everything delivered in 10 minutes | AuditX Tiptur Hub KA44",
  description:
    "AUDIT'X Quick-Commerce & Dark Store Warehouse Ecosystem for Tiptur HUB KA44 (Tumkur District, Karnataka - 572201). 10-Minute Express Delivery Model.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AUDIT'X",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="preconnect" href="https://firestore.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://accounts.google.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <PwaRegistrar />
        <GlobalCrashGuard />
        <ErrorBoundary label="AUDIT'X App">{children}</ErrorBoundary>
      </body>
    </html>
  );
}
