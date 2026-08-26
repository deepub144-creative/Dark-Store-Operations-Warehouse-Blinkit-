import "./globals.css";

export const metadata = {
  title: "AuditX - Dark Store Warehouse Ops",
  description: "IoT-based dark store warehouse operations demo",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
