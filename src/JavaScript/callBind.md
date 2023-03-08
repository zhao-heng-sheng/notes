---
category:
    - JavaScript
tag:
    - call
    - bind
---
# call和bind的实现

## this指向

在实现call和bind之前，要明确一下this的指向问题。this指向取决于函数的调用方式，一般情况下有四种调用场景。
1. 直接调用，this严格模式下是undefined，非严格模式下绑定window
2. 被一个引用类型调用，this绑定的就是所引用的对象（比如：obj.fn()指向obj、arr\[0]()指向arr）
3. 通过call/apply/bind调用，this绑定的是指定对象
4. 在new中调用，this绑定的是新创建的对象

以上这些指向只是根据现象来说的，this指向的原理可以看大佬的文章：[JavaScript深入之从ECMAScript规范解读this · Issue #7 · mqyqingfeng/Blog (github.com)](https://github.com/mqyqingfeng/Blog/issues/7)

箭头函数是个例外，他本身没有this，在里面使用this是根据作用域链向上查找上级作用域里的this。

## call

call的作用是临时改变this的指向并执行函数

所以可以利用上述this的第2种场景

1. 把要调用的函数添加到指定对象中

2. 用第2种场景去调用

3. 删除添加的方法

这样this调用时就会指向指定的对象，从而就实现了call

```js
//call接受1个指定对象和多个参数
Function.prototype.myCall = function (context, ...args) {
  	//传入的是null或undefined 指向全局
  	if(context===null||context===undefined) context = window
  	//如果传入的是原始类型值就包装一下
    if (!(context instanceof Object)) context = new Object(context)
    //创建一个唯一的key，防止覆盖对象里的数据
    let soleKey = Symbol()
    //把要调用的函数添加到指定对象中
    context[soleKey] = this
    //被context调用，this指向了context
    let res = context[soleKey](...args)
    //调用后删除存入的方法
    delete context[soleKey]
    //返回函数的返回值
    return res
}
let fun = function (a, b, c) {
    console.log("this", this)
    console.log("args", a, b, c)
}

let name = "叮叮",
    age = 20

let obj = {
    name: "铛铛",
    age: 18,
}
//myCall被fun调用  所以里面的this就是fun
//和call表现不同的是：myCall调用时obj多了fun方法，我们是在调用后删除的，不过应该不会有什么影响
fun.myCall(obj, 1, 2, 3)//this {name: '铛铛', age: 18, Symbol(): ƒ}   args 1 2 3
```

如上代码，call就被实现出来了。其核心代码只有这三句

```js
let soleKey = Symbol()
context[soleKey] = this
let res = context[soleKey](...args)
```

## bind

bind的作用是创建一个新函数，当这个新函数被调用时，bind() 的第一个参数将作为它运行时的 this，之后的一序列参数将会在传递的实参前传入作为它的参数

那么要做的就是

1. 返回一个函数
2. 在返回的函数里面绑定bind传来的context
3. 传参处理

```js
Function.prototype.myBind = function (context，...args1) { 
  // 使用了myBind里的context、args1、this，形成了闭包
  return (...args2) => {
        return this.call(context,...args1,...args2)
    }
}
let fun = function (a, b, c) {
    console.log("this", this)
    console.log("args", a, b, c)
}
let obj1 = {
    name: "叮叮",
    age: 18,
}
let obj2 = {
    name: "铛铛",
    age: 23,
}
let fn = fun.myBind(obj1,1,2)
fn(3)   //this {name: '叮叮', age: 18}   args 1 2 3
fn.call(obj2,4,5,6) //this {name: '叮叮', age: 18}   args 1 2 4
```

这样会有两个问题，返回的函数有可能是要去做构造函数去使用的，但是箭头函数不能作为构造函数使用

第二是

其实this是有优先级的

new Fn() > fn.call/apply/bind() > obj.fn() > fn()

如果返回的函数作为构造函数去new实例对象的话，this指向是不会变到new出来的新对象的。

所以需要

1. 把构造函数改为普通函数，myBind的this用一个变量去接传给普通函数
2. 如果是new调用，让他指向正确的this



