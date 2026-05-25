# 环境变量

所有环境变量在 `next build` 时（纯 SSG）被 Next.js 内联替换为字面量，浏览器端不存在运行时 `process.env`。本地开发通过 `.env` 文件配置，CI/CD 通过 GitHub Actions 注入。

## 变量总览

| 变量 | 类型 | 用途 | 必填 |
|------|------|------|------|
| `SITE_URL` | 非 `NEXT_PUBLIC_` | `generateMetadata` 的 `metadataBase`，SEO 规范化 URL | 是 |
| `NEXT_PUBLIC_API_BASE_URL` | `NEXT_PUBLIC_` | 后端 API 服务器地址，控制登录/云同步功能是否可用 | 否 |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `NEXT_PUBLIC_` | Cloudflare Turnstile 站点密钥，控制人机验证是否可用 | 否 |
| `NEXT_PUBLIC_ALLOWED_DOMAINS` | `NEXT_PUBLIC_` | 逗号分隔的允许域名列表，用于反镜像域名校验 | 否 |
| `NEXT_PUBLIC_ALLOWED_EMBED_DOMAINS` | `NEXT_PUBLIC_` | 逗号分隔的允许嵌入域名列表，用于反 iframe 嵌入校验 | 否 |
| `NEXT_PUBLIC_OAUTH_CLIENT_NAMES` | `NEXT_PUBLIC_` | JSON 对象，OAuth client_id → 可读名称映射 | 否 |
| `NEXT_PUBLIC_FORUM_URL` | `NEXT_PUBLIC_` | 嵌入式社区论坛地址，控制侧边栏社区入口是否显示 | 否 |

## 变量详解

### `SITE_URL`

构建时注入，不暴露到客户端 bundle。用于 `<meta property="og:url">` 等 SEO 标签。

```
SITE_URL=https://end.canmoe.com
```

### `NEXT_PUBLIC_API_BASE_URL`

后端 API 地址。未配置或设为 `disabled` 时登录、注册、云同步功能不可用，登录页显示不可用引导。

> **哨兵值 `disabled`**：部分云平台（如 Cloudflare Dashboard）的环境变量 UI 不允许空值提交。此时可填入 `disabled`（仅此一个哨兵值），效果等同于不设置 —— auth 功能关闭。注意：不要填 `null`、`none`、`off` 等，它们是非空字符串，会被当作真实 URL 导致功能异常开启。

本地开发可通过 5 击 Cloud 图标彩蛋临时覆盖（写入 localStorage），无需重新构建。详见 [DEV.md](./DEV.md)。

```bash
# 开启
NEXT_PUBLIC_API_BASE_URL=https://api.end.canmoe.com

# 关闭（两个等效写法）
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_API_BASE_URL=disabled
```

### `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

Cloudflare Turnstile 站点密钥。未配置时登录/注册表单不渲染人机验证组件。

本地开发同样支持 5 击彩蛋覆盖。

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAxxxxxxxxxxxxxxxxxxxx
```

### `NEXT_PUBLIC_ALLOWED_DOMAINS`

逗号分隔的域名列表（不含协议和端口），用于防止站点被镜像到未授权域名。值为空时反镜像功能不启用。

```
NEXT_PUBLIC_ALLOWED_DOMAINS=end.canmoe.com,end.07070721.xyz
```

### `NEXT_PUBLIC_ALLOWED_EMBED_DOMAINS`

逗号分隔的域名列表，用于防止站点被未授权第三方 iframe 嵌入。值为空时反嵌入功能不启用。

```
NEXT_PUBLIC_ALLOWED_EMBED_DOMAINS=nodebb.example.com,forum.example.com
```

### `NEXT_PUBLIC_FORUM_URL`

社区论坛地址（如 NodeBB），用于在侧边栏内嵌显示。未配置或设为 `disabled` 时侧边栏不显示社区入口。

> **哨兵值 `disabled`**：同 `NEXT_PUBLIC_API_BASE_URL`，在禁止空值的云平台上填入 `disabled` 即可关闭。

论坛服务端需允许被 CEP 域名嵌入（配置 `X-Frame-Options: ALLOW-FROM` 或 `Content-Security-Policy: frame-ancestors`）。

```bash
# 开启
NEXT_PUBLIC_FORUM_URL=https://forum.302200.xyz

# 关闭
NEXT_PUBLIC_FORUM_URL=disabled
```

### `NEXT_PUBLIC_OAUTH_CLIENT_NAMES`

JSON 格式的 OAuth 客户端 ID 到可读名称的映射。OAuth 授权页将 `client_id`（技术标识符）转为此处配置的可读名称展示给用户。

未匹配到的 client_id 会原样显示，全局回退为「第三方应用」。

```
NEXT_PUBLIC_OAUTH_CLIENT_NAMES={"nodebb-canmoe":"NodeBB Forum","nodebb-07070721":"NodeBB Forum"}
```

新增 OAuth 客户端时只需更新此 JSON，无需改代码。

## 配置位置

### 本地开发

项目根目录 `.env` 文件（已加入 `.gitignore`，不提交）：

```bash
# .env
SITE_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:8787
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
NEXT_PUBLIC_ALLOWED_DOMAINS=localhost
NEXT_PUBLIC_ALLOWED_EMBED_DOMAINS=
NEXT_PUBLIC_OAUTH_CLIENT_NAMES={"test-client":"Test App"}
NEXT_PUBLIC_FORUM_URL=https://forum.example.com
```

### CI/CD（GitHub Actions）

非敏感变量在仓库 **Settings → Secrets and variables → Actions → Variables** 配置，敏感密钥（Turnstile）在 **Secrets** 配置。

`deploy.yml` 的 Build 步骤通过 `${{ vars.XXX }}` 和 `${{ secrets.XXX }}` 注入：

| GitHub 名称 | 类型 | 对应环境变量 |
|-------------|------|-------------|
| `API_BASE_URL` | Variable | `NEXT_PUBLIC_API_BASE_URL` |
| `TURNSTILE_SITE_KEY` | Secret | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` |
| `ALLOWED_DOMAINS` | Variable | `NEXT_PUBLIC_ALLOWED_DOMAINS` |
| `ALLOWED_EMBED_DOMAINS` | Variable | `NEXT_PUBLIC_ALLOWED_EMBED_DOMAINS` |
| `OAUTH_CLIENT_NAMES` | Variable | `NEXT_PUBLIC_OAUTH_CLIENT_NAMES` |
| `FORUM_URL` | Variable | `NEXT_PUBLIC_FORUM_URL` |

> `SITE_URL` 为硬编码的 `https://end.canmoe.com`，直接写在 `deploy.yml` 中（非敏感信息）。
