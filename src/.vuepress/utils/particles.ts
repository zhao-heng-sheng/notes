/**
 * 天气粒子引擎 —— 基于 Canvas 2D
 *
 * 支持：雨 / 雪 / 雾 / 雷雨，以及随季节变化的装饰粒子（春花、夏光、秋叶）。
 * 风力以「风速 + 风向」共同决定粒子的水平漂移速度与下落轨迹倾角，
 * 并叠加缓慢的阵风波动，使效果更接近真实天气。
 *
 * 引擎不依赖 Vue，可单独在客户端创建 / 销毁。
 */

import type { Season } from "./season.js"
import { SEASON_DECO_COLORS } from "./season.js"
import type { WeatherEffect, WeatherInfo } from "./weather.js"

interface BaseParticle {
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  size: number
}

interface RainParticle extends BaseParticle {
  kind: "rain"
  /** 拖尾长度系数 */
  streak: number
  /** 下落速度系数 */
  fallFactor: number
}

interface SnowParticle extends BaseParticle {
  kind: "snow"
  /** 摆动相位 */
  phase: number
  /** 摆动幅度（px） */
  swayAmp: number
  /** 摆动频率 */
  swayFreq: number
  /** 自转速度 */
  spin: number
  angle: number
}

interface FogParticle extends BaseParticle {
  kind: "fog"
  radius: number
  angle: number
  spin: number
}

interface CloudParticle extends BaseParticle {
  kind: "cloud"
  /** 云团整体半径基准 */
  radius: number
  /** 云团由若干圆形组成，记录相对偏移与半径 */
  puffs: { dx: number; dy: number; r: number }[]
  /** 自身漂移偏置（px/s），保证无风时云也在缓慢移动 */
  driftBias: number
  /** 垂直起伏幅度与频率 */
  bobAmp: number
  bobFreq: number
  phase: number
  /** 多云=浅色云 / 阴天=暗色云 */
  tone: "light" | "dark"
}

interface DecoParticle extends BaseParticle {
  kind: "deco"
  /** 春=花瓣 / 秋=落叶 */
  shape: "petal" | "leaf"
  phase: number
  swayAmp: number
  swayFreq: number
  angle: number
  spin: number
  color: string
}

type Particle =
  | RainParticle
  | SnowParticle
  | FogParticle
  | CloudParticle
  | DecoParticle

export interface ParticleEngineOptions {
  /** 当前季节，决定装饰粒子 */
  season?: Season
  /** 用户是否开启了「减少动态效果」 */
  reducedMotion?: boolean
}

const MAX_DPR = 2

/** 各特效对风力的敏感系数 */
const WIND_SENSITIVITY: Record<WeatherEffect, number> = {
  rain: 1,
  snow: 0.55,
  fog: 1.2,
  thunderstorm: 1.15,
  cloudy: 0.5,
  overcast: 0.45,
  none: 0,
}

/** 会遮挡视线、不宜叠加季节装饰的特效 */
const BLOCKING_EFFECTS: WeatherEffect[] = ["rain", "snow", "fog", "thunderstorm"]

