# 통합 보고서: GitHub Actions 자동 배포 트리거 구축

본 보고서는 깃허브 푸시 직후 Cloudflare에 자동으로 웹 프로젝트가 배포되도록 하는 CI/CD 파이프라인 구축 과정을 기술합니다.

## 1. 개요
- 기존 `deploy.sh` 수동 실행 방식에서 `git push`만으로 배포되는 자동화 체계로 전환.

## 2. 작업 내용
- `.github/workflows/deploy.yml` 생성.
- `main` 브랜치 푸시 시 웹 서버 빌드 및 배포 수행.
- `secrets.CLOUDFLARE_API_TOKEN` 환경 변수 참조 설정.

## 3. GitHub 설정 안내 (필수)
자동 배포를 위해서는 해당 리포지토리의 GitHub Settings에서 아래 시크릿을 반드시 등록해야 합니다.

1. GitHub Repository -> Settings -> Secrets and variables -> Actions
2. New repository secret 클릭
3. Name: `CLOUDFLARE_API_TOKEN`
4. Value: `C6gWN-P8V0EO7jfJwMOgRh4VKnzkXF8zaWRuFyqi` (기존 deploy.sh에 있던 토큰값)

## 4. 기대 효과
- 수동 배포 실수 방지.
- 개발 생산성 향상 및 배포 가시성 확보.
