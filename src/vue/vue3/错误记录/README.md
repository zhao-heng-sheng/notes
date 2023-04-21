---
dir: {collapsible: false,text: '错误记录',order: -1}
---
# reactive赋值问题

很多时候不知道对象里会有什么数据，初始值为{}

改变的时候再重新定义对象，响应式就会失效

这时候可以使用`ref`

或者在`reactive`下面定义一个属性去接收

例1：使用`ref`

```js
let obj = ref({})
obj.value = {a:zhangsan,b:lisi}
```

例2：`reactive`下面定义一个属性去接收

```js
let obj = reactive({data:{}})
obj.data = {a:zhangsan,b:lisi}
```

其实两者原理是一样的

因为**`ref`本质也是`reactive`，`ref(obj)`等价于`reactive({value: obj})`**
