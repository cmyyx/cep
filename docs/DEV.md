# 开发调试

CEP 为纯静态站点，登录与云端同步依赖 `NEXT_PUBLIC_API_BASE_URL` 环境变量指向后端 API 服务器。如果构建时未配置该变量，登录功能默认不可用。

## 临时启用登录（无需重新构建）

访问 `/login` 页面，在 **3 秒内连续点击 Cloud 图标 5 次**，弹出 Dev API 设置面板。

填入以下两个字段后点击「启用」，页面自动刷新，登录表单即正常显示：

| 字段 | 说明 | 示例 |
|------|------|------|
| API Base URL | 后端 API 服务器地址 | `https://localhost:8787` |
| Turnstile Site Key | Cloudflare Turnstile 站点密钥 | `1x00000000000000000000AA` |

## 停用

进入设置 → 数据清理 → 找到 **Dev** 模块 → 点击「清理」。刷新页面后恢复默认状态。

也可手动清除以下两个 localStorage keys：

```text
__cep_dev_api_url
__cep_dev_turnstile_key
```

## 原理

`src/lib/dev-api.ts` 中的 `getApiBaseUrl()` 和 `getTurnstileSiteKey()` 优先读取 localStorage 中的覆盖值，不存在时回退到构建时环境变量。所有 API 调用均通过这两个函数获取配置，因此运行时覆盖无需重新构建。
