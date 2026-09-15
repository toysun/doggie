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

두 엔진이 카메라를 동시에 요청하면 충돌할 수 있어서, **화면(카메라 세션)은 완전히
분리**했습니다. STEP 1 화면은 자체 `getUserMedia` 카메라를 쓰고, 포즈 인증에 성공하면
그 스트림을 완전히 끈 다음에야 STEP 2의 `<a-scene xrweb>`를 DOM에 삽입해서 8th Wall이
카메라를 새로 잡도록 했습니다.

> **손 포즈 인식과 이미지 인식을 한 화면에서 동시에 돌리는 건 안 되나요?**
> 검토해봤는데, 8th Wall 자체의 Hand Tracking 기능은 공식 문서에 "Image Targets를
> 포함한 다른 기능과 함께 쓸 수 없다"고 명시돼 있어서 애초에 8th Wall만으로는
> 불가능합니다. MediaPipe(손 포즈)와 8th Wall(이미지 인식)을 각각 별도 카메라
> 스트림으로 동시에 띄우는 방법도 있지만, 특히 iOS Safari에서 한 탭이 같은 카메라를
> 두 번 여는 게 불안정하고 두 CV 파이프라인을 동시에 돌리면 성능 부담도 커서, 안정성을
> 위해 지금처럼 순차 구조를 유지하기로 했습니다. 대신 아래처럼 전환을 최대한 자연스럽게
> 만들었습니다.

**STEP 1 → STEP 2 전환을 매끄럽게 처리**: 포즈 인증에 성공한 순간의 카메라 프레임을
캡처해서 블러 처리한 배경으로 즉시 화면 전체를 덮고("2단계 준비 중..." 로딩 오버레이),
그 뒤에서 카메라 스트림 교체 + 8th Wall 씬 마운트를 처리한 다음, AR 카메라 피드가
뜬 게 확인되면(`xrimagescanning` 이벤트 또는 최대 2.2초 타임아웃) 오버레이를 페이드
아웃합니다. 이렇게 하면 검은 화면이나 뚝 끊기는 느낌 없이 "하나의 화면이 이어지는"
느낌으로 넘어갑니다. (넥슨 원본 영상에서도 두 단계 사이에 "LOADING" 화면이 있었던 것과
같은 방식입니다.)

### 결과 화면 — 사진 1장으로 합치기 + 보기/저장 버그 수정

기존에는 STEP 1(포즈)과 STEP 2(이미지 인식) 사진을 각각 별도의 `<img>` 두 개로
나란히 보여드려서 사이에 여백/테두리가 보였습니다. 지금은 두 프레임을
`compose-canvas`에 **가장자리 간격 없이(cover-fit으로 각 545×720 패널을 꽉 채워)**
한 장으로 합성한 뒤, 구분선 역할만 하는 얇은 2px 세로선 하나만 남기고 하단에
공통 캡션(성공/실패 문구) 한 줄을 넣어서, 화면에는 `<img id="result-photo">`
**한 개**만 렌더링합니다. → 요청하신 "사이 간격 없이 하나의 사진처럼"이 이렇게
반영되었습니다.

"사진보기가 안 됨" 문제는 STEP 2(8th Wall AR 화면) 캡처 쪽 원인을 두 단계에
걸쳐 찾았습니다.

1차 시도로는 `<a-scene renderer="preserveDrawingBuffer: true">`가 원인이라
보고(A-Frame 소스상 renderer 시스템이 지원하지 않는 속성이라 조용히 무시됨)
A-Frame 기본 제공 `screenshot` 컴포넌트로 바꿨는데도 문제가 재현됐습니다. 더
찾아보니 진짜 원인은 따로 있었습니다: A-Frame의 `screenshot` 컴포넌트는
캡처 시점에 `renderer.render(scene, camera)`를 **한 번 더** 호출해서 픽셀을
읽어오는데, 이 재렌더링은 8th Wall이 매 프레임 카메라 영상을 캔버스에 합성해
넣는 자체 렌더 파이프라인을 거치지 않습니다. 그래서 캡처된 이미지에 카메라
배경(호랑이가 비친 실제 화면)이 빠지거나 빈 이미지로 나올 수 있었습니다.

