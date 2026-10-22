/**
 * 天气与季节的配置
 *
 * 想改默认定位、缓存时长或直接关掉特效，改这里即可。
 */

import type { WeatherOptions } from "./utils/weather.js"

export interface WeatherConfig extends WeatherOptions {
  /** 是否启用天气特效面板 */
  enabled: boolean
  /** 定位失败时的兜底坐标（默认按备案地河南 · 郑州） */
  defaultLocation: { latitude: number; longitude: number }
  /** 兜底地点名称 */
  defaultLocationName: string
  /** 坐标 / 天气缓存有效期（毫秒） */
  cacheTTL: number
}

export const weatherConfig: WeatherConfig = {
  enabled: true,
  defaultLocation: { latitude: 34.7466, longitude: 113.6253 },
  defaultLocationName: "郑州",
  cacheTTL: 30 * 60 * 1000,
}
