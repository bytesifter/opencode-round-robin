import type { ParsedOptions, ParsedPool } from "./types"

/** 默认冷却时长(毫秒),429 限流后该 key 暂时停用 */
const DEFAULT_COOLDOWN_MS = 60000

/**
 * 解析插件 options:只校验 providers(必填非空)与可选项。
 *
 * pool 的实际构建在 config hook 里通过 buildPoolsFromProviders 完成(因需读取 Config.provider)。
 *
 * @param options - 来自 opencode.jsonc 的 plugin options
 * @returns 解析后的配置(providers + 可选项)
 * @throws providers 缺失/为空/元素非字符串时抛出
 */
export function parseOptions(options: Record<string, unknown> | undefined): ParsedOptions {
  if (!options) {
    throw new Error("opencode-round-robin: 缺少 options")
  }
  const rawProviders = options.providers
  if (!Array.isArray(rawProviders) || rawProviders.length === 0) {
    throw new Error("opencode-round-robin: options.providers 必填且非空")
  }
  const providers: string[] = []
  for (const p of rawProviders) {
    if (typeof p !== "string" || p.length === 0) {
      throw new Error("opencode-round-robin: options.providers 元素必须为非空字符串")
    }
    providers.push(p)
  }
  return {
    providers,
    cooldownMs: typeof options.cooldownMs === "number" ? options.cooldownMs : DEFAULT_COOLDOWN_MS,
    statsPath: typeof options.statsPath === "string" ? options.statsPath : undefined,
    logPath: typeof options.logPath === "string" ? options.logPath : undefined,
    logDir: typeof options.logDir === "string" ? options.logDir : undefined,
  }
}

/**
 * 从 opencode Config.provider 构建 KeyPool[]。
 *
 * 过滤出 providers 列表的 provider,按 baseURL 分组,每组 keys 为该组 provider 的 apiKey(去重),
 * 保留 key->provider 名映射(账号名,用于日志)。模型一致性由配置者保证,本函数不校验。
 *
 * @param config - opencode Config(config hook 收到)
 * @param providers - 参与轮询的 provider 名列表
 * @param cooldownMs - 全局冷却时长
 * @returns 按 baseURL 分组的 ParsedPool[]
 * @throws provider 名不存在或缺 baseURL/apiKey 时抛出
 */
export function buildPoolsFromProviders(
  config: { provider?: Record<string, { options?: { apiKey?: string; baseURL?: string } }> },
  providers: string[],
  cooldownMs: number,
): ParsedPool[] {
  const providerMap = config.provider
  if (!providerMap) {
    throw new Error("opencode-round-robin: Config.provider 为空")
  }
  // 校验 providers 都存在,并收集 baseURL+apiKey
  const collected = providers.map((name) => {
    const p = providerMap[name]
    if (!p) {
      throw new Error(`opencode-round-robin: provider "${name}" 不存在于 config.provider`)
    }
    const baseURL = p.options?.baseURL
    const apiKey = p.options?.apiKey
    if (typeof baseURL !== "string" || baseURL.length === 0) {
      throw new Error(`opencode-round-robin: provider "${name}" 缺少 options.baseURL`)
    }
    if (typeof apiKey !== "string" || apiKey.length === 0) {
      throw new Error(`opencode-round-robin: provider "${name}" 缺少 options.apiKey`)
    }
    return { name, baseURL, apiKey }
  })

  // 按 baseURL 分组,去重 key,保留 key->账号名映射
  const groups = new Map<string, { keys: string[]; keyAccounts: Map<string, string> }>()
  for (const { name, baseURL, apiKey } of collected) {
    let g = groups.get(baseURL)
    if (!g) {
      g = { keys: [], keyAccounts: new Map() }
      groups.set(baseURL, g)
    }
    if (!g.keys.includes(apiKey)) {
      g.keys.push(apiKey)
      g.keyAccounts.set(apiKey, name)
    }
  }

  return Array.from(groups.entries()).map(([baseURL, g]) => ({
    match: baseURL,
    keys: g.keys,
    keyAccounts: g.keyAccounts,
    cooldownMs,
  }))
}
