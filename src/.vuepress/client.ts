import { defineClientConfig } from "vuepress/client"
import WeatherWidget from "./components/WeatherWidget.vue"
import { weatherConfig } from "./weather.config.js"

export default defineClientConfig({
    // 天气 / 季节面板作为根组件挂载，全站常驻
    rootComponents: weatherConfig.enabled ? [WeatherWidget] : [],
})
