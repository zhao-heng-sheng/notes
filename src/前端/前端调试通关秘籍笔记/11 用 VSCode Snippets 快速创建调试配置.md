![img](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/042e7e7665d64053810499e8feb8dd3c~tplv-k3u1fbpfcp-jj-mark:1512:0:0:0:q75.awebp)

- prefix(前缀) 就是这个 snippets 生效的前缀
- body 是插入的内容
- description(描述) 是描述
- scope(范围) 是指定 snippets 生效的语言

这个 snippets 的作用就是在这个项目目录下的 js、ts 文件里，输入 log 的时候会提示，选中之后就会插入 body 部分的内容。



- 指定光标位置：$x
- 多光标编辑： \$x  $x
- 指定 placeholder(占位符) 文本：${x:placeholder}
- 指定多选值：${x|aaa,bbb|}
- 取变量：$VariableName
- 对变量做转换：${VariableName/正则/替换的文本/}