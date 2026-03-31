#!/bin/bash

# 1. 이동
cd "$(dirname "$0")/web" || exit

echo "🚀 배포를 시작합니다..."

# 2. 의존성 설치
echo "📦 의존성 설치 중..."
npm install

# 3. 배포 (환경 변수 자동 포함)
echo "☁️ Cloudflare 배포 중..."
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
  echo "❌ 오류: CLOUDFLARE_API_TOKEN 환경 변수가 설정되지 않았습니다."
  exit 1
fi
npm run deploy

echo "✅ 배포가 완료되었습니다! 브라우저에서 확인해 주세요."
