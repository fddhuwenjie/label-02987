import * as THREE from 'three';
import { getScene, getCamera } from './scene.js';
import { getHeartScale } from './particles.js';
import { showToast } from './utils.js';

const MAX_PHOTOS = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// 爱心轮廓约为 [-16,16] x [-17,13]，留余量取 38x32
const PHOTO_WIDTH = 38;
const PHOTO_HEIGHT = 32;
// 正常嵌入时的基础透明度
const EMBED_OPACITY = 0.55;

let photos = [];
let selectedPhoto = null;
let currentPhotoIndex = 0;
let isExploded = false;

// 用 Canvas 生成心形 Alpha 遮罩贴图
function createHeartAlphaMask() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2 + size * 0.04; // 略微下移使爱心视觉居中
  const s = size / 40;              // 缩放系数，匹配参数方程范围

  ctx.fillStyle = 'white';
  ctx.beginPath();
  for (let i = 0; i <= 628; i++) {
    const t = (i / 628) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    if (i === 0) ctx.moveTo(cx + x * s, cy + y * s);
    else ctx.lineTo(cx + x * s, cy + y * s);
  }
  ctx.closePath();
  ctx.fill();

  return new THREE.CanvasTexture(canvas);
}

const heartAlphaMask = createHeartAlphaMask();

function addPhoto(imageUrl) {
  const scene = getScene();
  const texture = new THREE.TextureLoader().load(imageUrl);
  const geometry = new THREE.PlaneGeometry(PHOTO_WIDTH, PHOTO_HEIGHT);

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    alphaMap: heartAlphaMask,
    transparent: true,
    opacity: EMBED_OPACITY,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  // 嵌在爱心中心，z 轻微偏前防止 z-fighting，多张照片各自错开层
  const zOffset = 1.5 + photos.length * 0.3;
  mesh.position.set(0, 0, zOffset);

  // 微小随机旋转增加手作感
  mesh.rotation.z = (Math.random() - 0.5) * 0.08;

  mesh.userData = {
    baseOpacity: EMBED_OPACITY,
    zOffset,
    isPhoto: true,
  };

  scene.add(mesh);
  photos.push(mesh);

  // 只高亮最新上传的那张
  currentPhotoIndex = photos.length - 1;
}

// 爆炸后：照片放大到前景、全不透明
export function showPhotos() {
  isExploded = true;
  photos.forEach((photo, index) => {
    photo.userData.baseOpacity = 1.0;
    // 所有照片围绕中心扇形展开，避免完全重叠
    const angle = (index / Math.max(photos.length, 1)) * Math.PI * 2;
    const radius = photos.length > 1 ? 8 : 0;
    photo.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      photo.userData.zOffset + 2,
    );
  });
}

// 恢复：照片退回爱心中心、半透明嵌入
export function hidePhotos() {
  isExploded = false;
  photos.forEach((photo) => {
    photo.userData.baseOpacity = EMBED_OPACITY;
    photo.position.set(0, 0, photo.userData.zOffset);
  });
  selectedPhoto = null;
}

export function handlePhotoInteraction(fingerPos, isPointing) {
  if (photos.length === 0) return;

  const camera = getCamera();
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2(
    (fingerPos.x / window.innerWidth) * 2 - 1,
    -(fingerPos.y / window.innerHeight) * 2 + 1,
  );

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(photos);

  photos.forEach((p) => {
    if (p !== selectedPhoto) {
      const hs = getHeartScale();
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
      const dir = vector.sub(camera.position).normalize();
      const distance = (5 - camera.position.z) / dir.z;
      const pos = camera.position.clone().add(dir.multiplyScalar(distance));

      selectedPhoto.position.x += (pos.x - selectedPhoto.position.x) * 0.15;
      selectedPhoto.position.y += (pos.y - selectedPhoto.position.y) * 0.15;

      const hs = getHeartScale();
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

export function updatePhotos(time) {
  const hs = getHeartScale();

  photos.forEach((photo, index) => {
    // 跟随爱心缩放
    if (photo !== selectedPhoto) {
      const targetSx = hs;
      const targetSy = hs;
      photo.scale.x += (targetSx - photo.scale.x) * 0.05;
      photo.scale.y += (targetSy - photo.scale.y) * 0.05;
      photo.scale.z = 1;
    }

    // 透明度平滑过渡到目标
    const targetOpacity = photo.userData.baseOpacity;
    photo.material.opacity += (targetOpacity - photo.material.opacity) * 0.06;

    // 嵌入状态下轻微呼吸浮动
    if (!isExploded) {
      photo.rotation.z = (Math.random() - 0.5) * 0.002 + photo.rotation.z * 0.98;
      photo.position.z = photo.userData.zOffset + Math.sin(time * 0.5 + index) * 0.3;
    }
  });
}

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
        showToast('照片已植入爱心', 'success');
      };
      reader.onerror = () => {
        showToast(`读取文件失败: ${file.name}`, 'error');
      };
      reader.readAsDataURL(file);
    }
    fileInput.value = '';
  });
}

export function getPhotos() { return photos; }
export function hasPhotos() { return photos.length > 0; }
