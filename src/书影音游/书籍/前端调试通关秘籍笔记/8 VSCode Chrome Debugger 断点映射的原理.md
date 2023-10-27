在本地文件打的断点会通过 CDP 传给 Chrome，如果路径和 sourcemap 到的文件匹配，那断点就能生效。

如果不匹配，可以设置下 sourceMapPathOverrides 做下映射。

如果前面多了一段路径，可以配置下 webRoot。

在 vite 项目里，热更文件也会在本地文件打断点的那行断住，为了避免这种情况，我们配了下 webRoot。

理解了 VSCode Chrome Debugger 断点映射的原理，就能解释为什么有时候断点没生效，有时候断点断在奇怪的位置了。