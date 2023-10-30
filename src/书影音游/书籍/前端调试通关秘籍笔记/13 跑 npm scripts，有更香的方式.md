每个项目都有 npm scripts，大多数人只是用它们而不会调试它们，所以就算每天用也不知道这些工具的原理。

这些命令行工具都是在 package(包).json 中声明一个 bin(滨) 字段，然后 install 之后就会放到 node_modules/.bin(滨) 下。

可以 node node_modules/.bin(滨)/xx 来跑，可以 npx xx 来跑，最常用的还是 npm scripts，通过 npm run xx 来跑。

npm scripts 的调试就是 node 的调试，只不过 VSCode Debugger 做了简化，可以直接创建 npm 类型的调试配置。

把 console(控制台中) 配置为 integratedTerminal 之后，日志会输出到 terminal，和平时直接跑 npm run xx 就没区别了。而且还可以断点看看执行逻辑。

跑 npm scripts 之余，还可以理一下它的实现逻辑，哪里感兴趣断在哪里，这不比直接跑香么？