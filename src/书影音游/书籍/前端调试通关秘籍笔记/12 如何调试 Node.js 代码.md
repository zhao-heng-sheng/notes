用 node --inspect(检查) 或 node --inspect(检查)-brk 以调试模式跑 node 脚本，然后用调试的 UI 连接上这个调试服务就可以进行调试了。

在 VSCode Debugger 里调试 node 代码还可以边调试边修改，更方便。

除了自己启动 node 调试服务，然后手动 attach(附加) 外，还可以选择 launch(推出) 类型的调试配置，自动进行这个过程。

node 调试的协议也是用的 Chrome DevTools Protocol(协议)，就是为了能够复用 Chrome DevTools 的 UI 的，中间还有一段历史是用 node inspector(督察) 做中转。