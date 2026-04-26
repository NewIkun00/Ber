const DESIGN_WIDTH = 750;
const DESIGN_HEIGHT = 1334;
const PATH_RADIUS = 327 / 2;
const PATH_CENTER = { x: DESIGN_WIDTH / 2, y: DESIGN_HEIGHT / 2 };
const START_ANGLE = Math.PI / 4;
const BASE_BODY_ANGLE = -60;
const HAND_ASPECT = 1111 / 588;
const RUNNING_SPEED = Math.PI * 3.4;
const EXTRA_STOP_LOOPS = 1;
const MIN_STOP_DURATION = 450;
const MAX_STOP_DURATION = 900;

const gameShell = document.querySelector(".game-shell");
const hand = document.getElementById("hand");
const actionButton = document.getElementById("actionButton");
const actionImage = document.getElementById("actionImage");
const mainAudio = document.getElementById("mainAudio");
const stopAudio = document.getElementById("stopAudio");

const state = {
  mode: "running",
  currentAngle: START_ANGLE,
  lastTime: 0,
  stopFrom: START_ANGLE,
  stopTo: START_ANGLE,
  stopStartTime: 0,
  stopDuration: MIN_STOP_DURATION,
  audioUnlocked: false
};

function updateHandPosition(angle) {
  const pivotX = PATH_CENTER.x + PATH_RADIUS * Math.cos(angle);
  const pivotY = PATH_CENTER.y + PATH_RADIUS * Math.sin(angle);
  const rotate = angle * 180 / Math.PI - BASE_BODY_ANGLE;
  const shellWidth = gameShell.clientWidth;
  const shellHeight = gameShell.clientHeight;
  const handHeight = hand.clientHeight || hand.clientWidth * HAND_ASPECT;
  hand.style.left = `${pivotX / DESIGN_WIDTH * shellWidth}px`;
  hand.style.top = `${pivotY / DESIGN_HEIGHT * shellHeight - handHeight}px`;
  hand.style.transform = `rotate(${rotate}deg)`;
}

function normalizePositiveAngle(angle) {
  const full = Math.PI * 2;
  return ((angle % full) + full) % full;
}

function setButtonState(running) {
  actionButton.classList.toggle("is-stop", running);
  actionImage.src = running ? "assets/Stop.png" : "assets/Star.png";
  actionButton.setAttribute("aria-label", running ? "停止转盘" : "重新开始");
}

async function tryPlay(audio) {
  try {
    await audio.play();
    state.audioUnlocked = true;
  } catch (error) {
    return false;
  }
  return true;
}

async function startMainLoop() {
  stopAudio.pause();
  stopAudio.currentTime = 0;
  mainAudio.currentTime = 0;
  await tryPlay(mainAudio);
}

function stopMainLoop() {
  mainAudio.pause();
  mainAudio.currentTime = 0;
}

async function playStopSound() {
  stopAudio.pause();
  stopAudio.currentTime = 0;
  await tryPlay(stopAudio);
}

function beginStop() {
  const current = normalizePositiveAngle(state.currentAngle);
  const forwardDistance = normalizePositiveAngle(START_ANGLE - current);
  const stopDistance = forwardDistance + Math.PI * 2 * EXTRA_STOP_LOOPS;
  const naturalDuration = stopDistance / RUNNING_SPEED * 2 * 1000;

  state.mode = "stopping";
  state.stopFrom = state.currentAngle;
  state.stopTo = state.currentAngle + stopDistance;
  state.stopStartTime = performance.now();
  state.stopDuration = Math.min(Math.max(naturalDuration, MIN_STOP_DURATION), MAX_STOP_DURATION);
  setButtonState(false);
  stopMainLoop();
  playStopSound();
}

function restartGame() {
  state.mode = "running";
  state.currentAngle = START_ANGLE;
  state.lastTime = performance.now();
  setButtonState(true);
  updateHandPosition(state.currentAngle);
  startMainLoop();
}

function tick(now) {
  if (!state.lastTime) {
    state.lastTime = now;
  }

  const delta = (now - state.lastTime) / 1000;
  state.lastTime = now;

  if (state.mode === "running") {
    state.currentAngle += RUNNING_SPEED * delta;
  } else if (state.mode === "stopping") {
    const elapsed = now - state.stopStartTime;
    const progress = Math.min(elapsed / state.stopDuration, 1);
    const durationSeconds = state.stopDuration / 1000;
    const elapsedSeconds = Math.min(elapsed / 1000, durationSeconds);
    const stopDistance = state.stopTo - state.stopFrom;
    const cubicA = (RUNNING_SPEED * durationSeconds - 2 * stopDistance) / Math.pow(durationSeconds, 3);
    const cubicB = (3 * stopDistance - 2 * RUNNING_SPEED * durationSeconds) / Math.pow(durationSeconds, 2);

    state.currentAngle = state.stopFrom
      + RUNNING_SPEED * elapsedSeconds
      + cubicB * elapsedSeconds * elapsedSeconds
      + cubicA * elapsedSeconds * elapsedSeconds * elapsedSeconds;

    if (progress >= 1) {
      state.mode = "stopped";
      state.currentAngle = state.stopTo;
    }
  }

  updateHandPosition(state.currentAngle);
  requestAnimationFrame(tick);
}

actionButton.addEventListener("click", () => {
  if (state.mode === "running") {
    beginStop();
    return;
  }

  if (state.mode === "stopped") {
    restartGame();
  }
});

document.addEventListener("pointerdown", () => {
  if (!state.audioUnlocked && state.mode === "running") {
    tryPlay(mainAudio);
  }
}, { once: true });

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    mainAudio.pause();
    stopAudio.pause();
    return;
  }

  if (state.mode === "running") {
    tryPlay(mainAudio);
  }
});

setButtonState(true);
updateHandPosition(state.currentAngle);
startMainLoop();
requestAnimationFrame(tick);
