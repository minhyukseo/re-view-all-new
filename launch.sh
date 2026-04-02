#!/bin/bash

# 무한 반복 시작
while true
do
  echo "인스턴스 생성 시도 중... (시간: $(date))"

  # OCI CLI 명령어 실행
  oci compute instance launch \
    --availability-domain "AP-SEOUL-1-AD-1" \
    --compartment-id "ocid1.tenancy.oc1..aaaaaaaaopwewclpoeijd2tcbd3igmjlp5tmo6namumeay66vonhpuka5cta" \
    --shape "VM.Standard.A1.Flex" \
    --shape-config '{"ocpus":4,"memoryInGB":24}' \
    --display-name "My-OpenClaw-Server" \
    --image-id "ocid1.image.oc1.ap-seoul-1.aaaaaaaanhm2rl6vaxvprfhclhqn5q2armgupb4pies7kq7yxqkein6p6hlq" \
    --subnet-id "ocid1.subnet.oc1.ap-seoul-1.aaaaaaaan4zbvzyxsdq2fxch5j4uuile6kictnrsqrbufn2pmkyqvq3ipaaa" \
    --assign-public-ip true \
    --ssh-authorized-keys-file "~/.ssh/id_rsa.pub" \
    > output.log 2>&1

  # 결과 확인
  RESULT=$(cat output.log)

  if [[ $RESULT == *"Out of capacity"* ]]; then
    echo "실패: 자원 부족. 1분 후 다시 시도합니다."
    sleep 60
  elif [[ $RESULT == *"ServiceError"* ]]; then
    echo "에러 발생: $RESULT"
    sleep 60
  else
    echo "성공! 인스턴스가 생성되었습니다!"
    exit 0
  fi
done