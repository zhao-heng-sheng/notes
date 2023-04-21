---
dir: {collapsible: false,text: '日常笔记',order: -1}
---
# 组件传值

### 父传子

props

### 祖传后代(依赖注入)

祖：`provide('name',value)`

后代：`inject('name')`  如需默认值： `inject('name',默认值)`

vue3注入的数据如果是ref对象，默认是具有响应式的。vue2需用计算属性让其具有响应式

如需更改数据，建议提供更改数据的函数

```js
//祖
let data = ref('data')
let updateData = (val)=>{data.value = val}
provide('name',{
 data,
  updateData
})
```

```js
//后代
let {data,updateData} = inject('name')
updateData('xxx')
```

如果不让修改，使用`readonly()`包装

```js
let count = ref(0)
provide('read-only-count', readonly(count))
```
