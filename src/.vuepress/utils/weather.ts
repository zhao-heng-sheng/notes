/**
 * 天气数据 —— 依据访问者地理位置获取实时天气，并翻译成粒子特效参数
 *
 * 定位优先级：
 *   1. 浏览器 Geolocation（精确，需授权）
 *   2. IP 归属地（geojs，免密钥）
 *   3. 时区推断（离线兜底）
 *   4. 主题配置里的默认坐标
 *
 * 天气数据来自 Open-Meteo（https://open-meteo.com/），免费、无需 API Key。
 */

export type WeatherEffect =
  | "rain"
  | "snow"
  | "fog"
  | "thunderstorm"
  | "cloudy"
  | "overcast"
  | "none"

export interface Coordinates {
  latitude: number
  longitude: number
}

export interface WeatherInfo {
  /** 地点名称，如「郑州市 河南省 中国」 */
  location: string
  temperature: number
  /** WMO weather code */
  code: number
  /** 中文天气描述 */
  description: string
  /** 对应的粒子特效 */
  effect: WeatherEffect
  /** 降水量（mm/h） */
  precipitation: number
  /** 能见度（米） */
  visibility: number
  /** 风速（km/h） */
  windSpeed: number
  /** 风向（0 = 正北，顺时针） */
  windDirection: number
  /** 特效强度 0 ~ 1 */
  intensity: number
}

export interface WeatherOptions {
  /** 定位失败时的默认坐标 */
  defaultLocation?: Coordinates
  /** 默认地点名称 */
  defaultLocationName?: string
  /** 坐标缓存有效期（毫秒） */
  cacheTTL?: number
}

const GEOLOCATION_TIMEOUT = 8000
const IP_GEOLOCATION_URL = "https://get.geojs.io/v1/ip/geo.json"
const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
const COORDS_STORAGE_KEY = "zhs-notes:coords"
const WEATHER_STORAGE_KEY = "zhs-notes:weather"

export const DEFAULT_OPTIONS: Required<WeatherOptions> = {
  defaultLocation: { latitude: 34.7466, longitude: 113.6253 },
  defaultLocationName: "郑州",
  cacheTTL: 30 * 60 * 1000,
}

/* -------------------------------------------------------------------------- */
/*                                WMO 天气码                                  */
/* -------------------------------------------------------------------------- */

interface WmoEntry {
  description: string
  effect: WeatherEffect
  /** 特效强度基准 */
  intensity: number
}

/** WMO 4677 天气现象代码表 */
export const WMO_WEATHER_CODES: Record<number, WmoEntry> = {
  0: { description: "晴", effect: "none", intensity: 0 },
  1: { description: "晴间多云", effect: "cloudy", intensity: 0.3 },
  2: { description: "多云", effect: "cloudy", intensity: 0.55 },
  3: { description: "阴", effect: "overcast", intensity: 0.6 },
  45: { description: "雾", effect: "fog", intensity: 0.6 },
  48: { description: "雾凇", effect: "fog", intensity: 0.8 },
  51: { description: "小毛毛雨", effect: "rain", intensity: 0.25 },
  53: { description: "毛毛雨", effect: "rain", intensity: 0.35 },
  55: { description: "浓毛毛雨", effect: "rain", intensity: 0.5 },
  56: { description: "冻毛毛雨", effect: "rain", intensity: 0.35 },
  57: { description: "浓冻毛毛雨", effect: "rain", intensity: 0.5 },
  61: { description: "小雨", effect: "rain", intensity: 0.4 },
  63: { description: "中雨", effect: "rain", intensity: 0.65 },
  65: { description: "大雨", effect: "rain", intensity: 0.9 },
  66: { description: "冻雨", effect: "rain", intensity: 0.45 },
  67: { description: "强冻雨", effect: "rain", intensity: 0.75 },
  71: { description: "小雪", effect: "snow", intensity: 0.35 },
  73: { description: "中雪", effect: "snow", intensity: 0.6 },
  75: { description: "大雪", effect: "snow", intensity: 0.9 },
  77: { description: "米雪", effect: "snow", intensity: 0.4 },
  80: { description: "小阵雨", effect: "rain", intensity: 0.45 },
  81: { description: "阵雨", effect: "rain", intensity: 0.7 },
  82: { description: "强阵雨", effect: "rain", intensity: 1 },
  85: { description: "小阵雪", effect: "snow", intensity: 0.4 },
  86: { description: "大阵雪", effect: "snow", intensity: 0.85 },
  95: { description: "雷阵雨", effect: "thunderstorm", intensity: 0.8 },
  96: { description: "雷阵雨伴小冰雹", effect: "thunderstorm", intensity: 0.9 },
  99: { description: "雷阵雨伴强冰雹", effect: "thunderstorm", intensity: 1 },
}

export function getWeatherDescription(code: number): string {
  return WMO_WEATHER_CODES[code]?.description ?? "未知"
}

export function getWeatherEffect(code: number): WeatherEffect {
  return WMO_WEATHER_CODES[code]?.effect ?? "none"
}

