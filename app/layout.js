import "./globals.css";

export const metadata = {
  title: "AUDIT'X — Dark Store Operations & Warehouse Management (Tiptur HUB - KA44)",
  description: "AUDIT'X Quick-Commerce & Dark Store Warehouse Ecosystem for Tiptur HUB KA44 (Tumkur District, Karnataka - 572201). 10-Minute Express Delivery Model.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#080c14" />
        <link rel="icon" type="image/png" href="/auditx-logo.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
