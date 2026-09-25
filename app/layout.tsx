import { AppShell } from "@/components/app-shell";
import { BitacoraProvider } from "@/components/bitacora-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import type { Metadata } from "next";
import { IBM_Plex_Mono, Newsreader, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
});

const plex = IBM_Plex_Mono({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Bitácora",
  description:
    "Tablero local para ver los proyectos y las tareas que ya escribes en markdown.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${outfit.variable} ${newsreader.variable} ${plex.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <TooltipProvider>
          <BitacoraProvider>
            <AppShell>{children}</AppShell>
            <Toaster />
          </BitacoraProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
