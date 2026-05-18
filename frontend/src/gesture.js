import { log, updateStatus, showToast } from './utils.js';
import {
  explodeParticles, restoreParticles, setTargetScale,
  getTargetScale, getIsExploded,
} from './particles.js';
import { showPhotos, hidePhotos, handlePhotoInteraction, hasPhotos, deselectPhoto } from './photo.js';

let hands = null;
let gestureState = 'none';
let fingerPosition = { x: 0, y: 0 };
let isProcessing = false;
// 爆炸冷却，防止单次手势多帧重复触发
let explodeCooldown = 0;
// 手势去抖动：缓存"原始检测帧"，使用 rAF 时间戳确认稳定 300ms 才切换
let detectedGesture = 'none';
let detectedAtTime = 0;
let confirmedGesture = 'none';
const GESTURE_DEBOUNCE_MS = 300;

async function loadMediaPipeHands() {
  return new Promise((resolve, reject) => {
    if (window.Hands) {
      resolve(window.Hands);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      if (window.Hands) resolve(window.Hands);
      else reject(new Error('MediaPipe Hands 加载失败'));
    };
    script.onerror = () => reject(new Error('MediaPipe 脚本加载失败'));
    document.head.appendChild(script);
  });
}

export async function initHandTracking() {
  const videoElement = document.getElementById('webcam');

  try {
    const Hands = await loadMediaPipeHands();

    hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    hands.onResults(onHandResults);
    log('info', 'Gesture', 'MediaPipe Hands 初始化成功');
  } catch (error) {
    log('error', 'Gesture', 'MediaPipe初始化失败', error);
    showToast('手势识别初始化失败', 'error');
    updateStatus('gesture-status', '手势状态: 初始化失败');
    return false;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
    });
    videoElement.srcObject = stream;

    await new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        videoElement.play();
        resolve();
      };
    });

    log('info', 'Gesture', '摄像头访问成功');

    async function processFrame(now) {
      if (hands && videoElement.readyState >= 2 && !isProcessing) {
        isProcessing = true;
        try {
          await hands.send({ image: videoElement });
        } catch (e) {
          log('warn', 'Gesture', '帧处理错误', e);
        }
        isProcessing = false;
      }
      if (explodeCooldown > 0) explodeCooldown--;
      // 每帧检查是否满足去抖动条件：当前检测手势已稳定超过 GESTURE_DEBOUNCE_MS
      if (detectedGesture !== confirmedGesture
          && now - detectedAtTime >= GESTURE_DEBOUNCE_MS) {
        _applyConfirmedGesture(detectedGesture);
      }
      requestAnimationFrame(processFrame);
    }

    processFrame();
    showToast('摄像头已启动', 'success');
    return true;

  } catch (error) {
    log('error', 'Gesture', '摄像头访问失败', error);

    let errorMsg = '摄像头访问失败';
    if (error.name === 'NotAllowedError') errorMsg = '请允许摄像头访问权限';
    else if (error.name === 'NotFoundError') errorMsg = '未检测到摄像头设备';
    else if (error.name === 'NotReadableError') errorMsg = '摄像头被其他程序占用';

    showToast(errorMsg, 'error');
    updateStatus('gesture-status', `手势状态: ${errorMsg}`);
    return false;
  }
}

/**
 * 判断拇指是否伸出，根据手别选择比较方向。
 * MediaPipe 的坐标系：图像镜像后 x 轴，右手拇指向左伸出(x减小)，左手相反。
 * 但 facingMode:'user' 已镜像，所以两者方向相同，统一用 x 轴距离判断即可，
 * 但要同时结合 wrist 到 index_mcp 的方向做归一化，避免倾斜时误判。
 */
function isThumbExtended(landmarks, isRightHand) {
  const thumbTip = landmarks[4];
  const thumbIp  = landmarks[3];
  const thumbMcp = landmarks[2];
  const wrist    = landmarks[0];
  const indexMcp = landmarks[5];

  // 手掌朝向向量（腕→食指掌骨），用于建立局部坐标系
  const palmDir = {
    x: indexMcp.x - wrist.x,
    y: indexMcp.y - wrist.y,
  };
  // 手掌法线（垂直于 palmDir，左/右手符号相反）
  const sign = isRightHand ? 1 : -1;
  const thumbDir = {
    x: thumbTip.x - thumbMcp.x,
    y: thumbTip.y - thumbMcp.y,
  };
  // 计算拇指相对于手掌方向的横向分量（叉积符号）
  const cross = palmDir.x * thumbDir.y - palmDir.y * thumbDir.x;
  // 右手：拇指向外时 cross < 0；左手相反
  return isRightHand ? cross < 0 : cross > 0;
}

