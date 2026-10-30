# 수동 반영용 Worker 전체 코드

recovery44-upload.mjs는 사용자가 제공한 현재 배포본에서 파일명 생성 블록만 수정한 전체 코드입니다. Cloudflare Edit code에 붙여넣을 수 있습니다. 이 저장소에는 Worker 자동 배포 설정이 없으며 직접 배포하지 않았습니다.

- 기존 Worker URL, CORS, /uploads/, Secret 이름, 파일 검증과 Dropbox API 호출 유지
- Asia/Seoul 기준 RECOVERY44_YYYYMMDD_HHMMSS_XXXX.png
- XXXX: A–Z/0–9, 암호학적 난수 4자리, 편향 방지
- mode:add, autorename:true, mute:false 유지
- 프런트엔드 파일명과 확장자는 최종 파일명 생성에 사용하지 않음

로컬 검증: node tests/worker_filename_check.mjs. 실제 Worker/Dropbox에는 접속하지 않습니다. 기존 DROPBOX_ACCESS_TOKEN Secret은 그대로 두고 값은 코드에 붙여넣지 않습니다.
