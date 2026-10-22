# 基础镜像
# vuepress-theme-hope v2 与 vuepress v2 rc 要求 node >= 20.19
FROM node:22-alpine

# 启用 pnpm，版本由 package.json 的 packageManager 字段决定
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# 设置项目目录
WORKDIR /app

# 先只拷贝依赖清单，最大化利用 Docker 层缓存
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 拷贝源码
COPY . .

# 启动开发服务器
EXPOSE 8080
CMD ["pnpm", "run", "start"]
