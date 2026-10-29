import { viteBundler } from "@vuepress/bundler-vite"
import { defineUserConfig } from "vuepress"
import theme from "./theme.js"

export default defineUserConfig({
    // 站点根路径。GitHub Pages 部署在 /notes/ 子路径下时，
    // 由构建环境变量 DOCS_BASE 传入；本地构建保持 "/"
    base: process.env.DOCS_BASE || "/",

    // vuepress v2 rc 起 bundler 不再内置，需要显式声明
    bundler: viteBundler(),

    head: [
        [
            "script",
            {},
            // 在首屏渲染前写好季节，避免主题色闪烁
            `(function(){try{var s=localStorage.getItem("zhs-notes:season");var m=new Date().getMonth()+1;var a=(m>=3&&m<=5)?"spring":(m>=6&&m<=8)?"summer":(m>=9&&m<=11)?"autumn":"winter";if(s&&s!=="auto"&&["spring","summer","autumn","winter"].indexOf(s)>-1)a=s;document.documentElement.setAttribute("data-season",a);}catch(e){}})();`,
        ],
    ],

    locales: {
        // "/": {
        //     lang: "en-US",
        //     title: "Blog Demo",
        //     description: "A blog demo for vuepress-theme-hope",
        // },
        "/": {
            lang: "zh-CN",
            title: "赵恒盛的笔记",
            description: "xxxxxxxxxx",
        },
    },

    theme,

    shouldPrefetch: false,
    plugins: [],
})
