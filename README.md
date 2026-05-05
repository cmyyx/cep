<img align="right" src="./CEP.png" width="320" alt="CEP Logo">

<h1><span style="font-size:1.6em">C</span>ep <span style="font-size:1.6em">E</span>ndfield <span style="font-size:1.6em">P</span>lanner</h1>

**终末地规划器** —— 为《明日方舟：终末地》打造的基质规划工具集。

全称 **Cep Endfield Planner**，缩写取自每个词的首字母 C·E·P。

> (其实 c 取自 canmoe)

<br clear="right">

## 功能模块

| 模块 | 说明 |
|------|------|
| 基质规划 | 多武器淤积点共刷方案计算，支持锁定条件约束与属性冲突处置 |
| 角色攻略 | 角色养成与配装推荐 |
| 精锻规划 | 装备精锻规划 |
| 卡池日历 | 卡池排期与复刻时间 |
| 背景预览 | 网页背景预览 |
| 编辑器 | 角色攻略内容编辑器 |

## 技术栈

| 层级 | 方案 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript (strict) |
| UI | Shadcn/UI + Tailwind CSS v4 |
| 状态管理 | Zustand |
| 表单 | react-hook-form + zod |
| 国际化 | next-intl (zh-CN / zh-TW / ja / en) |
| 设计系统 | Geist 字体 + Vercel 风格设计语言 |

构建产物为纯静态文件（`output: "export"`），可直接部署至任意静态托管服务。

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建静态产物
pnpm build

# 预览静态产物
npx serve out
```

## 项目结构

```
src/
├── app/[locale]/           # 多语言路由 (next-intl)
├── components/
│   ├── ui/                 # Shadcn/UI 组件（自动生成）
│   ├── essence/            # 基质规划业务组件
│   └── shared/             # 跨模块复用组件
├── data/                   # 武器、淤积点等静态数据
├── lib/
│   ├── api.ts              # 后端 API 客户端
│   └── planner/            # 核心规划算法
├── messages/               # 国际化翻译文件
├── stores/                 # Zustand 状态管理
└── types/                  # TypeScript 类型定义
```

## 设计规范

本项目严格遵守 AGENTS.md 中定义的设计约束，所有 UI 层必须使用 Shadcn/UI + Tailwind CSS，禁止手写 CSS 和内联样式。视觉设计遵循 DESIGN.md 中基于 Vercel 风格的设计令牌。

## 许可

AGPL-3.0 © 璨梦踏月
