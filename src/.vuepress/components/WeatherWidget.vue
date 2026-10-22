<script setup lang="ts">
/**
 * 天气 / 季节控制面板
 *
 * - 左下角悬浮按钮：显示当前天气图标与温度
 * - 展开面板：切换季节、开关天气特效、重新定位
 * - 画布挂在 document.body 上，避免被主题的布局层裁剪
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { weatherConfig } from "../weather.config.js"
import { WeatherParticleEngine } from "../utils/particles.js"
import {
  applySeasonToDOM,
  currentSeason,
  initSeason,
  seasonOverride,
  setSeasonOverride,
  startSeasonClock,
  SEASONS,
  SEASON_LABELS,
  type Season,
} from "../utils/season.js"
import {
  clearWeatherCache,
  getWindDirectionName,
  getWindScale,
  loadWeather,
  type WeatherEffect,
  type WeatherInfo,
} from "../utils/weather.js"

const panelOpen = ref(false)
const loading = ref(false)
const effectEnabled = ref(true)
const weather = ref<WeatherInfo | null>(null)
const errorMessage = ref("")

/** 正在预览的特效；null 表示显示真实天气 */
const previewEffect = ref<WeatherEffect | null>(null)
/** 预览时的风速（km/h），用来直观看到风力对粒子轨迹的影响 */
const previewWind = ref(28)

let engine: WeatherParticleEngine | null = null
let canvas: HTMLCanvasElement | null = null
let mediaQuery: MediaQueryList | null = null

/** 可预览的特效 */
const PREVIEW_OPTIONS: { effect: WeatherEffect; label: string; icon: string }[] = [
  { effect: "rain", label: "雨", icon: "🌧️" },
  { effect: "snow", label: "雪", icon: "❄️" },
  { effect: "fog", label: "雾", icon: "🌫️" },
  { effect: "thunderstorm", label: "雷雨", icon: "⛈️" },
  { effect: "cloudy", label: "多云", icon: "⛅" },
  { effect: "overcast", label: "阴天", icon: "☁️" },
]

const PREVIEW_LABEL: Record<WeatherEffect, string> = {
  rain: "雨",
  snow: "雪",
  fog: "雾",
  thunderstorm: "雷雨",
  cloudy: "多云",
  overcast: "阴天",
  none: "无",
}

/** 预览固定用西北风（315°），雨丝会明显往右下方斜飞 */
const PREVIEW_WIND_DIRECTION = 315

/** 是否开启了「减少动态效果」 */
const reducedMotion = ref(false)

const WEATHER_ICONS: Record<number, string> = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  53: "🌦️",
  55: "🌧️",
  56: "🌧️",
  57: "🌧️",
  61: "🌧️",
  63: "🌧️",
  65: "🌧️",
  66: "🌧️",
  67: "🌧️",
  71: "❄️",
  73: "❄️",
  75: "❄️",
  77: "❄️",
  80: "🌦️",
  81: "🌧️",
  82: "🌧️",
  85: "🌨️",
  86: "🌨️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
}

const weatherIcon = computed(() => {
  // 预览模式下 FAB 图标跟着预览特效走，关闭面板后也能看出当前在预览
  if (previewEffect.value)
    return (
      PREVIEW_OPTIONS.find((item) => item.effect === previewEffect.value)?.icon ??
      "🌤️"
    )

  return weather.value ? (WEATHER_ICONS[weather.value.code] ?? "☁️") : "🌤️"
})

const windText = computed(() => {
  // 预览时展示预览风速
  if (previewEffect.value)
    return `${getWindDirectionName(PREVIEW_WIND_DIRECTION)} 预览风力（${previewWind.value} km/h）`

  if (!weather.value) return "—"

  const speed = weather.value.windSpeed

  return `${getWindDirectionName(weather.value.windDirection)} ${getWindScale(speed)}（${speed} km/h）`
})

const effectText = computed(() => {
  if (previewEffect.value) return `预览：${PREVIEW_LABEL[previewEffect.value]}`

  if (!weather.value) return "正在获取天气…"

  return `${weather.value.description} ${weather.value.temperature}°C`
})

/** FAB 悬浮提示；预览态下要显示预览风速，而不是真实天气风速 */
const fabTitle = computed(() => {
  const speed = previewEffect.value
    ? previewWind.value
    : weather.value?.windSpeed ?? 0

  return `${effectText.value} · 风力 ${speed} km/h`
})

