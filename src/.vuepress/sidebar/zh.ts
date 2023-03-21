import { sidebar } from "vuepress-theme-hope"

export const zhSidebar = sidebar({
    "/": [
        "",
        {
            text: "JavaScript",
            icon: "note",
            prefix: "JavaScript/",
            children: "structure",
        },
    ],
    "/JavaScript/": "structure",
    "/vue/": "structure",
    "/工具/": "structure",
})
