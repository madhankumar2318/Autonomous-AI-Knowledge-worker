import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import OfflineBanner from "./components/OfflineBanner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Autonomous AI Knowledge Worker",
  description: "AI-powered knowledge worker for news, research, and insights",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    title: "Autonomous AI Knowledge Worker",
    description: "AI-powered knowledge worker for news, research, and insights",
    images: ["/icon.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('ak_theme') || 'dark';
                  document.documentElement.setAttribute('data-theme', t);
                  var a = localStorage.getItem('ak_accent') || 'cyan';
                  var hexMap = {
                    cyan: '#22d3ee',
                    purple: '#a855f7',
                    emerald: '#10b981',
                    amber: '#f59e0b',
                    rose: '#f43f5e'
                  };
                  var color = a === 'custom' ? (localStorage.getItem('ak_accent_custom_hex') || '#22d3ee') : (hexMap[a] || '#22d3ee');
                  document.documentElement.style.setProperty('--accent-primary', color);
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
