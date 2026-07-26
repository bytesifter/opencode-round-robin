/**
 * 插件 options 解析后的完整配置。
 */
export interface ParsedOptions {
  /** 参与轮询的 provider 名(账号名)列表,必填非空 */
  providers: string[]
  /** 全局冷却时长(毫秒) */
  cooldownMs: number
  /** 统计文件路径(可选,覆盖默认) */
  statsPath?: string
  /** 日志文件路径(可选,覆盖默认,单文件不轮转) */
  logPath?: string
  /** 日志目录路径(可选,启用按日轮转) */
  logDir?: string
}

/**
 * 解析后的 key 池(由 buildPoolsFromProviders 按 baseURL 分组构建)。
 */
export interface ParsedPool {
  /** URL 前缀匹配串(即该组的 baseURL) */
  match: string
  /** 去重后的 key 列表 */
  keys: string[]
  /** 该 pool 的有效冷却时长(毫秒) */
  cooldownMs: number
  /** 单 key 时为 true,匹配该 pool 的请求透传不拦截 */
  passthrough: boolean
  /** key -> provider 名(账号名)映射,用于日志显示账号 */
  keyAccounts: Map<string, string>
}

/**
 * 单日统计项。
 */
export interface DayStats {
  /** 请求数 */
  req: number
  /** 输入 token */
  in: number
  /** 输出 token */
  out: number
  /** 推理 token */
  reasoning: number
  /** 缓存读 token */
  cacheRead: number
  /** 缓存写 token */
  cacheWrite: number
  /** 费用 */
  cost: number
}

/**
 * 统计存储:以日期(YYYY-MM-DD)为 key。
 */
export type StatsStore = Record<string, DayStats>

/** 日志级别 */
export type LogLevel = "INFO" | "WARN" | "ERROR"

/** 日志模式:simple(单文件)或 rotation(按日轮转) */
export type LogMode = "simple" | "rotation"

/**
 * event 层业务上下文(从 message.updated 事件提取)。
 */
export interface EventContext {
  /** sessionID 截短为前 4 位(隐私保护) */
  sessionID?: string
  /** 模型 ID(如 glm-5.2) */
  modelID?: string
  /** provider ID(如 volxc9208) */
  providerID?: string
  /** 模式(如 code/plan) */
  mode?: string
  /** agent 名 */
  agent?: string
  /** 消息耗时(毫秒,从 time.completed - time.created 计算) */
  durationMs?: number
}
