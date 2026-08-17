import type { Metadata, Viewport } from "next";
import { DM_Sans, Libre_Franklin } from "next/font/google";
import "./globals.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const display = Libre_Franklin({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Zordle — Your daily word ritual",
  description: "A beautifully focused daily word puzzle with private progress sync.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f6f3eb",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${display.variable}`}>{children}</body>
    </html>
  );
}
