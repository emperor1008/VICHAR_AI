import type { Metadata, Viewport } from "next";
import { Poppins, Inter, Caveat, Nunito, Kalam, Patrick_Hand, Dancing_Script, Indie_Flower, Merriweather } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

// Handwritten accent font for journal quotes, dates and personal notes.
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-caveat",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-nunito",
  display: "swap",
});

const kalam = Kalam({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-kalam",
  display: "swap",
});

const patrickHand = Patrick_Hand({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-patrick",
  display: "swap",
});

const dancingScript = Dancing_Script({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-dancing",
  display: "swap",
});

const indieFlower = Indie_Flower({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-indie",
  display: "swap",
});

const merriweather = Merriweather({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-merriweather",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Vichar AI — Because every feeling deserves to be heard",
    template: "%s · Vichar AI",
  },
  description:
    "An emotionally intelligent AI companion that understands you before it responds. Because every feeling deserves to be heard — support for anxiety, stress, overthinking, and everyday emotional ups and downs.",
  keywords: ["mental health", "AI companion", "therapy", "wellness", "anxiety", "meditation"],
};

export const viewport: Viewport = {
  themeColor: "#F8F4EC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${poppins.variable} ${inter.variable} ${caveat.variable} ${nunito.variable} ${kalam.variable} ${patrickHand.variable} ${dancingScript.variable} ${indieFlower.variable} ${merriweather.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
