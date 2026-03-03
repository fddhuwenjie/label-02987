import * as THREE from 'three';
import { getScene, getCamera } from './scene.js';
import { getHeartScale, triggerPhotoEmbedBurst } from './particles.js';
import { showToast } from './utils.js';

const MAX_PHOTOS = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// 爱心轮廓约为 [-16,16] x [-17,13]，留余量
const PHOTO_WIDTH  = 38;
const PHOTO_HEIGHT = 32;
const EMBED_OPACITY = 0.90;

let photos = [];
let selectedPhoto = null;
let isExploded = false;

// ── 心形 Alpha 遮罩（一次生成，所有照片共用）─────────────────
function createHeartAlphaMask() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2 + size * 0.04;
  const s  = size / 40;

  ctx.fillStyle = 'white';
  ctx.beginPath();
  for (let i = 0; i <= 628; i++) {
    const t = (i / 628) * Math.PI * 2;
    const x =  16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    if (i === 0) ctx.moveTo(cx + x * s, cy + y * s);
    else          ctx.lineTo(cx + x * s, cy + y * s);
  }
  ctx.closePath();
  ctx.fill();

  return new THREE.CanvasTexture(canvas);
}

const heartAlphaMask = createHeartAlphaMask();

// ── 添加照片 ─────────────────────────────────────────────────
function addPhoto(imageUrl) {
  const scene = getScene();

  // 立刻用金色占位材质开始入场动画，给用户即时反馈
  const material = new THREE.MeshBasicMaterial({
    alphaMap: heartAlphaMask,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    color: new THREE.Color(0xffd700),  // 金色占位，纹理就绪前可见
  });

  const geometry = new THREE.PlaneGeometry(PHOTO_WIDTH, PHOTO_HEIGHT);
  const mesh = new THREE.Mesh(geometry, material);

  const zOffset = 1.5 + photos.length * 0.3;
  mesh.position.set(0, 0, zOffset);
  mesh.scale.set(0.05, 0.05, 1);
  mesh.rotation.z = (Math.random() - 0.5) * 0.08;

  mesh.userData = {
    baseOpacity: EMBED_OPACITY,
    zOffset,
    isPhoto: true,
    entering: true,       // 立即开始入场，无需等待纹理
    enterT: 0,
    textureReady: false,
    flashT: 0,            // 纹理就绪后的亮度脉冲进度 (1→0)
  };

  scene.add(mesh);
  photos.push(mesh);

  new THREE.TextureLoader().load(
    imageUrl,
    (texture) => {
      material.map   = texture;
      material.color = new THREE.Color(0xffffff);
      material.needsUpdate = true;
      mesh.userData.textureReady = true;
      mesh.userData.flashT = 1.0;   // 触发亮度脉冲
      triggerPhotoEmbedBurst();     // 粒子汇聚特效
    },
    undefined,
    () => showToast('纹理加载失败', 'error'),
  );
}

// ── 爆炸后展开 ───────────────────────────────────────────────
export function showPhotos() {
  isExploded = true;
  photos.forEach((photo, index) => {
    photo.userData.baseOpacity = 1.0;
    const angle  = (index / Math.max(photos.length, 1)) * Math.PI * 2;
    const radius = photos.length > 1 ? 10 : 0;
    photo.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      photo.userData.zOffset + 3,
    );
  });
}

// ── 恢复嵌入 ─────────────────────────────────────────────────
export function hidePhotos() {
  isExploded = false;
  photos.forEach((photo) => {
    photo.userData.baseOpacity = EMBED_OPACITY;
    photo.position.set(0, 0, photo.userData.zOffset);
  });
  selectedPhoto = null;
}

