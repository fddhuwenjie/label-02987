import * as THREE from 'three';

let scene, camera, renderer;

export function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 50;
  
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.getElementById('canvas-container').appendChild(renderer.domElement);
  
  // 环境光和点光源增加电影质感
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
  scene.add(ambientLight);
  
  const pointLight1 = new THREE.PointLight(0xffd700, 2, 100);
  pointLight1.position.set(20, 20, 20);
  scene.add(pointLight1);
  
  const pointLight2 = new THREE.PointLight(0xff8c00, 1.5, 100);
  pointLight2.position.set(-20, -20, 20);
  scene.add(pointLight2);
  
  window.addEventListener('resize', onWindowResize);
  
  return { scene, camera, renderer };
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

export function getScene() { return scene; }
export function getCamera() { return camera; }
export function getRenderer() { return renderer; }
