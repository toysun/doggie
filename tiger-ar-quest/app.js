// ============================================================================
// Tiger Pose Quest — 2-step Web AR verification game
//
// STEP 1 (pose auth)   : MediaPipe Tasks Vision GestureRecognizer running on
//                        its own getUserMedia camera stream. Detects the
//                        built-in "Thumb_Up" / "Victory" gestures.
// STEP 2 (image recog) : 8th Wall Web (XR8) + A-Frame + XRExtras, using the
//                        SAME image-target pipeline as ../curved-aframe in
//                        this repo. The tiger photo is pre-compiled into
//                        ./tiger-target.json (see /tools/compile-target.mjs
//                        for how that file + ./assets/tiger-target.png were
//                        generated with the official @8thwall/image-target-cli).
// ============================================================================

// NOTE: MediaPipe is loaded with a *dynamic* import inside getGestureRecognizer()
// rather than a static top-level import. If this ever failed as a static import
// (CDN hiccup, ad-blocker, offline test, ...), the whole module would throw and
// none of the UI below — tabs, the start button, screens 2-4 — would work at all.
// A dynamic import lets a CDN failure degrade gracefully to just an on-screen
// error on the pose step instead of a dead page.
const MEDIAPIPE_CDN_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const MEDIAPIPE_WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MEDIAPIPE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";

// Maps our UI pose ids to MediaPipe's built-in gesture category names.
const POSE_GESTURE_MAP = {
  thumbs_up: "Thumb_Up",
  victory: "Victory",
};
const POSE_LABEL_KO = {
  thumbs_up: "엄지척 포즈",
  victory: "V 포즈",
};

const GESTURE_CONFIDENCE_THRESHOLD = 0.65;
const POSE_HOLD_MS = 1200; // how long the gesture must be held to pass
const IMAGE_TARGET_NAME = "tiger-target";
const IMAGE_TIMEOUT_MS = 25000; // give up automatically after this long

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------
const state = {
  selectedPose: "thumbs_up",
  facingMode: "environment",
  poseStream: null,
  gestureRecognizer: null,
  poseRafId: null,
  holdStartedAt: null,
  poseDone: false,
  snapshotPoseUrl: null,
  snapshotImageUrl: null,
  xrConfigured: false,
  imageTimeoutHandle: null,
  imageTimerRafId: null,
  imageStartedAt: null,
  imageFound: false,
};

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);

const screens = {
  intro: $("#screen-intro"),
  pose: $("#screen-pose"),
  image: $("#screen-image"),
  result: $("#screen-result"),
};

function showScreen(name) {
  Object.values(screens).forEach((el) => el.classList.remove("active"));
  screens[name].classList.add("active");
}

// ---------------------------------------------------------------------------
// INTRO SCREEN
// ---------------------------------------------------------------------------
document.querySelectorAll("#pose-tabs .tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("#pose-tabs .tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    state.selectedPose = tab.dataset.pose;
  });
});

$("#btn-start").addEventListener("click", () => {
  resetGameState();
  showScreen("pose");
  enterPoseScreen();
});

// ---------------------------------------------------------------------------
// STEP 1 — POSE AUTH (MediaPipe GestureRecognizer)
// ---------------------------------------------------------------------------
async function getGestureRecognizer() {
  if (state.gestureRecognizer) return state.gestureRecognizer;
  const { GestureRecognizer, FilesetResolver } = await import(MEDIAPIPE_CDN_URL);
  const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE);
  state.gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MEDIAPIPE_MODEL_URL,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 1,
  });
  return state.gestureRecognizer;
}

