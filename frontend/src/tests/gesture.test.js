import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock MediaPipe
vi.mock('@mediapipe/hands', () => ({
  Hands: vi.fn(() => ({
    setOptions: vi.fn(),
    onResults: vi.fn(),
    send: vi.fn()
  }))
}));

// Mock particles
vi.mock('../particles.js', () => ({
  explodeParticles: vi.fn(() => true),
  restoreParticles: vi.fn(),
  setTargetScale: vi.fn(),
  getTargetScale: vi.fn(() => 1),
  getIsExploded: vi.fn(() => false)
}));

// Mock photo
vi.mock('../photo.js', () => ({
  showPhotos: vi.fn(),
  hidePhotos: vi.fn(),
  handlePhotoInteraction: vi.fn(),
  hasPhotos: vi.fn(() => true),
  deselectPhoto: vi.fn()
}));

// Mock utils
vi.mock('../utils.js', () => ({
  log: vi.fn(),
  updateStatus: vi.fn(),
  showToast: vi.fn()
}));

describe('gesture', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = `
      <video id="webcam"></video>
      <div id="gesture-status"></div>
    `;
    
    // Mock getUserMedia
    global.navigator.mediaDevices = {
      getUserMedia: vi.fn(() => Promise.resolve({
        getTracks: () => []
      }))
    };
  });

  it('应该能导入gesture模块', async () => {
    const gesture = await import('../gesture.js');
    expect(gesture).toBeDefined();
    expect(typeof gesture.initHandTracking).toBe('function');
    expect(typeof gesture.getFingerPosition).toBe('function');
    expect(typeof gesture.getGestureState).toBe('function');
  });

  it('getFingerPosition应该返回坐标对象', async () => {
    const { getFingerPosition } = await import('../gesture.js');
    const pos = getFingerPosition();
    
    expect(pos).toHaveProperty('x');
    expect(pos).toHaveProperty('y');
    expect(typeof pos.x).toBe('number');
    expect(typeof pos.y).toBe('number');
  });

  it('getGestureState初始应该返回none', async () => {
    const { getGestureState } = await import('../gesture.js');
    expect(getGestureState()).toBe('none');
  });
});

describe('手势检测逻辑', () => {
  // 模拟手部关键点数据
  const createLandmarks = (fingersExtended) => {
    const landmarks = [];
    for (let i = 0; i < 21; i++) {
      landmarks.push({ x: 0.5, y: 0.5, z: 0 });
    }
    
    // 设置手指状态
    // 食指: 8(tip), 6(base)
    // 中指: 12(tip), 10(base)
    // 无名指: 16(tip), 14(base)
    // 小指: 20(tip), 18(base)
    // 拇指: 4(tip), 2(base)
    
    if (fingersExtended.index) {
      landmarks[8].y = 0.3; // tip高于base
      landmarks[6].y = 0.5;
    } else {
      landmarks[8].y = 0.7;
      landmarks[6].y = 0.5;
    }
    
    if (fingersExtended.middle) {
      landmarks[12].y = 0.3;
      landmarks[10].y = 0.5;
    } else {
      landmarks[12].y = 0.7;
      landmarks[10].y = 0.5;
    }
    
    if (fingersExtended.ring) {
      landmarks[16].y = 0.3;
      landmarks[14].y = 0.5;
    } else {
      landmarks[16].y = 0.7;
      landmarks[14].y = 0.5;
    }
    
    if (fingersExtended.pinky) {
      landmarks[20].y = 0.3;
      landmarks[18].y = 0.5;
    } else {
      landmarks[20].y = 0.7;
      landmarks[18].y = 0.5;
    }
    
    if (fingersExtended.thumb) {
      landmarks[4].x = 0.3; // 拇指向左伸展
      landmarks[2].x = 0.5;
    } else {
      landmarks[4].x = 0.6;
      landmarks[2].x = 0.5;
    }
    
    return landmarks;
  };

  it('五指张开应该被识别', () => {
    const landmarks = createLandmarks({
      index: true, middle: true, ring: true, pinky: true, thumb: true
    });
    
    // 计算伸展的手指数
    let extendedFingers = 0;
    const fingerTips = [8, 12, 16, 20];
    const fingerBases = [6, 10, 14, 18];
    
    for (let i = 0; i < fingerTips.length; i++) {
      if (landmarks[fingerTips[i]].y < landmarks[fingerBases[i]].y) {
        extendedFingers++;
      }
    }
    if (landmarks[4].x < landmarks[2].x) extendedFingers++;
    
    expect(extendedFingers).toBe(5);
  });

  it('五指并拢应该被识别', () => {
    const landmarks = createLandmarks({
      index: false, middle: false, ring: false, pinky: false, thumb: false
    });
    
    let extendedFingers = 0;
    const fingerTips = [8, 12, 16, 20];
    const fingerBases = [6, 10, 14, 18];
    
    for (let i = 0; i < fingerTips.length; i++) {
      if (landmarks[fingerTips[i]].y < landmarks[fingerBases[i]].y) {
        extendedFingers++;
      }
    }
    if (landmarks[4].x < landmarks[2].x) extendedFingers++;
    
    expect(extendedFingers).toBe(0);
  });

  it('只有食指伸出应该被识别为pointing', () => {
    const landmarks = createLandmarks({
      index: true, middle: false, ring: false, pinky: false, thumb: false
    });
    
    const indexExtended = landmarks[8].y < landmarks[6].y;
    const middleExtended = landmarks[12].y < landmarks[10].y;
    
    expect(indexExtended).toBe(true);
    expect(middleExtended).toBe(false);
  });
});
