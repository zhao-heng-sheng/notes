import { defineUserConfig } from "vuepress"
import theme from "./theme.js"

export default defineUserConfig({
    base: "/zh/",

    locales: {
        // "/": {
        //     lang: "en-US",
        //     title: "Blog Demo",
        //     description: "A blog demo for vuepress-theme-hope",
        // },
        "/zh/": {
            lang: "zh-CN",
            title: "赵恒盛的博客",
            description: "xxx",
        },
    },

    theme,

    shouldPrefetch: false,
})
