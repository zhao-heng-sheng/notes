# Airbnb JavaScript 风格指南摘录

### 对象浅拷贝

对象浅拷贝时，更推荐使用扩展运算符（即`...`运算符），而不是`Object.assign`。获取对象指定的几个属性时，用对象的 rest 解构运算符（即 `...`运算符）更好。eslint:`prefer-object-spread`这一段不太好翻译出来， 大家看下面的例子就懂了。^.^

```
// very bad
const original = { a: 1, b: 2 };
const copy = Object.assign(original, { c: 3 }); // 改了 `original` ಠ_ಠ
delete copy.a; // so does this

// bad
const original = { a: 1, b: 2 };
const copy = Object.assign({}, original, { c: 3 }); // copy => { a: 1, b: 2, c: 3 }

// good es6 扩展运算符 ...
const original = { a: 1, b: 2 };
// 浅拷贝
const copy = { ...original, c: 3 }; // copy => { a: 1, b: 2, c: 3 }

// rest 解构运算符
const { a, ...noA } = copy; // noA => { b: 2, c: 3 }
```

![image-20230530112901476](http://os.zhaohs.cn/markdown/202305301129059.png)



> 原文：[lin-123/javascript: eslint-config-airbnb 中文版 (github.com)](https://github.com/lin-123/javascript)