/** 风向（角度）转中文方位 */
export function getWindDirectionName(degrees: number): string {
  const names = [
    "北风",
    "东北风",
    "东风",
    "东南风",
    "南风",
    "西南风",
    "西风",
    "西北风",
  ]
  const index = Math.round(((degrees % 360) + 360) % 360 / 45) % 8

  return names[index]
}

/** 蒲福风级 */
export function getWindScale(speedKmh: number): string {
  const levels = [
    [1, "无风"],
    [6, "软风"],
    [12, "轻风"],
    [20, "微风"],
    [29, "和风"],
    [39, "强风"],
    [50, "疾风"],
    [62, "大风"],
    [75, "烈风"],
    [89, "狂风"],
    [103, "暴风"],
    [118, "飓风"],
  ]

  for (const [limit, name] of levels)
    if (speedKmh < limit) return name

  return "台风级"
}

/* -------------------------------------------------------------------------- */
/*                                  定位                                       */
/* -------------------------------------------------------------------------- */

/** 常见时区 → 代表性坐标，用于离线兜底 */
const TIMEZONE_COORDINATES: Record<string, Coordinates> = {
  "Asia/Shanghai": { latitude: 31.2304, longitude: 121.4737 },
  "Asia/Chongqing": { latitude: 29.563, longitude: 106.5516 },
  "Asia/Harbin": { latitude: 45.8038, longitude: 126.5349 },
  "Asia/Urumqi": { latitude: 43.8256, longitude: 87.6168 },
  "Asia/Kashgar": { latitude: 39.4704, longitude: 75.9898 },
  "Asia/Hong_Kong": { latitude: 22.3193, longitude: 114.1694 },
  "Asia/Macau": { latitude: 22.1987, longitude: 113.5439 },
  "Asia/Taipei": { latitude: 25.033, longitude: 121.5654 },
  "Asia/Tokyo": { latitude: 35.6762, longitude: 139.6503 },
  "Asia/Seoul": { latitude: 37.5665, longitude: 126.978 },
  "Asia/Singapore": { latitude: 1.3521, longitude: 103.8198 },
  "Asia/Dubai": { latitude: 25.2048, longitude: 55.2708 },
  "Asia/Bangkok": { latitude: 13.7563, longitude: 100.5018 },
  "Europe/London": { latitude: 51.5072, longitude: -0.1276 },
  "Europe/Paris": { latitude: 48.8566, longitude: 2.3522 },
  "Europe/Berlin": { latitude: 52.52, longitude: 13.405 },
  "Europe/Moscow": { latitude: 55.7558, longitude: 37.6173 },
  "America/New_York": { latitude: 40.7128, longitude: -74.006 },
  "America/Chicago": { latitude: 41.8781, longitude: -87.6298 },
  "America/Denver": { latitude: 39.7392, longitude: -104.9903 },
  "America/Los_Angeles": { latitude: 34.0522, longitude: -118.2437 },
  "America/Sao_Paulo": { latitude: -23.5505, longitude: -46.6333 },
  "Australia/Sydney": { latitude: -33.8688, longitude: 151.2093 },
  "Pacific/Auckland": { latitude: -36.8509, longitude: 174.7645 },
  UTC: { latitude: 51.4769, longitude: 0 },
}

function getCoordinatesFromTimezone(): Coordinates | null {
  if (typeof Intl === "undefined") return null

  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

    return TIMEZONE_COORDINATES[timeZone] ?? null
  } catch {
    return null
  }
}

function getBrowserCoordinates(): Promise<Coordinates | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null)

  return new Promise((resolve) => {
    let settled = false
    const done = (value: Coordinates | null) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    try {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          done({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        () => done(null),
        {
          timeout: GEOLOCATION_TIMEOUT,
          maximumAge: 10 * 60 * 1000,
          enableHighAccuracy: false,
        },
      )
    } catch {
      done(null)
    }
  })
}

async function getIPCoordinates(): Promise<Coordinates | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const response = await fetch(IP_GEOLOCATION_URL, {
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!response.ok) return null

    const data = (await response.json()) as {
      latitude?: number
      longitude?: number
      city?: string
      country?: string
    }

    if (typeof data.latitude !== "number" || typeof data.longitude !== "number")
      return null

    return { latitude: data.latitude, longitude: data.longitude }
  } catch {
    return null
  }
}

interface StoredCoords {
  coordinates: Coordinates
  timestamp: number
  location?: string
}

function readCachedCoordinates(cacheTTL: number): StoredCoords | null {
  if (typeof localStorage === "undefined") return null

  try {
    const raw = localStorage.getItem(COORDS_STORAGE_KEY)

    if (!raw) return null

    const parsed = JSON.parse(raw) as StoredCoords

    if (!parsed?.coordinates) return null
    if (Date.now() - parsed.timestamp > cacheTTL) return null

    return parsed
  } catch {
    return null
  }
}

function cacheCoordinates(
  coordinates: Coordinates,
  location?: string,
): void {
  if (typeof localStorage === "undefined") return

  try {
    localStorage.setItem(
      COORDS_STORAGE_KEY,
      JSON.stringify({ coordinates, location, timestamp: Date.now() }),
    )
  } catch {
    // 忽略写入失败
  }
}