export class WeatherParticleEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private options: Required<ParticleEngineOptions>

  private particles: Particle[] = []
  private weather: WeatherInfo | null = null
  private season: Season

  private width = 0
  private height = 0
  private dpr = 1

  private rafId: number | null = null
  private lastTime = 0
  private elapsed = 0

  /** 风的水平速度（px/s，正数向右） */
  private windSpeed = 0
  /** 风的水平分量系数 -1 ~ 1 */
  private windDirX = 0
  /** 阵风波动相位 */
  private gustPhase = 0

  /** 闪电状态 */
  private lightningTimer = 6
  private flash = 0
  private bolt: { x: number; y: number }[] = []
  private boltTimer = 0

  private resizeHandler: () => void
  private visibilityHandler: () => void

  constructor(canvas: HTMLCanvasElement, options: ParticleEngineOptions = {}) {
    this.canvas = canvas
    this.options = {
      season: options.season ?? "spring",
      reducedMotion: options.reducedMotion ?? false,
    }
    this.season = this.options.season

    const ctx = canvas.getContext("2d")

    if (!ctx) throw new Error("Canvas 2D context is not available")

    this.ctx = ctx

    this.resizeHandler = () => this.resize()
    this.visibilityHandler = () => {
      if (document.hidden) this.stop()
      else this.start()
    }

    this.resize()
    window.addEventListener("resize", this.resizeHandler)
    document.addEventListener("visibilitychange", this.visibilityHandler)
  }

  /* ------------------------------- 对外接口 ------------------------------- */

  setWeather(weather: WeatherInfo | null): void {
    this.weather = weather
    this.applyWind()
    this.rebuildParticles()
  }

  setSeason(season: Season): void {
    if (season === this.season) return

    this.season = season
    this.rebuildParticles()
  }

  setReducedMotion(reduced: boolean): void {
    this.options.reducedMotion = reduced
    this.rebuildParticles()
  }

  start(): void {
    if (this.rafId !== null) return
    if (typeof requestAnimationFrame === "undefined") return

    this.lastTime = 0
    this.rafId = requestAnimationFrame(this.tick)
  }

  stop(): void {
    if (this.rafId === null) return

    cancelAnimationFrame(this.rafId)
    this.rafId = null
  }

  destroy(): void {
    this.stop()
    window.removeEventListener("resize", this.resizeHandler)
    document.removeEventListener("visibilitychange", this.visibilityHandler)
    this.particles = []
  }

  /* -------------------------------- 内部实现 ------------------------------- */

  private resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    this.width = window.innerWidth
    this.height = window.innerHeight

    this.canvas.width = Math.floor(this.width * this.dpr)
    this.canvas.height = Math.floor(this.height * this.dpr)
    this.canvas.style.width = `${this.width}px`
    this.canvas.style.height = `${this.height}px`

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.rebuildParticles()
  }

  /** 根据天气计算风力（水平速度 + 方向） */
  private applyWind(): void {
    const weather = this.weather

    if (!weather) {
      this.windSpeed = 0
      this.windDirX = 0
      return
    }

    const sensitivity = WIND_SENSITIVITY[weather.effect] ?? 0

    // 30km/h 时风速约等于屏幕高度的 3.6%，视觉上能明显看出雨丝倾斜
    const base = weather.windSpeed * this.height * 0.012 * sensitivity

    // 气象风向是「风从哪里来」，实际吹向 (dir + 180)
    const toward = (((weather.windDirection + 180) % 360) * Math.PI) / 180

    this.windDirX = Math.sin(toward)
    this.windSpeed = base * this.windDirX
  }

  /** 当前风速（含阵风波动） */
  private get gustSpeed(): number {
    const slow = Math.sin(this.gustPhase) * 0.26
    const fast = Math.sin(this.gustPhase * 2.7 + 1.3) * 0.11

    return this.windSpeed * (1 + slow + fast)
  }

  private get area(): number {
    return this.width * this.height
  }

  /** 当前是否为暗色主题（决定云层配色，保证两种背景下都看得见） */
  private get isDarkTheme(): boolean {
    if (typeof document === "undefined") return false

    return document.documentElement.getAttribute("data-theme") === "dark"
  }

  private get effect(): WeatherEffect {
    return this.weather?.effect ?? "none"
  }

  private rebuildParticles(): void {
    const particles: Particle[] = []

    if (!this.options.reducedMotion) {
      particles.push(...this.createWeatherParticles())
      particles.push(...this.createDecoParticles())
    }

    this.particles = particles
  }

  private createWeatherParticles(): Particle[] {
    const effect = this.effect
    const particles: Particle[] = []
    const area = this.area

    if (effect === "rain" || effect === "thunderstorm") {
      const count = Math.min(
        effect === "thunderstorm" ? 520 : 420,
        Math.max(80, Math.round(area / (effect === "thunderstorm" ? 5000 : 9000))),
      )

      for (let i = 0; i < count; i++) particles.push(this.createRainParticle())
    } else if (effect === "snow") {
      const count = Math.min(260, Math.max(50, Math.round(area / 16000)))

      for (let i = 0; i < count; i++) particles.push(this.createSnowParticle())
    } else if (effect === "fog") {
      const count = Math.min(16, Math.max(6, Math.round(area / 250000)))

      for (let i = 0; i < count; i++) particles.push(this.createFogParticle())
    } else if (effect === "cloudy" || effect === "overcast") {
      // 阴天的云更厚更多，铺满天空形成连片云层
      const dark = effect === "overcast"
      const count = dark
        ? Math.min(13, Math.max(8, Math.round(area / 200000)))
        : Math.min(10, Math.max(6, Math.round(area / 260000)))

      for (let i = 0; i < count; i++)
        particles.push(this.createCloudParticle(dark ? "dark" : "light"))
    }

    return particles
  }

  private createDecoParticles(): Particle[] {
    // 降水 / 雾气会遮挡视线，此时不再叠加季节装饰，避免画面杂乱；
    // 多云、阴天只是云层，落叶花瓣与云同框反而更有层次
    if (BLOCKING_EFFECTS.includes(this.effect)) return []

    const particles: Particle[] = []

    if (this.season === "spring" || this.season === "autumn") {
      const shape = this.season === "spring" ? "petal" : "leaf"
      const count = Math.min(
        60,
        Math.max(12, Math.round(this.area / (shape === "petal" ? 40000 : 45000))),
      )

      for (let i = 0; i < count; i++) particles.push(this.createDecoParticle(shape))
    }

    return particles
  }

  private createRainParticle(): RainParticle {
    return {
      kind: "rain",
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: 0,
      vy: 0,
      alpha: 0.18 + Math.random() * 0.32,
      size: 0.6 + Math.random() * 0.9,
      streak: 8 + Math.random() * 22,
      fallFactor: 0.8 + Math.random() * 0.5,
    }
  }

  private createSnowParticle(): SnowParticle {
    return {
      kind: "snow",
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: 0,
      vy: 0,
      alpha: 0.4 + Math.random() * 0.5,
      size: 1 + Math.random() * 2.4,
      phase: Math.random() * Math.PI * 2,
      swayAmp: 8 + Math.random() * 26,
      swayFreq: 0.4 + Math.random() * 0.9,
      spin: (Math.random() - 0.5) * 0.6,
      angle: Math.random() * Math.PI * 2,
    }
  }

  private createFogParticle(): FogParticle {
    const radius = 140 + Math.random() * 320

    return {
      kind: "fog",
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: 0,
      vy: 0,
      alpha: 0.05 + Math.random() * 0.09,
      size: radius,
      radius,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.08,
    }
  }

  private createCloudParticle(tone: "light" | "dark"): CloudParticle {
    // 云团刻意做小、做淡 —— 天气层画在正文之上，云太大太实就会挡住内容
    const base = tone === "dark" ? 70 + Math.random() * 100 : 52 + Math.random() * 82
    const puffCount = 4 + Math.floor(Math.random() * 3)
    const puffs: { dx: number; dy: number; r: number }[] = []

    // 若干大小不一的圆形叠在一起，形成蓬松的团状轮廓
    for (let i = 0; i < puffCount; i++)
      puffs.push({
        dx: (Math.random() - 0.5) * base * 1.7,
        dy: (Math.random() - 0.5) * base * 0.4,
        r: base * (0.3 + Math.random() * 0.42),
      })

    return {
      kind: "cloud",
      x: Math.random() * (this.width + 400) - 200,
      // 云只占画面上方，正文区域保持干净
      y: Math.random() * this.height * (tone === "dark" ? 0.4 : 0.34),
      vx: 0,
      vy: 0,
      alpha:
        tone === "dark" ? 0.1 + Math.random() * 0.11 : 0.13 + Math.random() * 0.12,
      size: base,
      radius: base,
      puffs,
      // 自身也带一点漂移，这样即便完全无风，云也不会静止不动
      driftBias: (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 13),
      bobAmp: 4 + Math.random() * 10,
      bobFreq: 0.08 + Math.random() * 0.16,
      phase: Math.random() * Math.PI * 2,
      tone,
    }
  }

  private createDecoParticle(shape: "petal" | "leaf"): DecoParticle {
    return {
      kind: "deco",
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: 0,
      vy: 0,
      alpha: 0.35 + Math.random() * 0.45,
      size: 4 + Math.random() * 5,
      phase: Math.random() * Math.PI * 2,
      swayAmp: 14 + Math.random() * 38,
      swayFreq: 0.3 + Math.random() * 0.8,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 1.4,
      shape,
      color: SEASON_DECO_COLORS[this.season],
    }
  }

  private tick = (time: number): void => {
    this.rafId = requestAnimationFrame(this.tick)

    if (!this.lastTime) this.lastTime = time

    // 上限 50ms，避免切回标签页时粒子瞬移
    const dt = Math.min(0.05, (time - this.lastTime) / 1000)

    this.lastTime = time
    this.elapsed += dt
    this.gustPhase += dt * 0.9

    this.update(dt)
    this.render()
  }

  private update(dt: number): void {
    const gust = this.gustSpeed
    const effect = this.effect
    const intensity = this.weather?.intensity ?? 0

    for (const particle of this.particles) {
      switch (particle.kind) {
        case "rain": {
          const fallSpeed = this.height * 1.5 * particle.fallFactor

          particle.x += gust * dt
          particle.y += fallSpeed * dt

          // 落到底部 → 从顶部重来
          if (particle.y > this.height + 30)
            Object.assign(particle, this.createRainParticle(), { y: -20 })
          // 被风吹出左右边界 → 环绕，而不是整体重生
          // （否则大风时所有粒子会挤在一条竖带里）
          else if (particle.x < -60) particle.x = this.width + 40
          else if (particle.x > this.width + 60) particle.x = -40
          break
        }
        case "snow": {
          const fallSpeed = this.height * 0.12 * (0.6 + particle.size / 4)

          particle.phase += particle.swayFreq * dt
          particle.x += (gust + Math.sin(particle.phase) * particle.swayAmp) * dt
          particle.y += fallSpeed * dt
          particle.angle += particle.spin * dt

          if (particle.y > this.height + 10)
            Object.assign(particle, this.createSnowParticle(), { y: -10 })
          else if (particle.x < -60) particle.x = this.width + 40
          else if (particle.x > this.width + 60) particle.x = -40
          break
        }
        case "fog": {
          particle.x += gust * 0.35 * dt
          particle.y += Math.sin(this.elapsed * 0.15 + particle.angle) * 6 * dt
          particle.angle += particle.spin * dt

          if (particle.x > this.width + particle.radius) particle.x = -particle.radius
          if (particle.x < -particle.radius) particle.x = this.width + particle.radius
          break
        }
        case "cloud": {
          // 云随风飘，但速度远小于雨雪；自身偏置保证无风时仍有缓慢移动
          const drift = gust * 0.55 + particle.driftBias

          particle.x += drift * dt
          particle.phase += particle.bobFreq * dt
          particle.y += Math.sin(particle.phase) * particle.bobAmp * dt

          const margin = particle.radius * 2.4

          if (particle.x > this.width + margin) particle.x = -margin
          else if (particle.x < -margin) particle.x = this.width + margin
          break
        }
        case "deco": {
          const fallSpeed = this.height * 0.055 * (0.7 + particle.size / 9)

          particle.phase += particle.swayFreq * dt
          particle.x += (gust * 0.6 + Math.sin(particle.phase) * particle.swayAmp) * dt
          particle.y += fallSpeed * dt
          particle.angle += particle.spin * dt

          if (particle.y > this.height + 20)
            Object.assign(particle, this.createDecoParticle(particle.shape), { y: -20 })
          else if (particle.x < -60) particle.x = this.width + 40
          else if (particle.x > this.width + 60) particle.x = -40
          break
        }
      }
    }

    if (effect === "thunderstorm") this.updateLightning(dt, intensity)
    else this.flash = Math.max(0, this.flash - dt * 3)
  }

  /** 雷雨：定时触发闪电 */
  private updateLightning(dt: number, intensity: number): void {
    this.lightningTimer -= dt * (0.6 + intensity)

    if (this.lightningTimer <= 0) {
      this.lightningTimer = 5 + Math.random() * 11
      this.flash = 0.55 + Math.random() * 0.4
      this.boltTimer = 0.18
      this.bolt = this.createBolt()
    }

    if (this.boltTimer > 0) {
      this.boltTimer -= dt
      this.flash = Math.max(this.flash, 0.3)
    } else {
      this.flash = Math.max(0, this.flash - dt * 2.2)
    }
  }

  /** 生成一条锯齿状闪电路径 */
  private createBolt(): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = []
    let x = this.width * (0.2 + Math.random() * 0.6)
    let y = -10

    points.push({ x, y })

    const segments = 9 + Math.floor(Math.random() * 6)
    const endY = this.height * (0.35 + Math.random() * 0.4)

    for (let i = 0; i < segments; i++) {
      y = -10 + ((endY + 10) * (i + 1)) / segments
      x += (Math.random() - 0.5) * this.width * 0.09
      points.push({ x, y })
    }

    return points
  }

  private render(): void {
    const ctx = this.ctx
    const effect = this.effect

    ctx.clearRect(0, 0, this.width, this.height)

    // 装饰粒子画在天气粒子下方
    for (const particle of this.particles)
      if (particle.kind === "deco") this.drawDeco(particle)

    if (effect === "rain" || effect === "thunderstorm") this.drawRain()
    else if (effect === "snow") this.drawSnow()
    else if (effect === "fog") this.drawFog()
    else if (effect === "cloudy" || effect === "overcast") this.drawCloud()

    if (effect === "thunderstorm") this.drawLightning()
  }

  private drawRain(): void {
    const ctx = this.ctx
    const gust = this.gustSpeed
    const fallSpeed = this.height * 1.5
    const intensity = this.weather?.intensity ?? 0.6

    // 雨丝方向 = 速度向量（下落 + 风偏移）
    const length = Math.hypot(gust, fallSpeed) || 1
    const ux = gust / length
    const uy = fallSpeed / length

    ctx.lineCap = "round"

    for (const particle of this.particles) {
      if (particle.kind !== "rain") continue

      const streak = particle.streak * (0.6 + intensity * 0.8)

      ctx.strokeStyle = `rgba(174, 200, 235, ${particle.alpha * (0.5 + intensity * 0.6)})`
      ctx.lineWidth = particle.size
      ctx.beginPath()
      ctx.moveTo(particle.x, particle.y)
      ctx.lineTo(
        particle.x - ux * streak * particle.fallFactor,
        particle.y - uy * streak * particle.fallFactor,
      )
      ctx.stroke()
    }
  }

  private drawSnow(): void {
    const ctx = this.ctx
    const intensity = this.weather?.intensity ?? 0.6

    for (const particle of this.particles) {
      if (particle.kind !== "snow") continue

      const alpha = particle.alpha * (0.55 + intensity * 0.5)

      // 纯白雪花在浅色背景上几乎看不见，
      // 所以先画一层冷灰底影，再叠上白色本体 —— 两种背景下都清晰
      ctx.fillStyle = `rgba(104, 128, 165, ${alpha * 0.5})`
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, particle.size + 0.7, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private drawFog(): void {
    const ctx = this.ctx
    const intensity = this.weather?.intensity ?? 0.6

    // 整体雾气
    ctx.fillStyle = `rgba(214, 222, 232, ${0.1 + intensity * 0.16})`
    ctx.fillRect(0, 0, this.width, this.height)

    for (const particle of this.particles) {
      if (particle.kind !== "fog") continue

      const radius = particle.radius
      const gradient = ctx.createRadialGradient(
        particle.x,
        particle.y,
        0,
        particle.x,
        particle.y,
        radius,
      )

      gradient.addColorStop(0, `rgba(236, 241, 247, ${particle.alpha * 2.2})`)
      gradient.addColorStop(1, "rgba(236, 241, 247, 0)")

      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private drawCloud(): void {
    const ctx = this.ctx
    const intensity = this.weather?.intensity ?? 0.5
    const overcast = this.effect === "overcast"
    const isDark = this.isDarkTheme

    // 云层配色随主题切换：浅色主题用冷灰蓝云，暗色主题用浅灰云
    const cloudColor = overcast
      ? isDark
        ? [150, 162, 182]
        : [124, 136, 158]
      : isDark
        ? [196, 208, 226]
        : [172, 188, 212]

    const rgb = cloudColor.join(", ")

    // 阴天：只把「天空」压暗（画面顶部），正文区域留亮，保证可读性
    if (overcast) {
      const ceiling = ctx.createLinearGradient(0, 0, 0, this.height * 0.4)
      const ceilingAlpha = 0.12 + intensity * 0.09

      ceiling.addColorStop(0, `rgba(${rgb}, ${ceilingAlpha})`)
      ceiling.addColorStop(0.55, `rgba(${rgb}, ${ceilingAlpha * 0.42})`)
      ceiling.addColorStop(1, `rgba(${rgb}, 0)`)

      ctx.fillStyle = ceiling
      ctx.fillRect(0, 0, this.width, this.height * 0.4)

      // 整屏只留一层很淡的压暗，用于传达阴沉基调
      ctx.fillStyle = isDark
        ? `rgba(56, 64, 82, ${0.05 + intensity * 0.05})`
        : `rgba(96, 106, 124, ${0.03 + intensity * 0.035})`
      ctx.fillRect(0, 0, this.width, this.height)
    }

    for (const particle of this.particles) {
      if (particle.kind !== "cloud") continue

      const alpha = particle.alpha * (0.7 + intensity * 0.4)

      ctx.save()
      ctx.translate(particle.x, particle.y)

      for (const puff of particle.puffs) {
        const gradient = ctx.createRadialGradient(
          puff.dx,
          puff.dy,
          0,
          puff.dx,
          puff.dy,
          puff.r,
        )

        // 收得快的渐变 ⇒ 边缘虚化得更彻底，云不会糊成一大片挡住正文
        gradient.addColorStop(0, `rgba(${rgb}, ${alpha})`)
        gradient.addColorStop(0.4, `rgba(${rgb}, ${alpha * 0.5})`)
        gradient.addColorStop(1, `rgba(${rgb}, 0)`)

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(puff.dx, puff.dy, puff.r, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()
    }
  }

  private drawDeco(particle: DecoParticle): void {
    const ctx = this.ctx

    ctx.save()
    ctx.translate(particle.x, particle.y)
    ctx.rotate(particle.angle)
    ctx.fillStyle = particle.color
    ctx.globalAlpha = particle.alpha
    ctx.beginPath()

    if (particle.shape === "petal") {
      // 花瓣：椭圆
      ctx.ellipse(0, 0, particle.size, particle.size * 0.55, 0, 0, Math.PI * 2)
    } else {
      // 落叶：两段贝塞尔构成的叶形
      const w = particle.size
      const h = particle.size * 1.8

      ctx.moveTo(0, -h / 2)
      ctx.quadraticCurveTo(w, 0, 0, h / 2)
      ctx.quadraticCurveTo(-w, 0, 0, -h / 2)
    }

    ctx.fill()
    ctx.restore()
    ctx.globalAlpha = 1
  }

  private drawLightning(): void {
    const ctx = this.ctx

    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(226, 236, 255, ${Math.min(0.55, this.flash)})`
      ctx.fillRect(0, 0, this.width, this.height)
    }

    if (this.boltTimer > 0 && this.bolt.length > 1) {
      ctx.save()
      ctx.strokeStyle = "rgba(255, 255, 255, 0.92)"
      ctx.lineWidth = 2
      ctx.shadowColor = "rgba(160, 200, 255, 0.9)"
      ctx.shadowBlur = 14
      ctx.beginPath()
      ctx.moveTo(this.bolt[0].x, this.bolt[0].y)

      for (let i = 1; i < this.bolt.length; i++)
        ctx.lineTo(this.bolt[i].x, this.bolt[i].y)

      ctx.stroke()
      ctx.restore()
    }
  }
}
