import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HeadScript } from "@/components/shared/head-script";
import { LocaleGuardHead } from '@/components/shared/locale-guard-head';
import { versionData } from '@/generated/version-data';
import { buildNotFoundLocaleScript } from '@/lib/not-found-copy';
import { OPS_SERVICE_ORIGIN } from '@/lib/constants';
import { SEO_INDEXABLE_BUILD } from '@/lib/seo'
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
  title: "CEP 终末地规划器（原终末地基质规划器）",
  description: "终末地规划器 — 基质规划 · 精锻规划 · 卡池日历",
  ...(SEO_INDEXABLE_BUILD ? {} : { robots: { index: false, follow: false } }),
  icons: {
    // 不要再加回 /icon.svg: 它是 base64 位图外包一层 <svg> 的伪矢量图 (2.4MB),
    // 作为 favicon 相比 21KB 的 icon.png 没有任何优势, 只会让每个访客多下 2.4MB。
    icon: [
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased no-js`}
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
        {/* Remove no-js class ASAP — before any React content renders.
            When JS is disabled the class stays, and .no-js CSS rules
            hide JS-dependent overlays to reveal SSG content. */}
        <HeadScript
          id="no-js-remove"
          code="document.documentElement.classList.remove('no-js')"
        />
        {/* 404 locale: static hosts return one out/404.html for every unmatched
            path, so the locale must be resolved at parse time — this script
            sets <html data-notfound-lang> before the body exists, and CSS shows
            only that locale's panel (see [data-notfound-lang] rules in globals.css).
            Runs on every page; harmless where no [data-notfound-lang] nodes exist. */}
        <HeadScript
          id="not-found-locale"
          code={buildNotFoundLocaleScript()}
        />
        {/* css-guard + domain-guard 仍内联在每页 <head> 执行, 但不经 React 树:
            postbuild 将 /guard-inline.js 内容插入导出 html (scripts/prune-export.mjs),
            避免代码字符串随 RSC flight 在每页载荷中重复序列化 3 份。
            注意: next dev 下这两个守卫不生效 (仅构建产物有)。 */}
        {/* 外置守卫 /guards.js: BrowserGuard (旧浏览器检测) + debug bootstrap。
            此前内联导致每页 <head> 与 RSC flight 双份携带约 16KB;
            外置后每访客缓存一次, ?v= 随部署失效。async 不阻塞解析。 */}
        <script
          id="cep-guards"
          src={`/guards.js?v=${versionData.commit}`}
          async
          suppressHydrationWarning
        />
        {/* 运营引导脚本：用于初始化页面并提供必要的访问保护。
            公告由独立的数据接口获取和更新，页面运行期间由前端统一管理。 */}
        <script
          id="cep-bootstrap"
          src={`${OPS_SERVICE_ORIGIN}/api/v1/bootstrap.js`}
          async
          suppressHydrationWarning
        />
        {/* LocaleGuardHead — synchronously redirects to explicit language
            preference before any page content renders, avoiding wrong-locale flash. */}
        <LocaleGuardHead />
        {/* Preload + execute the debug panel early, so the [DEBUG] button works
            without network delay. Uses afterInteractive so it doesn't block hydration. */}
        <Script src="/debug-panel.js" strategy="afterInteractive" />
        {/* Analytics — all in <head> to avoid React hydration conflicts
            (React does not reconcile <head> children). */}
        {/* Umami analytics disabled: umami.2x.nz service is no longer valid.
        <Script
          strategy="afterInteractive"
          src="https://umami.2x.nz/script.js"
          data-website-id="604899d8-6614-4230-9feb-974ba09fae4e"
        /> */}
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
        <Script id="ga4-loader" strategy="afterInteractive" src="https://www.googletagmanager.com/gtag/js?id=G-FQ81EJB28L" />
        <Script id="ga4-init" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-FQ81EJB28L');`}
        </Script>
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
