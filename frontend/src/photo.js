import * as THREE from 'three';
import { getScene, getCamera } from './scene.js';
import { showToast } from './utils.js';

const MAX_PHOTOS = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

let photos = [];
let selectedPhoto = null;
let targetPhotoScale = 1;

export function setupFileUpload() {
  const uploadBtn = document.getElementById('upload-btn');
  const fileInput = document.getElementById('file-input');
  
  uploadBtn.addEventListener('click', () => fileInput.click());
  
  fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    
    for (let file of files) {
      // 校验文件类型
      if (!ALLOWED_TYPES.includes(file.type)) {
        showToast(`不支持的文件格式: ${file.name}`, 'error');
        continue;
      }
      
      // 校验文件大小
      if (file.size > MAX_FILE_SIZE) {
        showToast(`文件过大(最大5MB): ${file.name}`, 'error');
        continue;
      }
      
      // 校验照片数量
      if (photos.length >= MAX_PHOTOS) {
        showToast(`最多上传${MAX_PHOTOS}张照片`, 'warning');
        break;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        addPhoto(event.target.result);
        showToast('照片上传成功', 'success');
      };
      reader.onerror = () => {
        showToast(`读取文件失败: ${file.name}`, 'error');
      };
      reader.readAsDataURL(file);
    }
    fileInput.value = '';
  });
}

function addPhoto(imageUrl) {
  const scene = getScene();
  const texture = new THREE.TextureLoader().load(imageUrl);
  const geometry = new THREE.PlaneGeometry(10, 10);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(
    (Math.random() - 0.5) * 30,
    (Math.random() - 0.5) * 20,
    5
  );
  mesh.userData = {
    originalScale: 1,
    targetScale: 1,
    isPhoto: true,
    visible: false
  };
  
  scene.add(mesh);
  photos.push(mesh);
}

export function showPhotos() {
  targetPhotoScale = 2.0; // 放大效果
  photos.forEach((photo, index) => {
    photo.userData.visible = true;
    photo.userData.targetScale = 2.0;
    setTimeout(() => animatePhotoIn(photo), index * 100);
  });
}

export function hidePhotos() {
  targetPhotoScale = 1;
  photos.forEach(photo => {
    photo.userData.visible = false;
    photo.userData.targetScale = 1;
    photo.material.opacity = 0;
    photo.scale.set(1, 1, 1);
  });
  selectedPhoto = null;
}

function animatePhotoIn(photo) {
  let opacity = 0;
  const animate = () => {
    if (opacity < 1 && photo.userData.visible) {
      opacity += 0.05;
      photo.material.opacity = opacity;
      requestAnimationFrame(animate);
    }
  };
  animate();
}


export function handlePhotoInteraction(fingerPos, isPointing) {
  if (photos.length === 0) return;
  
  const camera = getCamera();
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2(
    (fingerPos.x / window.innerWidth) * 2 - 1,
    -(fingerPos.y / window.innerHeight) * 2 + 1
  );
  
  raycaster.setFromCamera(mouse, camera);
  const visiblePhotos = photos.filter(p => p.userData.visible);
  const intersects = raycaster.intersectObjects(visiblePhotos);
  
  // 重置非选中照片的高亮
  photos.forEach(p => {
    if (p !== selectedPhoto && p.userData.visible) {
      p.scale.lerp(new THREE.Vector3(p.userData.targetScale, p.userData.targetScale, 1), 0.1);
    }
  });
  
  if (isPointing) {
    // 如果没有选中照片，检测悬停并选择
    if (!selectedPhoto && intersects.length > 0) {
      selectedPhoto = intersects[0].object;
    }
    
    // 移动选中的照片
    if (selectedPhoto) {
      const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5);
      vector.unproject(camera);
      const dir = vector.sub(camera.position).normalize();
      const distance = (5 - camera.position.z) / dir.z;
      const pos = camera.position.clone().add(dir.multiplyScalar(distance));
      
      // 平滑移动
      selectedPhoto.position.x += (pos.x - selectedPhoto.position.x) * 0.15;
      selectedPhoto.position.y += (pos.y - selectedPhoto.position.y) * 0.15;
      
      // 选中状态放大
      selectedPhoto.scale.set(
        selectedPhoto.userData.targetScale * 1.2,
        selectedPhoto.userData.targetScale * 1.2,
        1
      );
    }
  }
}

export function deselectPhoto() {
  if (selectedPhoto) {
    selectedPhoto.scale.set(
      selectedPhoto.userData.targetScale,
      selectedPhoto.userData.targetScale,
      1
    );
  }
  selectedPhoto = null;
}

export function updatePhotos(time) {
  photos.forEach(photo => {
    if (photo.userData.visible) {
      // 平滑缩放到目标大小
      const target = photo.userData.targetScale;
      const current = photo.scale.x;
      if (Math.abs(current - target) > 0.01 && photo !== selectedPhoto) {
        photo.scale.lerp(new THREE.Vector3(target, target, 1), 0.05);
      }
      // 轻微浮动
      photo.rotation.y = Math.sin(time + photo.position.x) * 0.05;
    }
  });
}

export function getPhotos() { return photos; }
export function hasPhotos() { return photos.length > 0; }
