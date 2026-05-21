import type { Metadata } from "next";
import { Lato } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import "./globals.css";

const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  variable: "--font-lato",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Beetles of Indiana",
    template: "%s · Beetles of Indiana",
  },
  description:
    "Scientific reference and identification tool for the beetle fauna (Order Coleoptera) of Indiana, USA.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={lato.variable}>
      <body>
        <div className="shell">
          <Nav />
          <main style={{ flex: 1 }}>{children}</main>
          <Footer />
        </div>
        <Analytics />
      </body>
    </html>
  );
}
