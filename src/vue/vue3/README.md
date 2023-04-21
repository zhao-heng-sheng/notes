---
dir: {collapsible: false,text: 'vue3',order: -1}
---
# 自定义hook获取route问题

在js中引入vue-router

```js
import { useRoute, useRouter } from "vue-router"
console.log(useRoute(),useRouter()) //undefined  undefined
```

useRoute/useRouter必须写到setup中，在js中使用是获取不到的，值为undefined

想要使用路由:

```js
import Vrouter from '@/router'
let router = Vrouter
let route = Vrouter.currentRoute.value
```

初始化route是没值的，如果需要有值后再执行代码需要进行监听：

```js
watch(()=>router.currentRoute.value,(newVal)=>{
    console.log(newVal)
})
```