export interface ResolvedLocation extends Coordinates {
  location: string
  source: "browser" | "ip" | "timezone" | "default" | "cache"
}

/**
 * 解析访问者位置
 */
export async function resolveLocation(
  options: WeatherOptions = {},
): Promise<ResolvedLocation> {
  const { defaultLocation, defaultLocationName, cacheTTL } = {
    ...DEFAULT_OPTIONS,
    ...options,
  }

  const cached = readCachedCoordinates(cacheTTL)

  if (cached)
    return {
      ...cached.coordinates,
      location: cached.location ?? defaultLocationName,
      source: "cache",
    }

  // 1. 浏览器精确定位
  const browser = await getBrowserCoordinates()

  if (browser) {
    cacheCoordinates(browser)

    return {
      ...browser,
      location: "当前位置",
      source: "browser",
    }
  }

  // 2. IP 归属地
  const ip = await getIPCoordinates()

  if (ip) {
    cacheCoordinates(ip)

    return {
      ...ip,
      location: "当前位置",
      source: "ip",
    }
  }

  // 3. 时区推断
  const timezone = getCoordinatesFromTimezone()

  if (timezone) {
    cacheCoordinates(timezone, defaultLocationName)

    return {
      ...timezone,
      location: defaultLocationName,
      source: "timezone",
    }
  }

  // 4. 兜底
  return {
    ...defaultLocation,
    location: defaultLocationName,
    source: "default",
  }
}

/* -------------------------------------------------------------------------- */
/*                              拉取天气数据                                   */
/* -------------------------------------------------------------------------- */

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number
    weather_code?: number
    wind_speed_10m?: number
    wind_direction_10m?: number
    precipitation?: number
    visibility?: number
  }
}

function readCachedWeather(cacheTTL: number): WeatherInfo | null {
  if (typeof localStorage === "undefined") return null

  try {
    const raw = localStorage.getItem(WEATHER_STORAGE_KEY)

    if (!raw) return null

    const parsed = JSON.parse(raw) as { info: WeatherInfo; timestamp: number }

    if (!parsed?.info) return null
    if (Date.now() - parsed.timestamp > cacheTTL) return null

    return parsed.info
  } catch {
    return null
  }
}

function cacheWeather(info: WeatherInfo): void {
  if (typeof localStorage === "undefined") return

  try {
    localStorage.setItem(
      WEATHER_STORAGE_KEY,
      JSON.stringify({ info, timestamp: Date.now() }),
    )
  } catch {
    // 忽略写入失败
  }
}

/**
 * 根据坐标拉取实时天气
 */
export async function fetchWeather(
  coordinates: Coordinates,
  options: WeatherOptions = {},
): Promise<WeatherInfo | null> {
  const { cacheTTL } = { ...DEFAULT_OPTIONS, ...options }

  const cached = readCachedWeather(cacheTTL)

  if (cached) return cached

  const params = new URLSearchParams({
    latitude: coordinates.latitude.toFixed(4),
    longitude: coordinates.longitude.toFixed(4),
    current:
      "temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation,visibility",
    timezone: "auto",
  })

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(`${OPEN_METEO_URL}?${params.toString()}`, {
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!response.ok) return null

    const data = (await response.json()) as OpenMeteoResponse
    const current = data.current

    if (!current || typeof current.weather_code !== "number") return null

    const code = current.weather_code
    const entry = WMO_WEATHER_CODES[code]
    const precipitation = current.precipitation ?? 0
    const visibility = current.visibility ?? 20000

    // 降水量可以进一步放大强度：1mm/h 已经是比较明显的雨
    const rainBoost = Math.min(1, precipitation / 6)
    const intensity = Math.min(
      1,
      (entry?.intensity ?? 0.4) * 0.75 + rainBoost * 0.35,
    )

    const info: WeatherInfo = {
      location: "",
      temperature: Math.round(current.temperature_2m ?? 0),
      code,
      description: getWeatherDescription(code),
      effect: getWeatherEffect(code),
      precipitation,
      visibility,
      windSpeed: Math.round(current.wind_speed_10m ?? 0),
      windDirection: Math.round(current.wind_direction_10m ?? 0),
      intensity,
    }

    cacheWeather(info)

    return info
  } catch {
    return null
  }
}

/**
 * 一步到位：定位 + 拉取天气
 */
export async function loadWeather(
  options: WeatherOptions = {},
): Promise<WeatherInfo | null> {
  const resolved = await resolveLocation(options)
  const info = await fetchWeather(resolved, options)

  if (!info) return null

  return {
    ...info,
    location:
      resolved.location && resolved.location !== "当前位置"
        ? resolved.location
        : resolved.location || DEFAULT_OPTIONS.defaultLocationName,
  }
}

/** 供调试面板使用：强制刷新（跳过缓存） */
export function clearWeatherCache(): void {
  if (typeof localStorage === "undefined") return

  try {
    localStorage.removeItem(WEATHER_STORAGE_KEY)
    localStorage.removeItem(COORDS_STORAGE_KEY)
  } catch {
    // 忽略
  }
}
