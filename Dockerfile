# 基础 image
FROM node:12.6.0-alpine

# 设置项目目录
WORKDIR /app

# 安装项目依赖
COPY package.json .
RUN npm install

# 运行
CMD ["npm", "run", "start"]