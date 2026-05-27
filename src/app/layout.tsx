import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HeadScript } from "@/components/shared/head-script";
import { DEBUG_BOOTSTRAP_CODE } from "@/lib/debug/bootstrap"
import { DomainGuard } from '@/components/shared/domain-guard';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CEP 终末地规划器",
  description: "终末地规划器 — 基质规划 · 精锻规划 · 卡池日历",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "96x96" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Prevent FOUC: apply theme class before React hydrates.
            Reads the same localStorage key as useSettingsStore.
            Uses dangerouslySetInnerHTML (via HeadScript) — the only
            legitimate exception, for build-time static inline scripts. */}
        <HeadScript
          id="theme-fouc"
          code={`(function(){try{var d=document.documentElement;var t="auto";var s=localStorage.getItem("cep-settings");if(s){var p=JSON.parse(s);t=p.theme||"auto"}if(t==="auto"){t=window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light"}if(t&&t!=="auto"){d.classList.add(t);if(t==="flashbang"){d.style.colorScheme="dark";d.setAttribute("data-theme","flashbang")}}}catch(e){}})()`}
        />
        {/* Debug capture — hooks console + global errors before any other script runs.
            The 7-click gesture is available from the first frame; the visual label
            is rendered by the DebugLabel React component after hydration. */}
        <HeadScript id="debug-bootstrap" code={DEBUG_BOOTSTRAP_CODE} />
        {/* DomainGuard — injected into <head> so React hydration never sees the
            <script> tag. Runs synchronously before any React code loads. */}
        <DomainGuard />
        {/* Preload + execute the debug panel early, so the [DEBUG] button works
            without network delay. Uses afterInteractive so it doesn't block hydration. */}
        <Script src="/debug-panel.js" strategy="afterInteractive" />
        {/* Analytics — all in <head> to avoid React hydration conflicts
            (React does not reconcile <head> children). */}
        <Script
          strategy="afterInteractive"
          src="https://u.2x.nz/script.js"
          data-website-id="604899d8-6614-4230-9feb-974ba09fae4e"
        />
        <Script id="baidu-hmt" strategy="afterInteractive">
          {`var _hmt = _hmt || [];`}
        </Script>
        <Script
          strategy="afterInteractive"
          src="https://hm.baidu.com/hm.js?27db54b42d0271041b2c3e59b731fc6a"
        />
        <Script id="ms-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};})(window,document,"clarity");`}
        </Script>
        <Script strategy="afterInteractive" src="https://www.clarity.ms/tag/wp0yo2ig74" />
        <Script
          strategy="afterInteractive"
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "2d3a7ea7fd75438ca7195e0687c32333"}'
        />
      </head>
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
