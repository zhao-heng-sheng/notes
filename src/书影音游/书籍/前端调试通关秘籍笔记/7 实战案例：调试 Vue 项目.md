vue 项目有两种创建方式，@vue/cli 和 create(创建) vue，分别是创建 webpack 和 vite 作为构建工具的项目。

vue cli 创建的项目，默认情况下打断点不生效，这是因为文件路径后带了 ?hash，这是默认的 eval-cheap(廉价)-module-source(源)-map 的 devtool 配置导致的，去掉 eval，改为 source(源)-map 即可。

create(创建) vue 创建的 vite 做为构建工具的项目 sourcemap 到的路径直接就是本地的路径了，更简单一些。但是会有一些文件被错误映射到源码的问题，需要设置下 webRoot。