async function startPoseCamera() {
  stopPoseCamera();
  const video = $("#pose-video");
  const constraints = {
    audio: false,
    video: {
      facingMode: state.facingMode,
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  state.poseStream = stream;
  video.srcObject = stream;
  await new Promise((resolve) => {
    if (video.readyState >= 2) return resolve();
    video.onloadedmetadata = () => resolve();
  });
  await video.play();
}

function stopPoseCamera() {
  if (state.poseStream) {
    state.poseStream.getTracks().forEach((t) => t.stop());
    state.poseStream = null;
  }
  if (state.poseRafId) {
    cancelAnimationFrame(state.poseRafId);
    state.poseRafId = null;
  }
}

async function enterPoseScreen() {
  const poseKo = POSE_LABEL_KO[state.selectedPose];
  $("#pose-banner-text").textContent = `${poseKo}를 인식시켜 주세요`;
  $("#pose-status-label").textContent = "포즈 인식 대기중";
  $("#guide-icon").dataset.icon = state.selectedPose;
  $("#guide-icon").classList.remove("matched");
  setRingProgress(0);
  state.holdStartedAt = null;
  state.poseDone = false;

  try {
    await startPoseCamera();
  } catch (err) {
    console.error(err);
    $("#pose-status-label").textContent = "카메라를 사용할 수 없어요";
    alert(
      "카메라 접근에 실패했어요. 브라우저의 카메라 권한을 확인한 뒤 다시 시도해주세요.\n\n" +
        err.message
    );
    return;
  }

  try {
    await getGestureRecognizer();
    poseLoop();
  } catch (err) {
    console.error(err);
    $("#pose-status-label").textContent = "포즈 인식 모델을 불러오지 못했어요";
    alert(
      "손 포즈 인식 모델(MediaPipe)을 불러오지 못했어요. 인터넷 연결 상태를 확인한 뒤 " +
        "다시 시도해주세요.\n\n" +
        err.message
    );
  }
}

function setRingProgress(ratio) {
  const circumference = 327; // 2 * PI * 52, matches the SVG circle in index.html
  const clamped = Math.max(0, Math.min(1, ratio));
  $("#progress-ring-fg").style.strokeDashoffset = String(circumference * (1 - clamped));
}

function poseLoop() {
  const video = $("#pose-video");

  const tick = () => {
    if (state.poseDone) return;
    if (video.readyState >= 2 && state.gestureRecognizer) {
      const now = performance.now();
      const result = state.gestureRecognizer.recognizeForVideo(video, now);
      handleGestureResult(result, now);
    }
    state.poseRafId = requestAnimationFrame(tick);
  };
  state.poseRafId = requestAnimationFrame(tick);
}

function handleGestureResult(result, now) {
  const targetGesture = POSE_GESTURE_MAP[state.selectedPose];
  let matched = false;

  if (result.gestures && result.gestures.length > 0) {
    const top = result.gestures[0][0]; // best category for the first detected hand
    if (top && top.categoryName === targetGesture && top.score >= GESTURE_CONFIDENCE_THRESHOLD) {
      matched = true;
    }
  }

  const guideIcon = $("#guide-icon");

  if (matched) {
    guideIcon.classList.add("matched");
    if (!state.holdStartedAt) state.holdStartedAt = now;
    const elapsed = now - state.holdStartedAt;
    setRingProgress(elapsed / POSE_HOLD_MS);
    $("#pose-status-label").textContent = "포즈 유지해주세요...";

    if (elapsed >= POSE_HOLD_MS) {
      onPoseSuccess();
    }
  } else {
    guideIcon.classList.remove("matched");
    state.holdStartedAt = null;
    setRingProgress(0);
    $("#pose-status-label").textContent = "포즈 인식 대기중";
  }
}

function onPoseSuccess() {
  state.poseDone = true;
  $("#pose-status-label").textContent = "PERFECT!";

  // capture a snapshot of the winning pose
  state.snapshotPoseUrl = captureVideoSnapshot($("#pose-video"), {
    label: `POSE CHALLENGE  ·  ${POSE_LABEL_KO[state.selectedPose]}  ·  PERFECT`,
  });

  stopPoseCamera();

  setTimeout(() => {
    showScreen("image");
    enterImageScreen();
  }, 700);
}

$("#btn-flip-camera").addEventListener("click", async () => {
  state.facingMode = state.facingMode === "environment" ? "user" : "environment";
  try {
    await startPoseCamera();
  } catch (err) {
    console.error(err);
  }
});

// ---------------------------------------------------------------------------
// STEP 2 — IMAGE RECOGNITION (8th Wall / A-Frame / XRExtras)
// ---------------------------------------------------------------------------
function buildArSceneMarkup() {
  return `
    <a-scene
      xrextras-loading
      xrextras-runtime-error
      renderer="colorManagement: true; physicallyBasedRendering: true; preserveDrawingBuffer: true;"
      xrweb="disableWorldTracking: true">

      <a-camera position="0 1 1" raycaster="objects: .cantap" cursor="fuse: false; rayOrigin: mouse;"></a-camera>
      <a-light type="directional" intensity="1.2" position="0 1 0"></a-light>
      <a-light type="ambient" intensity="0.35"></a-light>

      <xrextras-named-image-target name="${IMAGE_TARGET_NAME}" id="tiger-target-entity">
        <a-plane
          class="found-frame"
          material="color:#22c55e; opacity:0.18; transparent:true; shader:flat;"
          width="1" height="1.3"
          position="0 0 0.01">
        </a-plane>
      </xrextras-named-image-target>
    </a-scene>
  `;
}

async function enterImageScreen() {
  $("#image-banner-text").textContent = "호랑이 이미지를 화면 안에 비춰주세요";
  $("#image-status-label").textContent = "이미지 스캔 중...";
  $("#image-timer-bar").style.width = "100%";
  state.imageFound = false;
  state.imageStartedAt = performance.now();

  const mount = $("#ar-mount");
  mount.innerHTML = buildArSceneMarkup();
  const sceneEl = mount.querySelector("a-scene");
  const targetEl = mount.querySelector("#tiger-target-entity");

  // 8th Wall's engine dispatches the low-level "xrimagefound"/"xrimagelost"
  // events on the <a-scene>, and the xrextras-named-image-target wrapper
  // (once it matches by name) re-emits the friendlier "xrextrasfound"/
  // "xrextraslost" on the target entity itself. We listen for both so this
  // still works even if one naming contract shifts between XRExtras builds.
  const onFound = (e) => {
    if (!e.detail || e.detail.name === IMAGE_TARGET_NAME) onImageFound();
  };
  const onLost = (e) => {
    if ((!e.detail || e.detail.name === IMAGE_TARGET_NAME) && !state.imageFound) {
      $("#image-status-label").textContent = "이미지 스캔 중...";
    }
  };
  sceneEl.addEventListener("xrimagefound", onFound);
  sceneEl.addEventListener("xrimagelost", onLost);
  if (targetEl) {
    targetEl.addEventListener("xrextrasfound", onFound);
    targetEl.addEventListener("xrextraslost", onLost);
  }

  const onXrLoaded = async () => {
    try {
      const res = await fetch("./tiger-target.json");
      const json = await res.json();
      window.XR8.XrController.configure({ imageTargetData: [json] });
      state.xrConfigured = true;
    } catch (err) {
      console.error("Failed to load tiger-target.json", err);
      $("#image-status-label").textContent = "이미지 타겟 데이터를 불러오지 못했어요.";
    }
  };
  if (window.XR8) {
    onXrLoaded();
  } else {
    window.addEventListener("xrloaded", onXrLoaded, { once: true });
  }

  startImageTimeout();
}

function startImageTimeout() {
  clearImageTimers();

  const tick = () => {
    if (state.imageFound) return;
    const elapsed = performance.now() - state.imageStartedAt;
    const remainRatio = Math.max(0, 1 - elapsed / IMAGE_TIMEOUT_MS);
    $("#image-timer-bar").style.width = `${remainRatio * 100}%`;
    if (elapsed >= IMAGE_TIMEOUT_MS) {
      onImageTimeout();
      return;
    }
    state.imageTimerRafId = requestAnimationFrame(tick);
  };
  state.imageTimerRafId = requestAnimationFrame(tick);
}

function clearImageTimers() {
  if (state.imageTimerRafId) {
    cancelAnimationFrame(state.imageTimerRafId);
    state.imageTimerRafId = null;
  }
  if (state.imageTimeoutHandle) {
    clearTimeout(state.imageTimeoutHandle);
    state.imageTimeoutHandle = null;
  }
}

function onImageFound() {
  if (state.imageFound) return;
  state.imageFound = true;
  clearImageTimers();
  $("#image-status-label").textContent = "인식 성공!";
  $("#image-banner-text").textContent = "호랑이를 찾았어요!";

  // Give the highlight a beat to render before we snapshot + tear down.
  setTimeout(() => {
    const arCanvas = document.querySelector("#ar-mount canvas");
    if (arCanvas) {
      state.snapshotImageUrl = composeLabelledSnapshot(arCanvas, "IMAGE CHALLENGE  ·  FOUND!");
    }
    teardownArScene();
    finishGame(true);
  }, 500);
}

function onImageTimeout() {
  const arCanvas = document.querySelector("#ar-mount canvas");
  if (arCanvas) {
    state.snapshotImageUrl = composeLabelledSnapshot(arCanvas, "IMAGE CHALLENGE  ·  FAILED");
  }
  teardownArScene();
  finishGame(false);
}

$("#btn-give-up").addEventListener("click", () => {
  clearImageTimers();
  const arCanvas = document.querySelector("#ar-mount canvas");
  if (arCanvas) {
    state.snapshotImageUrl = composeLabelledSnapshot(arCanvas, "IMAGE CHALLENGE  ·  FAILED");
  }
  teardownArScene();
  finishGame(false);
});

function teardownArScene() {
  clearImageTimers();
  try {
    if (window.XR8 && typeof window.XR8.stop === "function") window.XR8.stop();
  } catch (err) {
    console.warn("XR8.stop() failed", err);
  }
  $("#ar-mount").innerHTML = "";
}

// ---------------------------------------------------------------------------
// RESULT SCREEN
// ---------------------------------------------------------------------------
function finishGame(success) {
  showScreen("result");

  const icon = $("#result-icon");
  icon.classList.remove("success", "fail", "pop-in");
  void icon.offsetWidth; // restart animation
  icon.classList.add(success ? "success" : "fail", "pop-in");
  icon.textContent = success ? "✓" : "✕";

  $("#result-title").textContent = success ? "인증 성공!" : "인증 실패";
  $("#result-sub").textContent = success
    ? "포즈 인증과 이미지 인식을 모두 완료했어요."
    : "호랑이 이미지를 다시 인식시켜 도전해보세요.";

  const poseImg = $("#snapshot-pose");
  const imageImg = $("#snapshot-image");
  poseImg.src = state.snapshotPoseUrl || "";
  poseImg.style.visibility = state.snapshotPoseUrl ? "visible" : "hidden";
  imageImg.src = state.snapshotImageUrl || "";
  imageImg.style.visibility = state.snapshotImageUrl ? "visible" : "hidden";

  const downloadBtn = $("#btn-download");
  if (state.snapshotPoseUrl || state.snapshotImageUrl) {
    downloadBtn.style.display = "inline-flex";
    downloadBtn.removeAttribute("href"); // cleared until composeFinalResult finishes drawing
    composeFinalResult(success);
  } else {
    downloadBtn.style.display = "none";
  }
}

$("#btn-retry").addEventListener("click", () => {
  resetGameState();
  showScreen("intro");
});

// ---------------------------------------------------------------------------
// Snapshot helpers
// ---------------------------------------------------------------------------
function captureVideoSnapshot(videoEl, { label } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = videoEl.videoWidth || 720;
  canvas.height = videoEl.videoHeight || 960;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  if (label) drawLabelBanner(ctx, canvas.width, canvas.height, label);
  return canvas.toDataURL("image/png");
}

function composeLabelledSnapshot(sourceCanvas, label) {
  const canvas = document.createElement("canvas");
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext("2d");
  try {
    ctx.drawImage(sourceCanvas, 0, 0);
  } catch (err) {
    console.warn("Could not read AR canvas pixels", err);
  }
  drawLabelBanner(ctx, canvas.width, canvas.height, label);
  return canvas.toDataURL("image/png");
}

function drawLabelBanner(ctx, width, height, text) {
  const bannerHeight = Math.max(36, height * 0.08);
  ctx.fillStyle = "rgba(15,14,20,0.72)";
  ctx.fillRect(0, height - bannerHeight, width, bannerHeight);
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${Math.round(bannerHeight * 0.38)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, height - bannerHeight / 2);
}

function composeFinalResult(success) {
  const canvas = $("#compose-canvas");
  const panelW = 540;
  const panelH = 720;
  canvas.width = panelW * 2;
  canvas.height = panelH + 90;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#16151c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const drawPanel = (src, x) =>
    new Promise((resolve) => {
      if (!src) return resolve();
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, x, 0, panelW, panelH);
        resolve();
      };
      img.onerror = resolve;
      img.src = src;
    });

  // Fire-and-forget: build synchronously enough for typical small PNGs.
  // (Images are same-origin data URLs so onload fires essentially immediately.)
  Promise.all([
    drawPanel(state.snapshotPoseUrl, 0),
    drawPanel(state.snapshotImageUrl, panelW),
  ]).then(() => {
    ctx.fillStyle = success ? "#22c55e" : "#ef4444";
    ctx.font = "700 42px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      success ? "TIGER QUEST - SUCCESS" : "TIGER QUEST - FAILED",
      canvas.width / 2,
      panelH + 55
    );
    $("#btn-download").href = canvas.toDataURL("image/png");
  });
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------
function resetGameState() {
  stopPoseCamera();
  teardownArScene();
  state.holdStartedAt = null;
  state.poseDone = false;
  state.snapshotPoseUrl = null;
  state.snapshotImageUrl = null;
  state.imageFound = false;
  setRingProgress(0);
}
