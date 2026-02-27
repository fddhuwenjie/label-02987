import { log, updateStatus, showToast } from './utils.js';
import { 
  explodeParticles, restoreParticles, setTargetScale, 
  getTargetScale, getIsExploded 
} from './particles.js';
import { showPhotos, hidePhotos, handlePhotoInteraction, hasPhotos, deselectPhoto } from './photo.js';

let hands = null;
let gestureState = 'none';
let fingerPosition = { x: 0, y: 0 };
let isProcessing = false;

// 动态加载 MediaPipe Hands
async function loadMediaPipeHands() {
  return new Promise((resolve, reject) => {
    // 检查是否已加载
    if (window.Hands) {
      resolve(window.Hands);
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      if (window.Hands) {
        resolve(window.Hands);
      } else {
        reject(new Error('MediaPipe Hands 加载失败'));
      }
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
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    
    hands.onResults(onHandResults);
    log('info', 'Gesture', 'MediaPipe Hands 初始化成功');
  } catch (error) {
    log('error', 'Gesture', 'MediaPipe初始化失败', error);
    showToast('手势识别初始化失败', 'error');
    updateStatus('gesture-status', '手势状态: 初始化失败');
    return false;
  }
  
  // 请求摄像头权限
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: 640, height: 480, facingMode: 'user' } 
    });
    videoElement.srcObject = stream;
    
    await new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        videoElement.play();
        resolve();
      };
    });
    
    log('info', 'Gesture', '摄像头访问成功');
    
    async function processFrame() {
      if (hands && videoElement.readyState >= 2 && !isProcessing) {
        isProcessing = true;
        try {
          await hands.send({ image: videoElement });
        } catch (e) {
          log('warn', 'Gesture', '帧处理错误', e);
        }
        isProcessing = false;
      }
      requestAnimationFrame(processFrame);
    }
    
    processFrame();
    showToast('摄像头已启动', 'success');
    return true;
    
  } catch (error) {
    log('error', 'Gesture', '摄像头访问失败', error);
    
    let errorMsg = '摄像头访问失败';
    if (error.name === 'NotAllowedError') {
      errorMsg = '请允许摄像头访问权限';
    } else if (error.name === 'NotFoundError') {
      errorMsg = '未检测到摄像头设备';
    } else if (error.name === 'NotReadableError') {
      errorMsg = '摄像头被其他程序占用';
    }
    
    showToast(errorMsg, 'error');
    updateStatus('gesture-status', `手势状态: ${errorMsg}`);
    return false;
  }
}

function detectGesture(landmarks) {
  const fingerTips = [8, 12, 16, 20];
  const fingerBases = [6, 10, 14, 18];
  const thumbTip = 4;
  const thumbBase = 2;
  
  let extendedFingers = 0;
  
  for (let i = 0; i < fingerTips.length; i++) {
    if (landmarks[fingerTips[i]].y < landmarks[fingerBases[i]].y) {
      extendedFingers++;
    }
  }
  
  const thumbExtended = landmarks[thumbTip].x < landmarks[thumbBase].x;
  if (thumbExtended) extendedFingers++;
  
  const indexExtended = landmarks[8].y < landmarks[6].y;
  const middleExtended = landmarks[12].y < landmarks[10].y;
  
  if (extendedFingers >= 4) {
    return 'open';
  } else if (extendedFingers <= 1) {
    if (indexExtended && !middleExtended) {
      return 'pointing';
    }
    return 'closed';
  } else if (indexExtended && !middleExtended && extendedFingers <= 2) {
    return 'pointing';
  }
  
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
    updateStatus('gesture-status', '手势状态: ✊ 五指并拢 - 缩小/取消选择');
    if (getIsExploded()) {
      deselectPhoto();
    } else {
      setTargetScale(getTargetScale() - 0.05);
      if (getTargetScale() < 0.5 && !getIsExploded()) {
        if (explodeParticles() && hasPhotos()) {
          setTimeout(() => showPhotos(), 500);
        }
      }
    }
  } else if (gesture === 'pointing') {
    updateStatus('gesture-status', '手势状态: ☝️ 食指指向 - 选择/移动照片');
  }
}

function onHandResults(results) {
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    
    const indexTip = landmarks[8];
    fingerPosition.x = (1 - indexTip.x) * window.innerWidth;
    fingerPosition.y = indexTip.y * window.innerHeight;
    
    const gesture = detectGesture(landmarks);
    gestureState = gesture;
    handleGestureChange(gesture);
    
    if (gesture === 'pointing' && getIsExploded()) {
      handlePhotoInteraction(fingerPosition, true);
    } else {
      handlePhotoInteraction(fingerPosition, false);
    }
  } else {
    updateStatus('gesture-status', '手势状态: 等待检测...');
    handlePhotoInteraction(fingerPosition, false);
  }
}

export function getFingerPosition() { return fingerPosition; }
export function getGestureState() { return gestureState; }
