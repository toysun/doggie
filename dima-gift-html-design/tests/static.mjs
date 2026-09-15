import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html");
const css = read("styles.css");
const js = read("app.js");

function assert(value, message) {
  if (!value) throw new Error(message);
}

const requiredFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "README.md",
  "assets/gift-start-keyvisual.png",
  "assets/campus-zone-map.png",
  "assets/stamps/g.png",
  "assets/stamps/i.png",
  "assets/stamps/f.png",
  "assets/stamps/t.png",
];
for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(root, file)), `필수 파일 누락: ${file}`);
}

const zoneColors = { G: "#E5007F", I: "#890C84", F: "#381F87", T: "#F18E29" };
for (const [zone, color] of Object.entries(zoneColors)) {
  assert(js.includes(`color: "${color}"`), `${zone} 고유색 누락`);
  assert(css.toLowerCase().includes(color.toLowerCase()), `${zone} CSS 고유색 누락`);
}

const renderers = [
  "renderStart",
  "renderQuiz",
  "renderStampbook",
  "renderComplete",
  "renderSurvey1",
  "renderSurvey2",
  "renderParticipant",
  "renderPrivacy",
  "renderDone",
];
for (const renderer of renderers) {
  assert(js.includes(`function ${renderer}`), `화면 렌더러 누락: ${renderer}`);
}

const requiredCopy = [
  "GIFT 스탬프투어 START!",
  "먼저 시작하고 새로운 가능성에 도전하는 DIMA의 정신",
  "몰입과 반복을 통해 전문성을 깊게 만드는 DIMA의 정신",
  "실패를 두려워하지 않고 다시 도전하는 DIMA의 정신",
  "서로의 재능을 연결해 더 큰 결과를 만들어내는 DIMA의 정신",
  "만족도 조사하고 혜택 받기",
  "개인정보 수집·이용에 동의합니다.",
  "GIFT Festa 참여 완료!",
];
for (const copy of requiredCopy) assert(js.includes(copy), `필수 문구 누락: ${copy}`);

const excludedDeviceApis = [
  "getUserMedia",
  "mediaDevices",
  "navigator.geolocation",
  "getCurrentPosition",
  "ImageCapture",
];
for (const api of excludedDeviceApis) assert(!js.includes(api), `제외 대상 기기 API 포함: ${api}`);

assert(html.includes('name="viewport"'), "모바일 viewport 누락");
assert(html.includes("viewport-fit=cover"), "안전영역 viewport 누락");
assert(css.includes("100dvh"), "동적 viewport 단위 누락");
assert(css.includes("safe-area-inset-top") && css.includes("safe-area-inset-bottom"), "모바일 안전영역 CSS 누락");
assert(css.includes("@media (max-width: 359px)"), "소형 모바일 대응 누락");
assert(css.includes("prefers-reduced-motion"), "동작 줄이기 접근성 누락");
assert(js.includes('header.addEventListener("click"'), "헤더 닫기·뒤로가기 이벤트 위임 누락");
assert(js.includes('if (action === "home") navigate("start", true)'), "헤더 닫기 동작 누락");
assert(js.includes('if (action === "back") navigate(BACK[state.screen] || "start", true)'), "헤더 뒤로가기 동작 누락");
assert(css.includes("--stamp-size: 52px") && css.includes("--check-size: 26px"), "스탬프 대비 1/2 체크 배지 크기 누락");
assert(css.includes("color-mix(in srgb, var(--accent) 8%, #ffffff)"), "메인 스탬프 카드의 밝은 배경색 누락");

process.stdout.write(`PASS: ${renderers.length} HTML 디자인 화면, 4개 Zone, 기기 API 제외\n`);
