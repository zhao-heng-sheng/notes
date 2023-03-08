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

**`call()`** 方法使用一个指定的 `this` 值和单独给出的一个或多个参数来**调用**一个函数。

所以可以利用上述this的第2种场景去实现

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

**`bind()`** 方法**创建一个新的函数**，在 `bind()` 被调用时，这个**新函数的 `this` 被指定为 `bind()` 的第一个参数**，而**其余参数将作为新函数的参数**，供调用时使用。

我们要做的就是：

1. return一个新函数
2. 新函数里使用call改变this为bind的第一个参数
3. 传入bind的剩余参数与新函数的剩余参数并执行

```js
Function.prototype.myBind = function (context，...args1) { 
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

上述这样会有两个问题

1. 返回的函数有可能是要去做构造函数去使用的，但是箭头函数不能作为构造函数使用

2. this是有优先级的

   new Fn() > fn.call/apply/bind() > obj.fn() > fn()

   我们现在返回的函数作为构造函数去new实例对象的话，this指向是不会变到new出来的新对象的。原始bind方法this是正确的。

所以需要

1. 把箭头函数改为普通函数，myBind的this用一个变量去接传给普通函数
2. 如果是new调用，让他指向正确的this

箭头函数好改，但是怎么判断他是由new去调用的呢？

先来看看new做了什么：

1. 创建一个新对象
2. 新对象的隐式原型指向构造函数的原型对象
3. 新对象作为构造函数的this执行构造函数
4. 返回构造函数的返回值或者新对象

写个代码实现一下：

```js
let myNew = function(fun,...args){
    let obj = {}
    obj.__proto__ = fun.prototype
    let res = fun.call(obj,...args)
    return res || obj
}
```

可以看到：new在第二步把新对象原本指向Object的隐式原型改为了指向构造函数的原型对象

那么我们用 instanceof 去判断新对象的原型是不是return出去的函数就可以了

其次new出来的对象要使用

```js
Function.prototype.myBind = function (context, ...args1) {
    let _this = this;
    let fBound = function(...args2){
        return _this.call(this instanceof fBound ? this: context, ...args1, ...args2)
    }
    fBound.prototype = Object.create(this.prototype)
    return fBound
}
```

