/** Shared loading-state minimum display duration (ms).
 *  Prevents skeleton / placeholder flashes when data resolves too quickly. */
export const MIN_LOADING_DISPLAY_MS = 300

/** Default site URL used as fallback when SITE_URL env var is not set. */
export const DEFAULT_SITE_URL = 'https://end.canmoe.com'

/** 运营服务 (ops) 源站 —— 每日壁纸接口 + bootstrap 引导端点。
 *  刻意硬编码而非走 NEXT_PUBLIC_* 环境变量: 这个地址必须是固定的绝对地址,
 *  这样连恶意镜像站复制走的静态产物也仍然打到我们自己的运营服务上
 *  (换成环境变量或相对路径就会跟着镜像站跑掉)。 */
export const OPS_SERVICE_ORIGIN = 'https://end-ops.canmoe.com'