// ── 食指拖拽交互 ─────────────────────────────────────────────
export function handlePhotoInteraction(fingerPos, isPointing) {
  if (photos.length === 0) return;

  const camera   = getCamera();
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2(
    (fingerPos.x / window.innerWidth)  *  2 - 1,
    -(fingerPos.y / window.innerHeight) * 2 + 1,
  );

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(photos);

  const hs = getHeartScale();
  photos.forEach((p) => {
    if (p !== selectedPhoto) {
      p.scale.lerp(new THREE.Vector3(hs, hs, 1), 0.1);
    }
  });

  if (isPointing) {
    if (!selectedPhoto && intersects.length > 0) {
      selectedPhoto = intersects[0].object;
    }
    if (selectedPhoto) {
      const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5);
      vector.unproject(camera);
      const dir      = vector.sub(camera.position).normalize();
      const distance = (5 - camera.position.z) / dir.z;
      const pos      = camera.position.clone().add(dir.multiplyScalar(distance));

      selectedPhoto.position.x += (pos.x - selectedPhoto.position.x) * 0.15;
      selectedPhoto.position.y += (pos.y - selectedPhoto.position.y) * 0.15;
      selectedPhoto.scale.set(hs * 1.3, hs * 1.3, 1);
    }
  }
}

export function deselectPhoto() {
  if (selectedPhoto) {
    const hs = getHeartScale();
    selectedPhoto.scale.set(hs, hs, 1);
  }
  selectedPhoto = null;
}

// ── 每帧更新 ─────────────────────────────────────────────────
export function updatePhotos(time) {
  const hs = getHeartScale();

  photos.forEach((photo, index) => {
    // ── 入场弹入动画（占位阶段也播放，让用户立刻看到反馈）───────
    if (photo.userData.entering) {
      photo.userData.enterT += 0.04;
      const t = Math.min(photo.userData.enterT, 1);

      // 弹性缓出：先过冲到 1.3 再回落到 1.0
      const overshoot = t < 0.7
        ? easeOutCubic(t / 0.7) * 1.3 * hs
        : hs * (1.3 - 0.3 * easeOutCubic((t - 0.7) / 0.3));

      photo.scale.set(overshoot, overshoot, 1);
      // 占位阶段用较低透明度，纹理就绪后用完整透明度
      const targetOp = photo.userData.textureReady ? EMBED_OPACITY : 0.45;
      photo.material.opacity = targetOp * easeOutCubic(t);

      if (t >= 1) {
        photo.userData.entering = false;
        photo.scale.set(hs, hs, 1);
        photo.material.opacity = photo.userData.textureReady ? EMBED_OPACITY : 0.45;
      }
      return;
    }

    // ── 纹理就绪后亮度脉冲 ──────────────────────────────────
    if (photo.userData.flashT > 0) {
      photo.userData.flashT = Math.max(0, photo.userData.flashT - 0.04);
      const flash = photo.userData.flashT;
      photo.material.opacity = EMBED_OPACITY + flash * (1 - EMBED_OPACITY);
      return;
    }

    // ── 常规更新：跟随爱心缩放 ──────────────────────────────
    if (photo !== selectedPhoto) {
      photo.scale.x += (hs - photo.scale.x) * 0.06;
      photo.scale.y += (hs - photo.scale.y) * 0.06;
      photo.scale.z  = 1;
    }

    // 透明度平滑过渡
    const targetOp = photo.userData.baseOpacity;
    photo.material.opacity += (targetOp - photo.material.opacity) * 0.08;

    // 嵌入状态下轻微呼吸浮动
    if (!isExploded) {
      photo.rotation.z  = photo.rotation.z * 0.98 + (Math.random() - 0.5) * 0.002;
      photo.position.z  = photo.userData.zOffset + Math.sin(time * 0.5 + index) * 0.3;
    }
  });
}

// 三次缓出曲线
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// ── 文件上传 ─────────────────────────────────────────────────
export function setupFileUpload() {
  const uploadBtn = document.getElementById('upload-btn');
  const fileInput = document.getElementById('file-input');

  uploadBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const files = e.target.files;

    for (let file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        showToast(`不支持的文件格式: ${file.name}`, 'error');
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        showToast(`文件过大(最大5MB): ${file.name}`, 'error');
        continue;
      }
      if (photos.length >= MAX_PHOTOS) {
        showToast(`最多上传${MAX_PHOTOS}张照片`, 'warning');
        break;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        addPhoto(event.target.result);
        showToast('照片已植入爱心，正在显现…', 'success');
      };
      reader.onerror = () => showToast(`读取文件失败: ${file.name}`, 'error');
      reader.readAsDataURL(file);
    }
    fileInput.value = '';
  });
}

export function getPhotos()  { return photos; }
export function hasPhotos()  { return photos.length > 0; }
