#!/bin/bash
set -e

# .env 파일 로드
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "❌ Error: CLOUDFLARE_API_TOKEN 환경 변수가 설정되어 있지 않습니다. (.env 파일 확인)"
  exit 1
fi

echo "🚀 전체 배포 파이프라인 가동 (Server -> Edge -> Web)"

echo "1/3 📦 Backend Server 배포 중..."
npm run cf:api:deploy

echo "2/3 ☁️ Edge Worker 배포 중..."
npm run cf:edge:deploy

echo "3/3 🌐 Frontend Web 배포 중..."
cd web && npm install && npm run deploy

echo "✅ 모든 통합 배포 파이프라인 처리가 완료되었습니다!"