/**
 * 按当前状态（是否开启 / 是否预览 / 预览哪种特效）把天气同步给粒子引擎
 */
function applyEffect(): void {
  if (!effectEnabled.value) {
    engine?.setWeather(null)
    return
  }

  if (previewEffect.value) {
    engine?.setWeather({
      location: "特效预览",
      temperature: 0,
      code: 0,
      description: PREVIEW_LABEL[previewEffect.value],
      effect: previewEffect.value,
      precipitation: 0,
      visibility: 20000,
      windSpeed: previewWind.value,
      windDirection: PREVIEW_WIND_DIRECTION,
      intensity: 0.85,
    })
    return
  }

  engine?.setWeather(weather.value)
}

/** 选中某个预览特效；再次点击同一个按钮则取消预览 */
function selectPreview(effect: WeatherEffect): void {
  previewEffect.value = previewEffect.value === effect ? null : effect
  applyEffect()
}

/** 退出预览，回到真实天气 */
function clearPreview(): void {
  previewEffect.value = null
  applyEffect()
}

/** 拉取天气并同步到粒子引擎 */
async function refresh(force = false): Promise<void> {
  if (force) clearWeatherCache()

  loading.value = true
  errorMessage.value = ""

  try {
    const info = await loadWeather(weatherConfig)

    weather.value = info

    if (!info) {
      errorMessage.value = "天气数据获取失败"
      engine?.setWeather(null)
      return
    }

    applyEffect()
  } catch (error) {
    errorMessage.value = "天气数据获取失败"
    console.warn("[weather] failed to load weather", error)
  } finally {
    loading.value = false
  }
}

function toggleEffect(): void {
  effectEnabled.value = !effectEnabled.value
  applyEffect()
}

function selectSeason(season: Season | "auto"): void {
  setSeasonOverride(season)
  applySeasonToDOM(currentSeason.value)
}

/** 系统「减少动态效果」偏好变化时，实时开关粒子动画 */
function onMotionPreferenceChange(event: MediaQueryListEvent): void {
  reducedMotion.value = event.matches
  engine?.setReducedMotion(event.matches)
}

watch(currentSeason, (season) => {
  applySeasonToDOM(season)
  engine?.setSeason(season)
})

// 拖动风力滑块时实时改变粒子轨迹
watch(previewWind, () => {
  if (previewEffect.value) applyEffect()
})

onMounted(() => {
  initSeason()
  startSeasonClock()

  // 画布直接挂在 body 上，规避主题布局的定位/裁剪
  canvas = document.createElement("canvas")
  canvas.className = "weather-canvas"
  canvas.setAttribute("aria-hidden", "true")
  document.body.appendChild(canvas)

  mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
  reducedMotion.value = mediaQuery.matches
  mediaQuery.addEventListener("change", onMotionPreferenceChange)

  try {
    engine = new WeatherParticleEngine(canvas, {
      season: currentSeason.value,
      reducedMotion: reducedMotion.value,
    })
    engine.start()
  } catch (error) {
    console.warn("[weather] failed to create particle engine", error)
    engine = null
  }

  void refresh()

  // 30 分钟后自动刷新一次天气
  window.setTimeout(() => void refresh(true), 30 * 60 * 1000)
})

onBeforeUnmount(() => {
  engine?.destroy()
  engine = null

  mediaQuery?.removeEventListener("change", onMotionPreferenceChange)

  if (canvas?.parentNode) canvas.parentNode.removeChild(canvas)
  canvas = null
})
</script>

