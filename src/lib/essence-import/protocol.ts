/**
 * MaaEND 基质库存协议的适配基准。
 *
 * 上游把协议标识写进文件本身（`format` + `version`），这里记录本站对齐的是哪一版：
 * 导入时用 `version` 与 `MAAEND_PROTOCOL.version` 比较，上游一旦加版本就能立刻
 * 在导入对话框里看到「文件比本站新」，而不是掉进「文件可能已损坏」这种误导提示。
 *
 * 上游改协议时的同步步骤：
 *  1. 按新的 `tools/schema/essence_inventory.schema.json` 改 `maamend.ts` 的解析器；
 *  2. 把下面的 `version` / `adaptedAt` / `upstreamCommit` / `schemaHash` 改成新值；
 *  3. 跑 `maamend.test.ts` 与 `data-import-dialog.test.tsx`。
 *
 * `schemaHash` 是适配时那份 schema 的 sha256，由 `scripts/check-maaend-protocol.mjs`
 * 在 CI 里与上游比对：`version` 变了就直接失败，只有描述等文本变动则只提示。
 *
 * 旧版数组格式（v3.2.0 及更早，文件自带 weapon_ids）已停止适配，只报错不解析。
 */

/** 上游文件里的协议标识，读取方靠它识别文件，不靠文件名或结构猜测。 */
export const MAAEND_INVENTORY_FORMAT = 'maaend.essence_inventory'

export const MAAEND_PROTOCOL = {
  /** 本站已适配的上游协议版本（对应 schema 里的 `version` 常量）。 */
  version: 1,
  /** 对齐该协议的上游提交日期（UTC），便于回溯是哪天的 schema。 */
  adaptedAt: '2026-11-22',
  /** 对齐该协议的上游提交（MaaEnd/MaaEnd v2 分支）。 */
  upstreamCommit: 'fd9f325e9',
  /** 该提交下 schema 文件的 sha256，用于发现同版本内的结构变动。 */
  schemaHash: 'a81abbf696e44a7cce29392650a76e21894ff30775ed2308745bfa2953775101',
  /** 上游 schema 路径与线上地址，改协议时用来比对。 */
  schemaPath: 'tools/schema/essence_inventory.schema.json',
  schemaUrl: 'https://github.com/MaaEnd/MaaEnd/blob/v2/tools/schema/essence_inventory.schema.json',
} as const
