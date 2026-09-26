import { AppShell } from "@/components/app-shell";
import { BitacoraProvider } from "@/components/bitacora-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { loadSummaries } from "@/lib/load";
import type { Metadata } from "next";
import { IBM_Plex_Mono, Newsreader, Outfit } from "next/font/google";
import { connection } from "next/server";
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
  title: "md-flow",
  description: "A local board for the tasks you already keep in markdown.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();
  const projects = await loadSummaries();
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${newsreader.variable} ${plex.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <ThemeProvider>
          <TooltipProvider>
            <BitacoraProvider initialProjects={projects}>
              <AppShell>{children}</AppShell>
              <Toaster />
            </BitacoraProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
