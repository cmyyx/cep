<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# CEP (CEP Endfield Planner)

## 禁止使用emoji

## 设计系统

**DESIGN.md 是本项目的设计系统宪章**，所有 UI 组件、颜色、排版、间距、阴影、圆角等视觉决策必须遵守 DESIGN.md 中定义的设计令牌和模式。DESIGN.md 与本文档同级，每次会话自动加载。

核心设计原则速览（详见 DESIGN.md）：
- 字体：Geist Sans + Geist Mono，启用 `"liga"` OpenType 特性
- 阴影替代边框：`box-shadow: 0px 0px 0px 1px rgba(0,0,0,0.08)` 替代传统 CSS border
- 色彩：近乎纯白画布 + `#171717` 文字，三 workflow 强调色（Ship Red / Preview Pink / Develop Blue）
- 字间距：大号标题使用负 letter-spacing（-2.4px 到 -2.88px），随字号缩小逐步放宽
- 三种字重：400（正文）、500（UI/交互）、600（标题/强调）
- 圆角层级：2px → 4px → 6px → 8px → 12px → 64px → 100px → 9999px

### 稀有度星级颜色

| 稀有度 | 色值 | 说明 |
|--------|------|------|
| 6★ | `#ff7100` | 暖橙色，最高稀有度 |
| 5★ | `#ffcc00` | 金色，次高稀有度 |
| 1-4★ | 默认继承色 | 低稀有度不做特殊强调 |

所有星级显示（RarityStars 组件、装备稀有度标签等）统一使用上述色值。在 `globals.css` 中通过 `@theme` 定义为 `--color-rarity-6-star: #ff7100` 和 `--color-rarity-5-star: #ffcc00`，组件中使用 `text-rarity-6-star` / `text-rarity-5-star` 类名（Tailwind v4 CSS-first 配置自动生成），根据稀有度条件动态切换 className，禁止使用内联 `style={{ color }}`。

## 技术栈（不可变）

| 层级 | 方案 | 备注 |
|------|------|------|
| 框架 | Next.js 16 (App Router) | 不使用 Pages Router |
| 部署 | **纯静态 SSG**（`output: "export"`） | Cloudflare Workers 托管，无 Node 运行时，无 API 路由 |
| 语言 | TypeScript (strict mode) | 禁止 `any`，特殊情况需 `// @ts-expect-error reason` |
| UI | **Shadcn/UI + Tailwind CSS v4** | 唯一的 UI 来源 |
| 状态管理 | Zustand | 仅限客户端状态 |
| 表单 | react-hook-form + zod | Shadcn/UI Form 组件绑定 |
| 国际化 | next-intl | 基于路由的多语言 `/[locale]/...` |
| 包管理 | pnpm 9 | 禁止 `npm install`，必须使用 `pnpm install` |

### 纯静态站点约束

- **没有服务端运行时**：所有页面在 `next build` 时预渲染为静态 HTML/CSS/JS，部署到 Cloudflare Pages。不存在 SSR、ISR、Edge Functions、API Routes。
- **禁止使用服务端特性**：`cookies()`, `headers()`, `fs`, `process.env`（运行时）, `fetch`（服务端补丁）等在运行时不可用。构建时（Server Components 在 SSG 编译阶段）可用的有 `fs.readFileSync`, `import` 等。
- **版本/构建信息**：通过 `scripts/generate-version.mjs` 在 prebuild 时写入 `public/version.json` 和 `src/generated/version-data.ts`，后者被 layout import 内联到静态 bundle，客户端通过 React Context 共享 + 轮询 `/version.json` 检测更新。

## 核心设计约束（防止屎山）

### UI 层 —— 零容忍规则

