import type { Metadata } from "next";
import { Footer } from "@/components/marketplace";
import "./globals.css";
import { AppShell } from "@/components/navigation";
import { themeScript } from "@/components/theme-toggle";
export const metadata: Metadata = {
  title: {
    default: "Commons",
    template: "%s · Commons",
  },
  description:
    "Discover free and open-source apps for everyday life. Find your next favorite creative tool, productivity app, or privacy essential.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <AppShell>
          {children}
          <Footer />
        </AppShell>
      </body>
    </html>
  );
}
