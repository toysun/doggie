# 타이거 포즈 인증 퀘스트 (Tiger Pose Quest)

첨부해주신 넥슨 메이플아일랜드 "포즈 챌린지" 영상과 동일한 2단계 구조로 만든
Web AR 이미지 인식 게임입니다.

- **STEP 1 (포즈 인증)**: 카메라에 손 포즈(엄지척 / V포즈)를 맞추면 인증
- **STEP 2 (이미지 인식)**: 카메라로 첨부하신 호랑이 이미지를 비추면 성공, 제한 시간 안에 못 찾으면 실패

---

## 1. 어떻게 만들었는지

| 단계 | 사용 기술 | 이유 |
|---|---|---|
| STEP 1 손 포즈 인식 | **Google MediaPipe Tasks Vision – GestureRecognizer** (CDN) | 8th Wall에는 "엄지척/V포즈" 같은 손가락 제스처 분류 기능이 없습니다. MediaPipe의 GestureRecognizer는 `Thumb_Up`, `Victory` 등 8가지 제스처를 기본 내장 모델로 바로 인식하므로, 별도 모델 학습 없이 정확도 높은 포즈 인증을 구현할 수 있습니다. |
| STEP 2 이미지 인식 | **8th Wall Web (XR8) + A-Frame + XRExtras** | `../curved-aframe`에서 이미 사용 중이신 것과 **동일한 런타임**(`../xr_st/8frame-1.5.0.min.js`, `xrextras.js`, `xr.js`)과 **동일한 패턴**(`xrextras-named-image-target`, `XR8.XrController.configure({imageTargetData:[...]})`)을 그대로 재사용했습니다. 라이선스/도메인 설정이 이미 되어 있는 기존 파이프라인을 그대로 타기 때문에 별도 설정이 필요 없습니다. |

두 엔진이 카메라를 동시에 요청하면 충돌할 수 있어서, **화면을 완전히 분리**했습니다.
STEP 1 화면은 자체 `getUserMedia` 카메라를 쓰고, 포즈 인증에 성공하면 그 스트림을
완전히 끈 다음에야 STEP 2의 `<a-scene xrweb>`를 DOM에 삽입해서 8th Wall이 카메라를
새로 잡도록 했습니다.

## 2. 파일 구성

```
tiger-ar-quest/
├── index.html          메인 페이지 (4개 화면: 인트로 → 포즈 → 이미지인식 → 결과)
├── style.css            전체 스타일
├── app.js               게임 로직 (포즈 인식 + AR 이벤트 처리)
├── tiger-target.json     8th Wall 이미지 타겟 메타데이터 (호랑이 이미지)
├── assets/
│   └── tiger-target.png  이미지 타겟 원본 이미지 (773×960으로 업스케일)
└── tools/
    ├── compile-target.mjs  tiger-target.json / tiger-target.png를 생성한 스크립트
    └── package.json        위 스크립트가 쓰는 패키지 (@8thwall/image-target-cli, sharp)
```

## 3. 설치 방법 (중요)

이 폴더를 **`doggie` 저장소 안, `curved-aframe`/`handtracking`과 같은 위치에** 그대로
넣어주세요. `index.html`이 `../xr_st/...` 상대경로로 8th Wall 런타임을 참조하기 때문에,
`xr_st` 폴더와 형제(sibling) 폴더여야 정상 동작합니다.

```
doggie/
├── xr_st/              (기존 8th Wall 런타임 - 그대로 둠)
├── curved-aframe/       (기존 예제)
└── tiger-ar-quest/      (이번에 만든 폴더 - 여기에 붙여넣기)
```

카메라를 쓰기 때문에 **HTTPS 환경**(또는 `localhost`)에서 열어야 합니다. 8th Wall
프로젝트를 배포하시는 방식 그대로(예: 8th Wall 호스팅, 사내 서버 등) 올리시면 됩니다.

## 4. 이미지 타겟(tiger-target.json)에 대해 꼭 확인해주세요

