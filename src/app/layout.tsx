import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";

// Body / UI text.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

// Display / headings — an editorial serif. latin-ext covers č ć š đ ž.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "e-ravnatelj",
  description:
    "Asistent ravnateljima osnovnih škola — odgovori na temelju propisa, uz navođenje članka.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="hr"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