- **禁止手写任何 CSS 文件**（`.css`, `.scss`, `.less` 等）。全局样式和 Tailwind 配置统一在 `src/app/globals.css` 中通过 `@import "tailwindcss"`, `@theme`, `@utility`, `@layer` 等 Tailwind v4 CSS-first 机制管理，不得新增其他 `.css` 文件。
- **禁止内联 `style={{}}`**，除非是动态计算的数值（如 `style={{ width: `${percent}%` }}`）。动态颜色应通过 `@theme` 定义 CSS 变量并切换 className（参见上文稀有度星级颜色表）。
- **禁止裸 HTML 元素**：所有可交互元素必须来自 Shadcn/UI。`<div>`, `<span>`, `<p>` 等无语义结构元素允许，但 `<button>`, `<input>`, `<select>`, `<textarea>`, `<dialog>`, `<table>` 等必须用 Shadcn/UI 对应组件。
- **禁止 `<style>` 标签**（包括 `<style jsx>`）。
- 自定义组件必须用 Shadcn/UI 组件组装，不得自己从头实现。
- Tailwind class 长字符串用 `cn()` 工具函数合并（来自 `@/lib/utils`），不要用字符串拼接。

### 状态管理 —— 单一入口

- **全局状态**：只能用 Zustand store，放在 `src/stores/`。
- **服务端数据**：Server Components 直接 fetch，通过 props 向下传；需要客户端缓存时用 TanStack Query（待引入）。
- **禁止**：Redux, MobX, Jotai, useContext 做全局状态（它们的存在本身就是屎山信号）。
- Zustand store 命名：`use<Name>Store.ts`，如 `usePlannerStore.ts`。

### 文件结构

```
src/
├── app/[locale]/        # 路由页面（next-intl）
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/              # Shadcn/UI 组件（自动生成，不手动改）
│   ├── shared/          # 跨页面复用的业务组件
│   └── <feature>/       # 按功能分组的组件
├── stores/              # Zustand stores
├── lib/                 # 工具函数、API 客户端
│   ├── utils.ts         # cn() 等
│   └── i18n.ts          # next-intl 配置
├── messages/            # 翻译文件（JSON）
├── hooks/               # 自定义 hooks
└── types/               # 共享 TypeScript 类型
```

### 组件规范

- 一个文件一个组件（导出 + 默认导出为组件本身）。
- 组件名与文件名一致：`user-avatar.tsx` → `export function UserAvatar()`。
- Props 类型定义在同一文件内，命名为 `ComponentNameProps`。
- 超过 2 层的 prop drilling 必须改用 Zustand store 或组合模式。
- **`<SelectValue>` 必须传入 `children` render function**：本项目 Select 底层为 Base UI（非 Radix）。`<SelectValue />` 无 children 时 Base UI 无法从子 `SelectItem` 自动解析显示文本，会退回到显示原始 `value` 字符串。必须传 render function 将 value 映射为翻译后的显示文本：`<SelectValue>{(v: string) => labelMap[v] ?? v}</SelectValue>`。禁止在 `<SelectTrigger>` 内手写 `<span>` 替代 `SelectValue`。
- **侧边栏内所有可交互元素必须使用 `SidebarMenuButton`**：禁止在 `<SidebarMenu>` 内手写 `<button>` 或手动区分 `collapsed`/`expanded` 状态分支。`SidebarMenuButton` 原生处理收起/展开过渡动画（`transition-[width,height,padding]`），手写按钮会导致动画不一致。

### 页面布局高度链规范

所有使用侧边栏布局的页面必须遵循以下三层高度链，确保内部 flex 子元素能正确解析 `flex-1`，实现面板独立滚动：

**三层结构（不可变）：**

```text
SidebarProvider className="h-svh"              ← height: 100svh (确定值)
  └─ <main className="flex flex-col flex-1 w-full relative overflow-hidden">
       └─ <div className="flex flex-col flex-1 min-h-0 overflow-hidden">  ← 页面根元素
            ├─ top bar (shrink-0 / auto)
            └─ content area (flex-1 overflow-hidden)
                 ├─ left panel (overflow-y-scroll)
                 └─ right panel (overflow-y-auto)
```

**原理：**

