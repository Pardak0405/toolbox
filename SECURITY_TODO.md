[Headers/CSP]
- [x] next.config headers() 또는 middleware로 보안 헤더 적용
- [x] CSP 프로덕션 정책 설정(Adsense 도메인 화이트리스트)
- [x] HSTS 배포환경에서만 활성화

[XSS/Input Safety]
- [x] dangerouslySetInnerHTML 제거/금지
- [x] sanitizeText 적용(파일명/메타/OCR/쿼리/옵션)
- [x] sanitizeFilename 적용(다운로드 파일명/표시 파일명)
- [x] workflow/query 파라미터 zod 검증

[Resource/DoS]
- [x] 파일 크기 제한(soft/hard) + UX 경고
- [x] PDF 페이지 수 기반 제한/경고
- [x] OCR/WebWorker + AbortController 취소 구현
- [x] 대용량 처리 타임아웃/최대 페이지 제한

[Supply Chain]
- [x] audit 스크립트 추가(npm audit)
- [x] 핵심 라이브러리 버전 pinning 점검
- [x] (선택) CI audit step 추가

[Local Engine Security (if exists)]
- [x] CORS Origin whitelist
- [x] Pairing key 요구(X-Toolbox-Pairing-Key)
- [x] rate limit + size limit + timeout
- [x] 인증 없는 엔드포인트 제거/축소
- [x] 파일 경로 접근 기능 금지 검증
