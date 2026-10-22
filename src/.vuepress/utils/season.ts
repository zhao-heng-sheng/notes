/**
 * 四季主题 —— 季节判定与运行时状态
 *
 * 季节色板定义在 `styles/index.scss` 中，通过 `<html data-season="...">` 切换，
 * 因此本模块只负责「算出当前是哪个季节」以及「把结果同步到 DOM」。
 */

import { computed, ref, watch } from "vue"

export type Season = "spring" | "summer" | "autumn" | "winter"

export const SEASONS: readonly Season[] = ["spring", "summer", "autumn", "winter"] as const

export const SEASON_LABELS: Record<Season, string> = {
  spring: "春",
  summer: "夏",
  autumn: "秋",
  winter: "冬",
}

export const SEASON_FULL_LABELS: Record<Season, string> = {
  spring: "春季",
  summer: "夏季",
  autumn: "秋季",
  winter: "冬季",
}

/** 季节装饰粒子的颜色（与 index.scss 中的 --season-deco 保持一致） */
export const SEASON_DECO_COLORS: Record<Season, string> = {
  spring: "#f7b8cd",
  summer: "#8fd9cf",
  autumn: "#e0913c",
  winter: "#c3d6ee",
}

export const SEASON_STORAGE_KEY = "zhs-notes:season"

/**
 * 按月份判定季节（北半球）
 *
 * 3—5 月春、6—8 月夏、9—11 月秋、12—2 月冬
 */
export function getSeasonByDate(date: Date = new Date()): Season {
  const month = date.getMonth() + 1

  if (month >= 3 && month <= 5) return "spring"
  if (month >= 6 && month <= 8) return "summer"
  if (month >= 9 && month <= 11) return "autumn"

  return "winter"
}

/** 用户手动指定的季节；`auto` 表示跟随日期自动判定 */
export const seasonOverride = ref<Season | "auto">("auto")

/**
 * 季节时钟。
 *
 * computed 只在依赖变化时重算，而 `getSeasonByDate()` 并不是响应式数据，
 * 跨零点后需要手动「戳」一下让 computed 重新求值。
 * 注意不能写成 `seasonOverride.value = seasonOverride.value` ——
 * Vue 的 ref 用 `Object.is` 比较新旧值，赋同样的值不会触发更新。
 */
const seasonTick = ref(0)

/** 当前生效的季节 */
export const currentSeason = computed<Season>(() => {
  // 依赖 seasonTick，零点后自增即可触发重算
  void seasonTick.value

  return seasonOverride.value === "auto" ? getSeasonByDate() : seasonOverride.value
})

/** 把季节写到根元素上，供 CSS 选择器使用 */
export function applySeasonToDOM(season: Season): void {
  if (typeof document === "undefined") return

  document.documentElement.dataset.season = season
}

function readStoredOverride(): Season | "auto" {
  if (typeof localStorage === "undefined") return "auto"

  const stored = localStorage.getItem(SEASON_STORAGE_KEY)

  if (stored === "auto" || (SEASONS as readonly string[]).includes(stored))
    return stored as Season | "auto"

  return "auto"
}

function persistOverride(season: Season | "auto"): void {
  if (typeof localStorage === "undefined") return

  try {
    localStorage.setItem(SEASON_STORAGE_KEY, season)
  } catch {
    // 隐私模式下 localStorage 可能不可写，忽略即可
  }
}

/** 切换季节；传入 `auto` 恢复跟随日期 */
export function setSeasonOverride(season: Season | "auto"): void {
  seasonOverride.value = season
  persistOverride(season)
}

let initialized = false

/**
 * 初始化季节状态。
 *
 * 需要在客户端执行（依赖 localStorage / document）。
 */
export function initSeason(): void {
  if (initialized || typeof document === "undefined") return

  initialized = true

  seasonOverride.value = readStoredOverride()
  applySeasonToDOM(currentSeason.value)

  watch(currentSeason, (season) => {
    applySeasonToDOM(season)
  })
}

/**
 * 安排在「下一个本地零点」刷新季节。
 *
 * 跨年后 `getSeasonByDate()` 的结果会变，但 computed 不会自动重算，
 * 这里用一个定时器在零点过后重新触发。
 */
function scheduleSeasonRefresh(): void {
  if (typeof window === "undefined") return

  const now = new Date()
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    5,
  )
  const delay = Math.max(1000, nextMidnight.getTime() - now.getTime())

  window.setTimeout(() => {
    // 触发 computed 重算（跨零点后季节可能变了）
    seasonTick.value += 1
    scheduleSeasonRefresh()
  }, delay)
}

export function startSeasonClock(): void {
  if (typeof window === "undefined") return

  scheduleSeasonRefresh()
}