<template>
  <div class="weather-widget" :class="{ 'is-open': panelOpen }">
    <Transition name="weather-panel">
      <div v-if="panelOpen" class="weather-widget__panel">
        <div class="weather-widget__head">
          <span class="weather-widget__title">天气 · 季节</span>
          <button
            class="weather-widget__close"
            type="button"
            aria-label="关闭"
            @click="panelOpen = false"
          >
            ✕
          </button>
        </div>

        <div class="weather-widget__row">
          <div class="weather-widget__label">当前天气</div>
          <div class="weather-widget__value">
            <template v-if="weather">
              {{ weather.location }} · {{ effectText }}
            </template>
            <template v-else-if="loading">加载中…</template>
            <template v-else>未知</template>
          </div>
        </div>

        <div class="weather-widget__row">
          <div class="weather-widget__label">风力</div>
          <div class="weather-widget__value">{{ windText }}</div>
        </div>

        <div v-if="errorMessage" class="weather-widget__error">
          {{ errorMessage }}
        </div>

        <div class="weather-widget__row">
          <div class="weather-widget__label">季节主题</div>
          <div class="weather-widget__seasons">
            <button
              type="button"
              class="weather-widget__season"
              :class="{ 'is-active': seasonOverride === 'auto' }"
              @click="selectSeason('auto')"
            >
              自动
            </button>
            <button
              v-for="season in SEASONS"
              :key="season"
              type="button"
              class="weather-widget__season"
              :class="{ 'is-active': currentSeason === season }"
              @click="selectSeason(season)"
            >
              {{ SEASON_LABELS[season] }}
            </button>
          </div>
        </div>

        <div class="weather-widget__row">
          <div class="weather-widget__label">天气特效</div>
          <label class="weather-widget__switch">
            <input
              type="checkbox"
              :checked="effectEnabled"
              @change="toggleEffect"
            />
            <span class="weather-widget__slider" />
          </label>
        </div>

        <div class="weather-widget__row weather-widget__row--block">
          <div class="weather-widget__label">
            特效预览
            <span v-if="previewEffect" class="weather-widget__badge">预览中</span>
          </div>
          <div class="weather-widget__previews">
            <button
              v-for="option in PREVIEW_OPTIONS"
              :key="option.effect"
              type="button"
              class="weather-widget__preview"
              :class="{ 'is-active': previewEffect === option.effect }"
              :title="`预览${option.label}效果`"
              @click="selectPreview(option.effect)"
            >
              <span class="weather-widget__preview-icon">{{ option.icon }}</span>
              <span class="weather-widget__preview-label">{{ option.label }}</span>
            </button>
            <button
              type="button"
              class="weather-widget__preview weather-widget__preview--reset"
              :class="{ 'is-active': previewEffect === null }"
              title="回到真实天气"
              @click="clearPreview"
            >
              真实
            </button>
          </div>
        </div>

        <div v-if="previewEffect" class="weather-widget__row weather-widget__row--block">
          <div class="weather-widget__label">
            预览风力
            <span class="weather-widget__hint">{{ previewWind }} km/h</span>
          </div>
          <input
            v-model.number="previewWind"
            class="weather-widget__range"
            type="range"
            min="0"
            max="80"
            step="1"
            aria-label="预览风力"
          />
        </div>

        <div class="weather-widget__actions">
          <button type="button" class="weather-widget__btn" @click="refresh(true)">
            {{ loading ? "刷新中…" : "重新定位" }}
          </button>
        </div>
      </div>
    </Transition>

    <button
      type="button"
      class="weather-widget__fab"
      :title="fabTitle"
      @click="panelOpen = !panelOpen"
    >
      <span class="weather-widget__icon">{{ weatherIcon }}</span>
      <span v-if="weather" class="weather-widget__temp">{{ weather.temperature }}°</span>
    </button>
  </div>
</template>

<style scoped>
.weather-widget {
  position: fixed;
  inset-inline-end: 1rem;
  bottom: 8.5rem;
  z-index: 180;
  font-size: 0.875rem;
  line-height: 1.5;
}

.weather-widget__fab {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 999px;
  background: var(--vp-c-bg-elv);
  color: var(--vp-c-text);
  box-shadow: var(--vp-c-shadow);
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition:
    transform var(--vp-t-transform),
    background-color var(--vp-t-color);
}

.weather-widget__fab:hover {
  transform: translateY(-2px);
}

.weather-widget__icon {
  font-size: 1.15rem;
  line-height: 1;
}

.weather-widget__temp {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.weather-widget__panel {
  position: absolute;
  inset-inline-end: 0;
  bottom: calc(100% + 0.6rem);
  width: 19rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 0.75rem;
  background: var(--vp-c-bg-elv);
  color: var(--vp-c-text);
  box-shadow: var(--vp-c-shadow);
  backdrop-filter: blur(10px);
}

.weather-widget__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.6rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--vp-c-divider);
}

.weather-widget__title {
  font-weight: 600;
}

