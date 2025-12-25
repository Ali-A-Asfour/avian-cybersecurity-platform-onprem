import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { DemoProvider } from "@/contexts/DemoContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { ToastProvider } from "@/components/notifications";
import "./globals.css";

// Initialize monitoring services - temporarily disabled
// import "@/lib/monitoring-init";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AVIAN - Cybersecurity Platform",
  description: "Comprehensive cybersecurity operations platform for monitoring, incident management, and compliance tracking.",
  keywords: ["cybersecurity", "security operations", "incident management", "compliance", "SIEM"],
  authors: [{ name: "AVIAN Team" }],
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Clear any existing theme preferences - dark mode only
                  localStorage.removeItem('avian-theme');
                  localStorage.removeItem('avian-theme-preference');
                  localStorage.removeItem('theme');
                  localStorage.removeItem('color-scheme');
                  localStorage.removeItem('next-theme');
                  localStorage.removeItem('theme-preference');
                  localStorage.removeItem('ui-theme');
                  localStorage.removeItem('app-theme');
                  localStorage.removeItem('user-theme');
                  localStorage.removeItem('preferred-theme');
                  
                  // Set dark mode only flag
                  localStorage.setItem('avian-dark-mode-only', 'true');
                  
                  // Always enforce dark mode
                  if (document.documentElement) {
                    document.documentElement.classList.remove('light');
                    document.documentElement.classList.add('dark');
                    document.documentElement.style.colorScheme = 'dark';
                  }
                  if (document.body) {
                    document.body.classList.remove('light');
                    document.body.classList.add('dark');
                  }
                } catch (e) {
                  // Fallback - still enforce dark mode
                  if (document.documentElement) {
                    document.documentElement.classList.add('dark');
                  }
                  if (document.body) {
                    document.body.classList.add('dark');
                  }
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased dark bg-slate-900 text-slate-100`}>
        <ThemeProvider>
          <AuthProvider>
            <DemoProvider>
              <TenantProvider>
                <ToastProvider>
                  {children}
                </ToastProvider>
              </TenantProvider>
            </DemoProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
