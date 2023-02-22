# call和bind的实现

## this

在实现call和bind之前，要明确一下this的指向问题。this指向取决于函数的调用方式，一般情况下有四种调用场景。
1. 在new中调用，this绑定的是新创建的对象
2. 通过call/apply/bind调用，this绑定的是指定对象
3. 在上下文对象中调用，this绑定的是上下文对象（也就是常说的 谁.fn()，谁就是fn执行时this指向的对象）
4. 直接调用，this严格模式下是undefined，非严格模式下绑定window

箭头函数是个例外，他是根据作用域来决定this指向的，而且无法被修改。

## call

call的作用是临时改变this的指向并执行函数

所以利用上述this的第3种场景，**让函数在指定对象的上下文中被调用**。这样this就会指向指定的对象，从而就实现了call

那么怎么才能**让函数在指定对象的上下文中被调用**呢？把函数存到指定对象里面就可以去调用了。

```js
//call接受1个指定对象和多个参数
Function.prototype.myCall = function (context, ...args) {
  	//传入的是null或undefined 指向全局
  	if(context===null||context===undefined) context = window
  	//如果传入的是原始类型值就包装一下
    if (!(context instanceof Object)) context = new Object(context)
    //创建一个唯一的key，防止覆盖对象里的数据
    let soleKey = Symbol()
    //把要调用的函数存到指定对象中
    context[soleKey] = this
    //在指定上下文对象中调用，this指向了context
    let res = context[soleKey](...args)
    //调用后删除存入的函数
    delete context[soleKey]
    //返回调用函数的返回值
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
//myCall的上下文对象是fun
fun.myCall(obj, 1, 2, 3)//this {name: '铛铛', age: 18, Symbol(): ƒ}   args 1 2 3
```

如上代码，call就被实现出来了。其核心代码只有这三句

```js
let soleKey = Symbol()
context[soleKey] = this
let res = context[soleKey](...args)
```

## bind

说完了call，那么bind怎么去实现呢？

bind的作用是返回一个this永久绑定到指定对象的函数。

那么我们是不是只要返回一个用call改变this之后的函数就可以了？

