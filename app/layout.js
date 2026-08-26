import "./globals.css";

export const metadata = {
  title: "blinkit — Everything delivered in 14 minutes",
  description: "India's Last Minute App - Quick Commerce Grocery & Dark Store Ordering",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