.weather-widget__close {
  border: none;
  background: transparent;
  color: var(--vp-c-text-mute);
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0.1rem 0.3rem;
}

.weather-widget__close:hover {
  color: var(--vp-c-text);
}

.weather-widget__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.55rem;
}

.weather-widget__label {
  flex: none;
  color: var(--vp-c-text-mute);
  font-size: 0.8rem;
}

.weather-widget__value {
  text-align: end;
  word-break: break-all;
}

.weather-widget__error {
  margin-bottom: 0.55rem;
  color: var(--vp-c-danger, #d5393e);
  font-size: 0.78rem;
}

.weather-widget__seasons {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.weather-widget__season {
  padding: 0.15rem 0.5rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 0.4rem;
  background: transparent;
  color: var(--vp-c-text);
  cursor: pointer;
  font-size: 0.78rem;
  line-height: 1.5;
}

.weather-widget__season.is-active {
  border-color: var(--vp-c-accent);
  background: var(--vp-c-accent-soft);
  color: var(--vp-c-accent);
}

/* ------------------------------- 特效预览 ------------------------------- */

.weather-widget__row--block {
  display: block;
}

.weather-widget__badge {
  margin-left: 0.3rem;
  padding: 0.05rem 0.35rem;
  border-radius: 0.4rem;
  background: var(--vp-c-accent-soft);
  color: var(--vp-c-accent);
  font-size: 0.7rem;
  white-space: nowrap;
}

.weather-widget__hint {
  margin-left: 0.3rem;
  color: var(--vp-c-text-mute);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.weather-widget__previews {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.25rem;
  margin-top: 0.35rem;
}

.weather-widget__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  padding: 0.22rem 0.42rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 0.45rem;
  background: transparent;
  color: var(--vp-c-text);
  cursor: pointer;
  font-size: 0.8rem;
  line-height: 1.4;
  transition:
    border-color var(--vp-t-color),
    background-color var(--vp-t-color);
}

.weather-widget__preview:hover {
  border-color: var(--vp-c-accent);
}

.weather-widget__preview.is-active {
  border-color: var(--vp-c-accent);
  background: var(--vp-c-accent-soft);
  color: var(--vp-c-accent);
}

.weather-widget__preview-icon {
  font-size: 0.95rem;
  line-height: 1;
}

.weather-widget__preview--reset {
  grid-column: 1 / -1;
}

.weather-widget__range {
  display: block;
  width: 100%;
  margin-top: 0.4rem;
  height: 0.9rem;
  accent-color: var(--vp-c-accent);
  cursor: pointer;
}

.weather-widget__switch {
  position: relative;
  display: inline-block;
  width: 2.4rem;
  height: 1.3rem;
  flex: none;
}

.weather-widget__switch input {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  cursor: pointer;
}

.weather-widget__slider {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: var(--vp-c-control);
  transition: background-color var(--vp-t-color);
  pointer-events: none;
}

.weather-widget__slider::before {
  content: "";
  position: absolute;
  top: 0.15rem;
  left: 0.15rem;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: var(--vp-c-bg);
  box-shadow: 0 1px 3px rgb(0 0 0 / 25%);
  transition: transform var(--vp-t-transform);
}

.weather-widget__switch input:checked + .weather-widget__slider {
  background: var(--vp-c-accent);
}

.weather-widget__switch input:checked + .weather-widget__slider::before {
  transform: translateX(1.1rem);
}

.weather-widget__actions {
  margin-top: 0.75rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--vp-c-divider);
  text-align: end;
}

.weather-widget__btn {
  padding: 0.25rem 0.7rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 0.4rem;
  background: transparent;
  color: var(--vp-c-text);
  cursor: pointer;
  font-size: 0.78rem;
}

.weather-widget__btn:hover {
  border-color: var(--vp-c-accent);
  color: var(--vp-c-accent);
}

.weather-panel-enter-active,
.weather-panel-leave-active {
  transition:
    opacity var(--vp-t-color),
    transform var(--vp-t-transform);
}

.weather-panel-enter-from,
.weather-panel-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}

@media print {
  .weather-widget {
    display: none;
  }
}
</style>

<style>
/* 画布挂在 body 上，因此样式不能是 scoped */
.weather-canvas {
  position: fixed;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

@media print {
  .weather-canvas {
    display: none;
  }
}
</style>
