import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { GeistPixelCircle } from "geist/font/pixel";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL("https://typegrid.dev"),
  icons: { icon: [{ url: "/favicon.svg?v=loop-1", type: "image/svg+xml" }] },
  title: {
    default: "TypeGrid — Every keystroke counts.",
    template: "%s · TypeGrid",
  },
  description:
    "Connect your machine to the Grid. Free, open-source typing stats, streaks, and a little friendly competition. We count. We don’t read.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${GeistPixelCircle.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
