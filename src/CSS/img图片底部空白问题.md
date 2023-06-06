# img图片底部空白问题

## 原因

图片是内联元素，默认带有一定的间距，间距与文字字体有一定的关系。

## 解决方式

1. `display:block;`  把图片变成区块元素 
2. `vertical-align:middle;` 给内联元素的图片加垂直对齐方式



> [【必看】HTML+CSS去掉img图片底部的空白的3种通用方法_Java全栈开发架构师的博客-CSDN博客](https://blog.csdn.net/SubStar/article/details/103761808)