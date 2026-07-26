import type { StatsStore, DayStats } from "./types"

/** 默认展示天数 */
const DEFAULT_DAYS = 7

/** 柱状图最大宽度(字符数) */
const BAR_WIDTH = 16

/**
 * 由统计 store 生成按天的 ASCII 柱状图(请求数 + token 两列)。
 *
 * @param store - 统计数据
 * @param days - 展示最近多少天,默认 7
 * @returns 图表字符串;无数据时返回"暂无统计数据"
 */
export function renderChart(store: StatsStore, days: number = DEFAULT_DAYS): string {
  const entries = recentDays(store, days)
  if (entries.length === 0) return "暂无统计数据"

  const maxReq = Math.max(...entries.map((e) => e.stats.req), 1)
  const maxTok = Math.max(...entries.map((e) => totalToken(e.stats)), 1)

  const lines: string[] = []
  lines.push(`round-robin 近 ${days} 天统计`)
  lines.push("日期      请求                 token")
  for (const { day, stats } of entries) {
    const date = day.slice(5)
    const tok = totalToken(stats)
    const reqBar = bar(stats.req, maxReq, BAR_WIDTH)
    const tokBar = bar(tok, maxTok, BAR_WIDTH)
    lines.push(`${date}  ${reqBar} ${String(stats.req).padStart(5)}   ${tokBar} ${fmtTok(tok).padStart(7)}`)
  }
  return lines.join("\n")
}

/**
 * 取 store 中最近 N 天(按日期降序,仅含有数据的天)。
 */
function recentDays(store: StatsStore, days: number): { day: string; stats: DayStats }[] {
  return Object.entries(store)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, days)
    .map(([day, stats]) => ({ day, stats }))
}

/** 单日 token 总消耗(input+output+reasoning+cache) */
function totalToken(s: DayStats): number {
  return s.in + s.out + s.reasoning + s.cacheRead + s.cacheWrite
}

/** 生成归一化柱:█ 填充,· 空白 */
function bar(value: number, max: number, width: number): string {
  if (max <= 0) return " ".repeat(width)
  const filled = Math.round((value / max) * width)
  return "█".repeat(filled).padEnd(width, "·")
}

/** 格式化 token 数:>=1000 用 k 后缀 */
function fmtTok(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k"
  return String(n)
}
