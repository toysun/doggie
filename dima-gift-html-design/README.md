# DIMA GIFT 스탬프투어 HTML 디자인

첨부된 `dima-gift-stamptour-process(1).pdf`를 기준으로 구성한 모바일 HTML 디자인 프로토타입입니다.

## 포함 화면

- 스탬프투어 시작 및 캠퍼스 Zone 지도
- G / I / F / T Zone별 4지선다 퀴즈
- 정답·오답 및 스탬프 획득 팝업
- 4색 스탬프북
- GIFT 완주 화면
- 만족도 조사 1·2단계
- 참여자 정보 입력
- 개인정보 수집·이용 동의
- 모바일 상품권·수업협조문 최종 완료 팝업

포즈 선택, GPS, 카메라, 이미지 인식 화면과 관련 기기 API 코드는 포함하지 않았습니다. Zone 카드를 누르면 퀴즈 화면으로 바로 이동합니다.

## 실행

별도의 빌드 과정이나 외부 라이브러리가 없습니다.

```bash
python3 -m http.server 4173
```

브라우저에서 `http://localhost:4173`을 엽니다.

## 디자인 화면 바로 열기

검수할 화면을 쿼리로 직접 열 수 있습니다.

```text
/?screen=start
/?screen=quiz&zone=G
/?screen=quiz&zone=I
/?screen=quiz&zone=F
/?screen=quiz&zone=T
/?screen=stampbook
/?screen=complete
/?screen=survey1
/?screen=survey2
/?screen=participant
/?screen=privacy
/?screen=done
```

퀴즈에서 정답을 선택하면 획득 스탬프만 브라우저에 저장됩니다. 설문과 참여자 정보는 화면 전환을 위한 임시 상태일 뿐, 저장하거나 외부로 전송하지 않습니다.

## 파일 구성

- `index.html`: 모바일 앱 셸
- `styles.css`: 전체 디자인, 반응형·안전영역·접근성 스타일
- `app.js`: 화면 렌더링과 디자인 프로토타입 전환
- `assets/`: 키비주얼, 캠퍼스 지도, G·I·F·T 스탬프
- `tests/static.mjs`: 자산·문구·색상·제외 기능 검증

## 검사

```bash
npm test
```

실제 운영용 설문 제출, 개인정보 저장, 상품권 지급, 출석 확인 기능은 서버 연동 단계에서 별도로 구현해야 합니다.