function detectGesture(landmarks, isRightHand) {
  const fingerTips  = [8, 12, 16, 20];
  const fingerBases = [6, 10, 14, 18];

  let extendedFingers = 0;
  for (let i = 0; i < fingerTips.length; i++) {
    if (landmarks[fingerTips[i]].y < landmarks[fingerBases[i]].y) {
      extendedFingers++;
    }
  }

  if (isThumbExtended(landmarks, isRightHand)) extendedFingers++;

  const indexExtended  = landmarks[8].y < landmarks[6].y;
  const middleExtended = landmarks[12].y < landmarks[10].y;

  if (extendedFingers >= 4) return 'open';
  if (extendedFingers <= 1) {
    if (indexExtended && !middleExtended) return 'pointing';
    return 'closed';
  }
  if (indexExtended && !middleExtended && extendedFingers <= 2) return 'pointing';
  return 'none';
}

function handleGestureChange(gesture) {
  if (gesture === 'open') {
    updateStatus('gesture-status', '手势状态: ✋ 五指张开 - 放大');
    setTargetScale(getTargetScale() + 0.05);
    if (getIsExploded()) {
      restoreParticles();
      hidePhotos();
      deselectPhoto();
    }
  } else if (gesture === 'closed') {
    // 始终执行缩小，提供视觉反馈
    setTargetScale(getTargetScale() - 0.05);

    if (getIsExploded()) {
      updateStatus('gesture-status', '手势状态: ✊ 五指并拢 - 取消选择');
      deselectPhoto();
    } else {
      // 缩小到一定程度（< 0.7）且冷却完毕，才触发粒子爆炸
      const pct = Math.round(getTargetScale() * 100);
      updateStatus('gesture-status', `手势状态: ✊ 五指并拢 - 缩小中 ${pct}%`);

      if (getTargetScale() < 0.7 && explodeCooldown === 0) {
        explodeCooldown = 90;
        updateStatus('gesture-status', '手势状态: ✊ 五指并拢 - 粒子冲击！');
        // 爆炸时将心弹回正常大小，让照片以自然尺寸出现
        setTargetScale(1.0);
        if (explodeParticles() && hasPhotos()) {
          _scheduleShowPhotosAfterExplosion();
        } else {
          explodeParticles();
          if (!hasPhotos()) showToast('请先上传照片以体验完整效果', 'info');
        }
      }
    }
  } else if (gesture === 'pointing') {
    updateStatus('gesture-status', '手势状态: ☝️ 食指指向 - 选择/移动照片');
  }
}

let lastExplodeTickTime = 0;
let showPhotosAfterExplodeScheduled = false;

function _scheduleShowPhotosAfterExplosion() {
  if (showPhotosAfterExplodeScheduled) return;
  showPhotosAfterExplodeScheduled = true;
  const CHECK_INTERVAL_MS = 50;
  const STABLE_REQUIRED_MS = 500;

  function poll(now) {
    if (!getIsExploded()) {
      showPhotosAfterExplodeScheduled = false;
      return;
    }
    if (lastExplodeTickTime === 0) {
      lastExplodeTickTime = now;
      requestAnimationFrame(poll);
      return;
    }
    if (now - lastExplodeTickTime >= STABLE_REQUIRED_MS) {
      lastExplodeTickTime = 0;
      showPhotosAfterExplodeScheduled = false;
      showPhotos();
      return;
    }
    requestAnimationFrame(poll);
  }
  lastExplodeTickTime = 0;
  requestAnimationFrame(poll);
}

function _applyConfirmedGesture(gesture) {
  confirmedGesture = gesture;
  gestureState = gesture;
  handleGestureChange(gesture);
}

function onHandResults(results) {
  const now = performance.now();
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];

    // Fix 3：使用 MediaPipe 提供的手别标记
    // multiHandedness[0].label 为 'Right' 或 'Left'（镜像后与直觉相反，取反处理）
    const handednessLabel = results.multiHandedness?.[0]?.label ?? 'Right';
    // MediaPipe 在 facingMode:'user'（镜像）下 label 与实际手别相反
    const isRightHand = handednessLabel === 'Left';

    const indexTip = landmarks[8];
    fingerPosition.x = (1 - indexTip.x) * window.innerWidth;
    fingerPosition.y = indexTip.y * window.innerHeight;

    const gesture = detectGesture(landmarks, isRightHand);
    if (gesture !== detectedGesture) {
      detectedGesture = gesture;
      detectedAtTime = now;
    }

    if (gesture === 'pointing' && getIsExploded()) {
      handlePhotoInteraction(fingerPosition, true);
    } else {
      handlePhotoInteraction(fingerPosition, false);
    }
  } else {
    // 没有手部数据：重置检测状态
    if (detectedGesture !== 'none') {
      detectedGesture = 'none';
      detectedAtTime = now;
    }
    updateStatus('gesture-status', '手势状态: 等待检测...');
    handlePhotoInteraction(fingerPosition, false);
  }
  // 持续手势：只要确认的手势状态不是 none，每帧都执行缩放逻辑
  if (confirmedGesture !== 'none') {
    handleGestureChange(confirmedGesture);
  }
}

export function getFingerPosition() { return fingerPosition; }
export function getGestureState() { return gestureState; }
