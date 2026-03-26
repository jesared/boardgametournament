import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Poppins, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "Board Game Tournament Manager",
  description:
    "Organisez vos tournois de jeux de société avec sessions, manches, scoring et classement.",
};

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
  preload: true,
  fallback: [
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "Roboto",
    "Helvetica",
    "Arial",
    "sans-serif",
  ],
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  preload: true,
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`h-full ${poppins.variable} ${robotoMono.variable}`}
      suppressHydrationWarning
      style={
        {
          "--font-serif":
            'ui-serif, "Iowan Old Style", "Palatino", "Times New Roman", serif',
        } as CSSProperties
      }
    >
      <body
        className="min-h-full bg-background text-foreground font-sans font-normal transition-colors duration-300 antialiased"
        style={{
          fontFeatureSettings:
            '"liga" 1, "calt" 1, "kern" 1, "ss01" 1, "ss02" 1',
          fontVariationSettings: '"wght" 400, "slnt" 0',
        }}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
