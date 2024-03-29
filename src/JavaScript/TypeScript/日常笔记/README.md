---
dir: {collapsible: false,text: '日常笔记',order: -1}
---
# 装饰器

本质是个入参提前确定好的函数，只能在class中使用。

## 类装饰器

直接作用在类上的装饰器。执行时的入参只有一个，就是这个类本身。因此可以通过类装饰器覆盖类的属性和方法

```typescript
const OverrideBar = (target: any) => {
    return class extends target {
        print() {}
        overridedPrint() {
            console.log("This is Overrided Bar!");
        }
    };
};

@OverrideBar
class Bar {
    print() {
        console.log("This is Bar!");
    }
}

// 被覆盖了，现在是一个空方法
new Bar().print();

// This is Overrided Bar!
(<any>new Bar()).overridedPrint();
```

## 方法装饰器

方法装饰器的入参包括类的原型、方法名和方法的属性描述符，通过属性描述符可以控制这个方法的内部实现、可变性等信息。

```typescript
class Foo {
    @ComputeProfiler()
    async fetch() {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve("RES");
            }, 3000);
        });
    }
}

function ComputeProfiler(): MethodDecorator {
   //原型、方法名、属性描述符
    return (_target, methodIdentifier, descriptor: TypedPropertyDescriptor<any>) => {
        console.log(_target,methodIdentifier,descriptor)
        const originalMethodImpl = descriptor.value!;
        descriptor.value = async function (...args: unknown[]) {
            const start = new Date();
            const res = await originalMethodImpl.apply(this, args); // 执行原本的逻辑
            const end = new Date();
            console.log(`${String(methodIdentifier)} Time: `, end.getTime() - start.getTime());
            return res;
        };
    };
}

(async () => {
    console.log(await new Foo().fetch());
})();
```

## 访问符装饰器

其实就是get value()和set value(v)=>{}这样的方法，getter在你访问属性value时触发，setter在你对value进行赋值时触发。

访问符装饰器本质上仍然是方法装饰器，使用的类型定义也相同

访问符装饰器只能同时应用在一对getter/setter的其中一个。因为无论装饰那一个，装饰器入参中的属性描述符都包括getter和setter方法。

## 属性装饰器

属性装饰器在独立使用时能力非常有限，它的入参只有类的原型和属性名，返回值会被忽略，但是仍然可以通过直接在类的原型上赋值来修改属性

```typescript
class Foo {
    @ModifyNickName()
    nickName!: string;
    constructor() {}
}

function ModifyNickName(): PropertyDecorator {
    return (target: any, propertyIdentifier) => {
        console.log(target, propertyIdentifier)
        target[propertyIdentifier] = "林不渡!";
        target["otherName"] = "别名林不渡!";
    };
}
console.log(new Foo())
console.log(new Foo().nickName);
// @ts-expect-error
console.log(new Foo().otherName);
```

## 参数装饰器

包括了构造函数的参数装饰器和方法的参数装饰器，入参包括类的原型、参数所在的方法名和参数在函数参数中的索引值。如果单独使用，作用同样有限。
