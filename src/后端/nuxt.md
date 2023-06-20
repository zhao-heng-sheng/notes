# nuxt

## ioc

controller：接收http请求，调用service，返回响应

service:实现业务逻辑

repository:实现对数据库的增删改查

dao?:数据库模型？

dataSource:数据库链接对象

config：配置对象

Controller 依赖了 Service 实现业务逻辑，Service 依赖了 Repository 来做增删改查，Repository 依赖 DataSource 来建立连接，DataSource 又需要从 Config 对象拿到用户名密码等信息。

