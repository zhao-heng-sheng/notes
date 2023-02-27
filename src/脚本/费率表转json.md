# 保司费率表转json

## 准备依赖

要转换费率表，需要要用到node-xlsx这个依赖。node-xlsx可以把表格解析成数组格式的数据/把数组转换成表格，这样我们就可以对费率表里的数据进行处理与转换了。

如果你是第一次使用的话，可以新建个文件夹,执行

```
npm i node-xlsx
```

由于我们只做一个脚本文件，不用去使用npm init初始化一个项目。

执行之后就会生成package.json描述文件和放依赖的node_modules文件夹

再建一个对应产品的文件夹，放入需要转换的表格和下一步要编写的脚本。目录结构如下

![image-20230224111158081](http://os.zhaohs.cn/markdown/image-20230224111158081.png)

## 编写脚本

以守护者长期意外保障计划（[运营系统 (99bx.cn)](https://testopr.99bx.cn/#!/product/product/63f31cf326004a42c74e1df3/update)）为例，写一个转换脚本。

### 引入node-xlsx，查看解析后内容

node-xlsx的api可以参考[mgcrea/node-xlsx: NodeJS excel file parser & builder (github.com)](https://github.com/mgcrea/node-xlsx)，我们这里只需要用到两个api

```js
xlsx.parse("excel文件路径") //解析excel文件
xlsx.build({name:strign,data:Array|JSON})  //将数组或json转换为excel
```

介绍完api，我们引入一下node-xlsx,读取excel文件

```js
// 引入node-xlsx
const xlsx = require("node-xlsx")
// 读取excel文件
let rateXlsx = xlsx.parse("./人保寿险守护者长期意外伤害保险（互联网专属）费率表(1).xlsx")
console.log(rateXlsx)
```

上面代码运行看一下解析出来的内容

![image-20230224143934395](http://os.zhaohs.cn/markdown/image-20230224143934395.png)

可以看到，解析出来是一个数组，里面是一个对象，每个对象对应着一个工作表；name是表名，data就是表里的数据

接下来再看data，data又是个数组，我们可以打印一下他的长度

```js
console.log(rateXlsx[0].data.length) //64
```

打印出来data的长度是64，和表格里面的行数是一样的，说明data里的每一个数组都是表里的一行数据；

![image-20230224145044291](http://os.zhaohs.cn/markdown/image-20230224145044291.png)

接下来再看data里部分具体的数据

![image-20230224145407229](http://os.zhaohs.cn/markdown/image-20230224145407229.png)

可以看到

1. 第一个数组就是第一行表格的数据，第二个就是第二行。。。

2. 合并的单元格只有第一个单元格有具体值，后面会保留长度，值为null

分析完表格的数据，再看一下需要转换成什么样子的数据

```js
[
  ["交费年期-chargeCode", "保险期间-termCode", "被保人年龄-insuredAge", "性别-	gender", "保障计划-planCode", ":", "费率/保费"],
  ['10','20','18','1','A',":",'9.9'],
  ...
]
```

我们需要转换成这种一个保费对应一个条件的扁平化数据。

那么只要循环遍历所有保费，一个保费生成一个对应条件的数据的数组，就算转换完成了。

### 遍历前准备

遍历之前要先做几个把对应数据转换成code的函数（过滤器），在遍历时使用

```js
//交费年期是 10年交、20年交这种格式，把前面数字转换成数字再转成字符串就行了
let getChargeCode = (str) => {
    return parseInt(str) + ""
}
//保险期间是 20年  至70周岁 这种数据，判断能不能转成数字，能就直接转；不能就是至xx年，取从一个字后面开始转
let getTermCode = (str) => {
    str = str.split("保")[str.split("保").length - 1]
    if (isNaN(parseInt(str))) return parseInt(str.slice(1)) + "y"
    return parseInt(str) + ""
}
//性别
let getGenderCode = (str) => {
    return str === "男性" ? "1" : "2"
}
//计划
let getPlanCode = (str) => {
    let planMap = {
        "基本部分（每万元基本保险金额）": "A",
        "基本+可选1（每万元基本保险金额）": "B",
        "基本+可选2（每万元基本保险金额）": "C",
        "基本+可选1+可选2（每万元基本保险金额）": "D",
    }
    return planMap[str]
}
```

### 开始遍历

写一个函数去遍历

我们的任务是去**遍历保费**，顺便把对应的条件整理成一个数组。

这个表从第五行开始是保费内容，所以从第五行开始遍历，57行之后就没保费内容了，所以57行停止。

```js
/**
 *
 * @param {Array} rateArr  表格数据
 * @param {number} min  开始位置
 * @param {number} max  结束位置
 * @returns {array}
 */
let pushDate = function (rateArr, min, max) {
    min = min - 1
    let data = []
    //行循环
    for (let i = min; i < max; i++) {
        //列循环，第0列是年龄，第一列才是保费，所以从第一列开始遍历
        for (let j = 1; j < rateArr[i].length; j++) {
          	//判断保费有没有值 没有值不去push
            if (rateArr[i][j] && rateArr[i][j] != "-") {
              	//根据上面分析的要转换成的数据进行push
              	//交费期间是在第三行，保费列数正好和交费期间的列数对应
              	//保险期间是第一行，因为他是合并行的关系，和保费的列数有偏差，所以需要找一下对应列
              //其他同理，最后的保费判断一下有没有千分位，有的话去掉。
                data.push(
                  [
                  	 getChargeCode(rateArr[3][j]), 
                     getTermCode(rateArr[1][getIndex(1, j)]),
                     rateArr[i][0],
                     getGenderCode(rateArr[2][getIndex(2, j)]), 
                     getPlanCode(rateArr[0][getIndex(0, j)]),
                     ":", 
                     String(rateArr[i][j]).replace(",", "")
                  ]
                )
            }
        }
    }
    return data
}
let buildData = pushDate(rateXlsx, 5, 57)
/**
 *
 * @param {number} row  所需数据在第几行
 * @param {number} col  当前遍历到第几列
 * @returns {number}
 */
let getIndex = (row, col) => {
    for (; col >= 0; col--) {
        //不为null即为合并行的数据
        if (rateXlsx[row][col]) return col
    }
}
```

要注意因为合并行的关系，需要向前找合并行的首个单元格，find只能向后找，所以需要自己写个函数遍历一下。

### 导出表格

遍历完成之后，我们的数据就有了，最后要做的就是把数据导出成表格。

使用node-xlsx的build方法，转换成buffer数据

使用nodejs原生的fs方法，保存成文件。

```js
buildData.unshift(["交费年期-chargeCode", "保险期间-termCode", "被保人年龄-insuredAge", "性别-gender", "保障计划-planCode", ":", "费率/保费"])
var buffer = xlsx.build([{ name: "table1", data: buildData }])
var filePath = "./newXlsx.xlsx"
fs.writeFileSync(filePath, buffer, { flag: "w" })
```

### 最后附上全部代码

```js
"use strict"
const fs = require("fs")
// 引入node-xlsx
const xlsx = require("node-xlsx")
// 读取excel文件
let rateXlsx = xlsx.parse("./人保寿险守护者长期意外伤害保险（互联网专属）费率表(1).xlsx")[0].data

let getChargeCode = (str) => {
    return parseInt(str) + ""
}
let getTermCode = (str) => {
    str = str.split("保")[str.split("保").length - 1]
    if (isNaN(parseInt(str))) return parseInt(str.slice(1)) + "y"
    return parseInt(str) + ""
}
let getGenderCode = (str) => {
    return str === "男性" ? "1" : "2"
}
let getPlanCode = (str) => {
    let planMap = {
        "基本部分（每万元基本保险金额）": "A",
        "基本+可选1（每万元基本保险金额）": "B",
        "基本+可选2（每万元基本保险金额）": "C",
        "基本+可选1+可选2（每万元基本保险金额）": "D",
    }
    return planMap[str]
}
/**
 *
 * @param {number} row  所需数据在第几行
 * @param {number} col  当前遍历到第几列
 * @returns {number}
 */
let getIndex = (row, col) => {
    for (; col >= 0; col--) {
        //不为null即为合并行的数据
        if (rateXlsx[row][col]) return col
    }
}
/**
 *
 * @param {Array} rateArr  表格数据
 * @param {number} min  开始位置
 * @param {number} max  结束位置
 * @returns {array}
 */
let pushDate = function (rateArr, min, max) {
    min = min - 1
    let data = []
    for (let i = min; i < max; i++) {
        //行循环
        for (let j = 1; j < rateArr[i].length; j++) {
            //列循环
            if (rateArr[i][j] && rateArr[i][j] != "-") {
                data.push([getChargeCode(rateArr[3][j]), getTermCode(rateArr[1][getIndex(1, j)]), rateArr[i][0], getGenderCode(rateArr[2][getIndex(2, j)]), getPlanCode(rateArr[0][getIndex(0, j)]), ":", String(rateArr[i][j]).replace(",", "")])
            }
        }
    }
    return data
}

let buildData = pushDate(rateXlsx, 5, 57)
buildData.unshift(["交费年期-chargeCode", "保险期间-termCode", "被保人年龄-insuredAge", "性别-gender", "保障计划-planCode", ":", "费率/保费"])

var buffer = xlsx.build([{ name: "table1", data: buildData }])
var filePath = "./newXlsx.xlsx"
fs.writeFileSync(filePath, buffer, { flag: "w" })
```

### 转json

对于转json的需求，只要把pushDate方法里的data改成对象，对应条件写为键名，值为保费就可以了。

例：{

​	'chargeCode_10|termCode_10|insuredAge_18|gender_1|planCode_A':'9.9'

}