→ 8th Wall이 정확히 이 문제를 위해 공식 제공하는
[`XR8.CanvasScreenshot`](https://www.8thwall.com/docs/api/canvasscreenshot/takescreenshot/)
API로 교체했습니다. `app.js` 최상단에서 `XR8.addCameraPipelineModules([
XR8.CanvasScreenshot.pipelineModule() ])`로 파이프라인 모듈을 한 번 등록해두면,
`XR8.CanvasScreenshot.takeScreenshot()`이 8th Wall 자체 렌더 파이프라인을 거쳐
"카메라 영상 + AR 콘텐츠"가 합성된 실제 화면 그대로를 base64 JPEG로 반환합니다.
`preserveDrawingBuffer`나 A-Frame의 `screenshot` 컴포넌트 둘 다 더 이상 쓰지
않습니다.

"다운로드가 안 됨" 문제는 iOS Safari에서 `<a download>`가 data/blob URL을
안정적으로 "저장"하지 않고 그냥 이미지를 열어버리는(새 탭/미리보기로 표시) 잘
알려진 제약 때문일 가능성이 높습니다. → "사진 저장하기" 버튼을 누르면 먼저
**Web Share API**(`navigator.share({ files: [...] })`)로 기기 공유 시트를 띄워서
"이미지 저장"을 하도록 시도하고(iOS에서 가장 안정적으로 동작), 이게 지원되지
않는 환경(주로 데스크톱 브라우저)에서는 기존 방식인 `<a download>` blob 클릭으로
자동 대체(fallback)됩니다.

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

전환 오버레이(위 "매끄럽게 처리" 항목)의 타이밍은 `onPoseSuccess()`의
`await wait(400)`(페이드인 대기 시간)와 `waitForArReady()`의 `timeoutMs = 2200`
(AR 카메라가 늦게 뜰 경우 최대 대기 시간)에서 조정할 수 있습니다.

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
4. **`xrimagescanning` 이벤트** — 전환 오버레이를 언제 걷어낼지 판단하는 데
   사용했는데, 이 이벤트가 실제로 안 뜨더라도 2.2초 뒤 강제로 오버레이가 사라지도록
   타임아웃을 걸어뒀기 때문에 화면이 멈추진 않습니다. 다만 실기기에서 카메라 전환이
   2.2초보다 오래 걸리면 AR 화면이 완전히 뜨기 전에 오버레이가 먼저 사라져 잠깐
   로딩 중인 화면이 보일 수 있으니, 필요하면 `timeoutMs` 값을 늘려주세요.
5. **STEP 2 사진 저장(Web Share API)** — "사진 저장하기" 버튼은 `navigator.share`
   지원 여부를 실행 시점에 확인해서 자동으로 분기하도록 만들었지만, 실제
   아이폰/안드로이드 기종·브라우저별 공유 시트 동작은 실기기에서 최종 확인해
   주세요. 데스크톱 Chrome처럼 `navigator.canShare`가 파일 공유를 지원하지 않는
   환경에서는 자동으로 기존 `<a download>` 방식으로 저장됩니다(이 환경에서
   `canShare` 분기 자체는 확인했습니다).
6. **`XR8.CanvasScreenshot` 모듈 사용 가능 여부** — 이 API는 8th Wall Web
   엔진의 표준 공개 기능이라 별도 유료 애드온 없이 대부분의 `xr.js` 빌드에
   포함되어 있어야 하지만, 사용 중이신 `8frame-1.5.0` / `xr.js` 번들에 실제로
   포함돼 있는지는 카메라·8th Wall 라이선스가 필요해서 이 환경에서는 최종
   확인이 불가능했습니다. `app.js`의 `registerCanvasScreenshotModule()`은
   `window.XR8.CanvasScreenshot`이 없으면 콘솔에 경고만 남기고 조용히
   건너뛰도록(캡처만 실패, 나머지 게임 진행에는 영향 없음) 만들어뒀으니, 혹시
   실기기에서 STEP 2 사진이 여전히 안 나온다면 브라우저 콘솔에서
   "XR8.CanvasScreenshot module not available" 경고가 뜨는지부터 확인해주세요.
   뜬다면 사용 중이신 엔진 번들에 해당 모듈이 빠져있다는 뜻이라, 8th Wall
   콘솔/지원팀에 `xr.js` 빌드에 `CanvasScreenshot`이 포함돼 있는지 문의가
   필요합니다.

이 외 UI(인트로, 포즈 화면, 결과 화면)는 실제 브라우저(Chromium, 카메라는 가상 장치로
대체)로 직접 렌더링해서 레이아웃 깨짐/겹침 등은 확인 및 수정 완료했습니다. 이번
수정분(사진 1장 합성, 결과 화면 표시, 다운로드 버튼 분기)도 같은 방식으로
구조/레이아웃 확인을 마쳤습니다. 다만 `XR8.CanvasScreenshot` 자체의 실제 캡처
동작(카메라 영상이 실제로 잘 찍히는지)은 8th Wall 라이선스가 있는 실기기에서만
최종 확인 가능합니다.
