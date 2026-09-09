#!/usr/bin/env bash
set -euo pipefail

# Docker 构建脚本 — kb-frontend
# 使用 mihomo 代理加速 Docker Hub 下载

CONTAINER_NAME="kb-frontend"
IMAGE_NAME="kb-frontend"
HOST_PORT=8081

echo "📦 构建 Docker 镜像: ${IMAGE_NAME}"
echo ""

# 构建代理参数 (用于 build 阶段的 npm install)
BUILD_ARGS=(
  --build-arg HTTP_PROXY=http://host.docker.internal:7890
  --build-arg HTTPS_PROXY=http://host.docker.internal:7890
)

# 尝试 Docker 构建
docker build "${BUILD_ARGS[@]}" -t "${IMAGE_NAME}" .

echo ""
echo "✅ 构建成功!"

# 停止旧容器
docker rm -f "${CONTAINER_NAME}" 2>/dev/null || true

# 运行新容器
docker run -d \
  --name "${CONTAINER_NAME}" \
  -p "${HOST_PORT}:80" \
  -e VITE_KB_API=http://host.docker.internal:9999 \
  "${IMAGE_NAME}"

echo "🚀 ${CONTAINER_NAME} running at http://localhost:${HOST_PORT}/"
