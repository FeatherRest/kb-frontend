FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --registry=https://registry.npmjs.org
COPY . .
RUN npm run build

FROM nginx:alpine
# 与 vite base /knowledge/ 对齐
COPY --from=build /app/dist /usr/share/nginx/html/knowledge
COPY nginx.conf /etc/nginx/templates/default.conf.template
ENV KB_API_UPSTREAM=http://host.docker.internal:9999
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
