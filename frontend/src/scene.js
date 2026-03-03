import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// 粒子系统启用此 Layer 参与 Bloom；照片、UI 等保持 Layer 0 不参与
export const BLOOM_LAYER = 1;
const BLOOM_MASK = 1 << BLOOM_LAYER;

const _darkMat  = new THREE.MeshBasicMaterial({ color: 0x000000 });
const _matStore = new Map();

let scene, camera, renderer;
let bloomComposer, finalComposer;

export function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 50;

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  document.getElementById('canvas-container').appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
  scene.add(ambientLight);
  const pointLight1 = new THREE.PointLight(0xffd700, 2, 100);
  pointLight1.position.set(20, 20, 20);
  scene.add(pointLight1);
  const pointLight2 = new THREE.PointLight(0xff8c00, 1.5, 100);
  pointLight2.position.set(-20, -20, 20);
  scene.add(pointLight2);

  // ── Pass 1: Bloom composer（只渲染粒子层，输出到离屏 RT）──────
  bloomComposer = new EffectComposer(renderer);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(new RenderPass(scene, camera));
  bloomComposer.addPass(new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.4,   // strength：增强发光强度
    0.6,   // radius：扩大光晕扩散范围
    0.18,  // threshold：降低阈值，让更多粒子参与发光
  ));

  // ── Pass 2: Final composer（全场景 + 叠加 Bloom 结果）─────────
  finalComposer = new EffectComposer(renderer);
  finalComposer.addPass(new RenderPass(scene, camera));

  const mixPass = new ShaderPass({
    uniforms: {
      baseTexture:  { value: null },
      bloomTexture: { value: bloomComposer.renderTarget2.texture },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D baseTexture;
      uniform sampler2D bloomTexture;
      varying vec2 vUv;
      void main() {
        // 叠加 bloom，base 照片/UI 层不受影响
        gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv);
      }
    `,
  }, 'baseTexture');
  mixPass.needsSwap = true;
  finalComposer.addPass(mixPass);
  finalComposer.addPass(new OutputPass());

  window.addEventListener('resize', onWindowResize);

  return { scene, camera, renderer };
}

/**
 * 选择性 Bloom 渲染：
 *   1. 把非 Bloom 层对象暂时换成黑色材质
 *   2. bloomComposer 渲染（只留下粒子的发光结果到离屏贴图）
 *   3. 恢复所有材质
 *   4. finalComposer 渲染完整场景并叠加 bloom 贴图
 */
export function renderScene() {
  // Step 1 — 遮蔽非 Bloom 对象
  scene.traverse((obj) => {
    if (obj.isMesh && !(obj.layers.mask & BLOOM_MASK)) {
      _matStore.set(obj.uuid, obj.material);
      obj.material = _darkMat;
    }
  });

  // Step 2 — 渲染 Bloom 到离屏 RT
  bloomComposer.render();

  // Step 3 — 恢复材质
  scene.traverse((obj) => {
    const saved = _matStore.get(obj.uuid);
    if (saved) {
      obj.material = saved;
      _matStore.delete(obj.uuid);
    }
  });

  // Step 4 — 渲染完整场景 + 叠加 Bloom
  finalComposer.render();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  bloomComposer.setSize(window.innerWidth, window.innerHeight);
  finalComposer.setSize(window.innerWidth, window.innerHeight);
}

export function getScene()    { return scene; }
export function getCamera()   { return camera; }
export function getRenderer() { return renderer; }
