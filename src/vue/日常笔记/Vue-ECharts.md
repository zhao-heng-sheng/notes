# Vue-ECharts

## 更新数据问题

更新数据时，一些数据就算变化了，视图也不会改变

解决方法：配置update-options项，notMerge设为true

```js
<v-chart
  class="chart"
  :update-options="{ notMerge: true }"
  :option="newPremiumStatistics.region"
  autoresize
/>
```



