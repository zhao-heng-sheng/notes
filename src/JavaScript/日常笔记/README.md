---
dir: {collapsible: false,text: '日常笔记',order: -1}
---
# 线程、事件循环

## 浏览器的线程

### 1. 渲染线程（GUI渲染线程）

#### 作用

渲染浏览器界面，当界面需要重绘（Repaint）或由某种操作引发回流（reflow）时，该线程会执行

渲染线程和js线程是互斥的，js引擎执行时渲染线程会被挂起，gui更新会被保存在一个队列中等到js引擎空闲时立即被执行

#### 渲染线程工作流程

1. 解析html（parse）
2. 样式计算(style)
3. 布局（layout）
4. 分层(layer)
5. 绘制（生成绘制指令）(paint)
6. 分块(tiling)
7. 光栅化(raster)
8. 呈现(draw)

![Image](http://os.zhaohs.cn/markdown/Image.png)

####

1. js引擎线程
2. 事件触发线程
3. 定时器线程
4. 异步http请求线程