`tiger-target.json`은 8th Wall이 공개한 오픈소스 CLI인
[`@8thwall/image-target-cli`](https://github.com/8thwall/8thwall/tree/main/apps/image-target-cli)의
크롭/좌표 계산 로직을 그대로 사용해서, `curved-aframe/curved-target-ar.json`과 **같은
필드 구조**(`imagePath`, `name`, `type: "PLANAR"`, `properties`, `userMetadataIsJson`,
`loadAutomatically`)로 직접 만든 파일입니다. 원본 호랑이 이미지가 8th Wall이 요구하는
최소 해상도(가로 480 / 세로 640)보다 작아서(380×472), 비율을 유지한 채 773×960으로
업스케일한 뒤 좌표를 계산했습니다.

다만 이 CLI는 8th Wall의 **최신 스튜디오용 툴**이라, 실제 인식 정확도를 좌우하는 특징점
추출은 여전히 대표님 계정에 연결된 `xr.js` 엔진이 내부적으로 처리합니다. 즉:

- **그대로 테스트해보시고**, 인식이 잘 안 되거나 인식 범위가 좁게 느껴지면
- 8th Wall 콘솔의 Image Target 컴파일러로 `assets/tiger-target.png`를 다시
  업로드/컴파일하신 뒤 그 결과 JSON으로 `tiger-target.json`을 교체해주시는 것을
  권장드립니다. (구조는 100% 동일하게 맞춰뒀기 때문에 파일만 바꿔치기하면 됩니다.)

호랑이 이미지 자체가 대비가 강하고 특징이 많은 편이라(줄무늬, 큰 눈) 이미지 타겟으로는
비교적 인식이 잘 되는 편에 속합니다.

## 5. 포즈 인식 커스터마이징

`app.js` 상단의 설정값으로 튜닝하실 수 있습니다.

```js
const GESTURE_CONFIDENCE_THRESHOLD = 0.65; // 낮출수록 인식은 쉬워지지만 오탐 증가
const POSE_HOLD_MS = 1200;                 // 포즈를 유지해야 하는 시간
const IMAGE_TIMEOUT_MS = 25000;            // 이미지 인식 제한 시간 (실패 처리까지)
```

MediaPipe GestureRecognizer는 아래 8종 제스처를 기본 인식합니다. 필요하시면
`POSE_GESTURE_MAP`에 `Closed_Fist`, `Open_Palm`, `Pointing_Up`, `Thumb_Down`,
`ILoveYou` 등을 추가해서 포즈 종류를 더 늘리실 수 있습니다.

## 6. 확인이 필요한 부분 (직접 테스트 필수)

카메라·8th Wall 라이선스·실제 기기가 필요한 부분이라 이 환경에서는 실행 테스트를 할 수
없었습니다. 아래 항목은 실제 배포 후 꼭 확인해주세요.

1. **손 포즈 인식 정확도** — 조명/각도에 따라 `GESTURE_CONFIDENCE_THRESHOLD`를
   조정하시는 게 좋을 수 있습니다.
2. **`xrimagefound` / `xrimagelost` 이벤트명** — XRExtras 소스 기준으로 확인했지만,
   사용 중이신 `8frame-1.5.0` 버전과 100% 동일한지는 실기기 테스트로 확인이
   필요합니다. 혹시 이미지 인식 성공 시 화면이 넘어가지 않는다면, 브라우저 콘솔에서
   실제로 발생하는 이벤트명을 확인하신 뒤 `app.js`의 `enterImageScreen()` 함수 안
   이벤트 리스너 부분만 수정하시면 됩니다.
3. **iOS Safari 카메라 권한 전환** — STEP 1 카메라를 끄고 STEP 2에서 8th Wall이
   카메라를 새로 요청하는 구조라, 기종에 따라 권한 팝업이 한 번 더 뜰 수 있습니다.

이 외 UI(인트로, 포즈 화면, 결과 화면)는 실제 브라우저(Chromium, 카메라는 가상 장치로
대체)로 직접 렌더링해서 레이아웃 깨짐/겹침 등은 확인 및 수정 완료했습니다.
