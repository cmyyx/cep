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

- **禁止手写任何 CSS 文件**（`.css`, `.scss`, `.less` 等）。Tailwind config 除外。
- **禁止内联 `style={{}}`**，除非是动态计算的数值（如 `style={{ width: `${percent}%` }}`）。
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
- **侧边栏内所有可交互元素必须使用 `SidebarMenuButton`**：禁止在 `<SidebarMenu>` 内手写 `<button>` 或手动区分 `collapsed`/`expanded` 状态分支。`SidebarMenuButton` 原生处理收起/展开过渡动画（`transition-[width,height,padding]`），手写按钮会导致动画不一致。

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
- **`tsc --noEmit` 和 `eslint` 必须 0 错误 0 警告**，任何 warning 都视为必须修复的问题。
