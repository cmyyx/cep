import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
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
      <body className="min-h-full flex flex-col">
        {/* Prevent FOUC: apply theme class before React hydrates.
            Reads the same localStorage key as useSettingsStore.
            Script component injects into <head> so React never sees it in the component tree. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var d=document.documentElement;var t='auto';var s=localStorage.getItem('cep-settings');if(s){var p=JSON.parse(s);t=p.theme||'auto'}if(t==='auto'){t=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}if(t&&t!=='auto'){d.classList.add(t);if(t==='flashbang'){d.style.colorScheme='dark';d.setAttribute('data-theme','flashbang')}}}catch(e){}})()`}
        </Script>
        <TooltipProvider>{children}</TooltipProvider>

        {/* Analytics — afterInteractive: loads after hydration, does not block rendering */}
        <Script
          src="https://u.2x.nz/script.js"
          data-website-id="604899d8-6614-4230-9feb-974ba09fae4e"
          strategy="afterInteractive"
        />
        <Script id="baidu-analytics" strategy="afterInteractive">
          {`var _hmt = _hmt || [];
(function() {
  var hm = document.createElement("script");
  hm.src = "https://hm.baidu.com/hm.js?27db54b42d0271041b2c3e59b731fc6a";
  var s = document.getElementsByTagName("script")[0]; 
  s.parentNode.insertBefore(hm, s);
})();`}
        </Script>
        <Script id="ms-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "wp0yo2ig74");`}
        </Script>
        <Script
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon='{"token": "2d3a7ea7fd75438ca7195e0687c32333"}'
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
