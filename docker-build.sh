# 构建与本地预览（可选路径）
#
# 注意：本机线上部署不走 Docker —— nginx 直接 alias dist/ 目录。
# 这里保留容器化方式，供在别的机器上独立托管时使用。
#
# 用法：
#   ./docker-build.sh            # 构建镜像
#   ./docker-build.sh --run      # 构建并启动容器（8081 端口）
set -euo pipefail

CONTAINER_NAME="kb-frontend"
IMAGE_NAME="kb-frontend"
HOST_PORT=8081

echo "📦 构建镜像 ${IMAGE_NAME}（base=/knowledge/）"
docker build -t "${IMAGE_NAME}" .

if [[ "${1:-}" == "--run" ]]; then
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  docker run -d \
    --name "${CONTAINER_NAME}" \
    -p "${HOST_PORT}:80" \
    -e KB_API_UPSTREAM=http://host.docker.internal:9999 \
    "${IMAGE_NAME}"
  echo "🚀 ${CONTAINER_NAME} → http://localhost:${HOST_PORT}/knowledge/"
else
  echo "✅ 构建完成（未启动容器，加 --run 启动）"
fi