1. `SidebarProvider` 的 wrapper 默认使用 `min-h-svh`，这仅设置了 `min-height`，`height` 仍为 `auto`（不定值）。CSS Flexbox 规范规定：当 flex 容器的 `height` 为 `auto` 时，所有 `flex-grow` 子元素的增长量解析为 0，整条链退化为内容高度，内部 `overflow` 面板无法产生滚动条。必须在 `SidebarProvider` 上显式传入 `className="h-svh"`，使 wrapper 获得确定高度 `100svh`。

2. `<main>` 必须为 `flex flex-col` + `overflow-hidden`（非 `overflow-auto`）。页面内部的滚动由具体面板（weapon grid、plan list 等）通过自身的 `overflow-y-auto` / `overflow-y-scroll` 独立管理，main 本身不产生滚动条。注意：globals.css 会覆写 `overflow-y-auto` 为 `overflow-y: overlay`（Chromium），`overflow-y-scroll` 保持原生行为（始终预留滚动条空间）。

3. 页面根元素必须同时包含 `flex-1`、`min-h-0`、`overflow-hidden`：
   - `flex-1`：填充 main 的剩余高度
   - `min-h-0`：允许页面作为 flex 子元素缩到内容高度以下
   - `overflow-hidden`：**关键**——页面同时是 flex 容器（对其子元素），`overflow: visible`（默认）会导致作为 flex 容器时无法小于内容的自动最小尺寸，容器会膨胀突破分配高度。`overflow: hidden` 解除此约束。

4. **禁止在页面根元素或 `<main>` 上使用硬编码高度**（如 `h-[calc(100vh-3rem)]`）。任何 vertical offset 都会在公告横幅等条件渲染元素出现/消失时失效，应依赖 flex 布局动态分配空间。

**违反此规范的已知症状：**
- 页面底部出现多余间距
- 左右面板合并为单一页面级滚动条
- `overflow: overlay` 失效，滚动条占用布局空间

### 规划器状态持久化（强制）

基质规划（Essence Planner）和精锻规划（Refinement Planner）的所有用户操作状态必须通过 `zustand/persist` 持久化到 localStorage，确保页面刷新、关闭后重开不丢失。

**必须持久化：**
- 已选武器/装备
- 筛选展开/收起状态
- 地区筛选选择
- 方案卡片展开/收起状态
- S1 选择器用户选择
- 套装收起状态

**不持久化：** 搜索关键词、属性筛选值（临时操作，下次打开默认重置）

**实现方式：** `persist` 中间件 + `partialize` 仅序列化用户选择状态，排除计算产物（如 plansMap、planOrder）。store 中 Set 类型字段转换为数组存储。

### 禁止事项清单

- ❌ 手写 CSS 文件
- ❌ `any` 类型（除非有明确的 `@ts-expect-error`）
- ❌ 第三方 UI 库（Ant Design, MUI, Chakra 等 —— Shadcn/UI 是唯一 UI 来源）
- ❌ `useContext` 做全局状态
- ❌ `dangerouslySetInnerHTML`
- ❌ 直接操作 DOM（`document.querySelector`, `getElementById` 等）
- ❌ `eval`, `new Function`

## 国际化规则

- 所有面向用户的字符串必须通过 `useTranslations()` 或 `next-intl` 的 API 渲染。
- 翻译 key 使用路径式，例如 `t("nav.essencePlanner")`。
- 翻译文件放在 `src/messages/<locale>.json`。

## 代码质量

- 每个功能文件必须有对应的测试文件（`.test.ts` 或 `.test.tsx`）。
- PR 前必须通过 `tsc --noEmit` 类型检查。
- 使用 `eslint` + `prettier`，配置由项目统一提供，不自定义规则除非有充分理由。
- **`tsc --noEmit`、`eslint` 必须 0 错误 0 警告**，任何 warning 都视为必须修复的问题。
- **`node scripts/check-i18n.mjs` 必须 0 个 P0 错误**（运行时缺失 key）。P1（语言间漂移）和 P2（死键）作为 CI warning 展示但不阻塞构建，应在 PR 中逐步清理。
