import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

let scene, camera, renderer, composer;

export function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 50;

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // 启用色调映射以配合 Bloom 的 HDR 输出
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  document.getElementById('canvas-container').appendChild(renderer.domElement);

  // 光源
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
  scene.add(ambientLight);
  const pointLight1 = new THREE.PointLight(0xffd700, 2, 100);
  pointLight1.position.set(20, 20, 20);
  scene.add(pointLight1);
  const pointLight2 = new THREE.PointLight(0xff8c00, 1.5, 100);
  pointLight2.position.set(-20, -20, 20);
  scene.add(pointLight2);

  // ── 后期处理链 ──────────────────────────────────────────────
  composer = new EffectComposer(renderer);

  // 1. 基础渲染
  composer.addPass(new RenderPass(scene, camera));

  // 2. Bloom（强度/半径/阈值可按视觉微调）
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.4,   // strength
    0.6,   // radius
    0.1,   // threshold：发光阈值，粒子亮度 >0.1 时产生光晕
  );
  composer.addPass(bloomPass);

  // 3. 色调/gamma 输出（替代旧 GammaCorrectionShader）
  composer.addPass(new OutputPass());
  // ────────────────────────────────────────────────────────────

  window.addEventListener('resize', onWindowResize);

  return { scene, camera, renderer, composer };
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}

export function getScene()    { return scene; }
export function getCamera()   { return camera; }
export function getRenderer() { return renderer; }
export function getComposer() { return composer; }
