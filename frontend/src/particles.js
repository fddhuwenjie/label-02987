import * as THREE from 'three';
import { getScene } from './scene.js';

const PARTICLE_COUNT = 15000;
const STAR_COUNT = 3000;
const SPARKLE_COUNT = 500;

let particles, particleSystem;
let starSystem, sparkleSystem;
let heartScale = 1;
let targetScale = 1;
let isExploded = false;

// 生成爱心形状的点
function heartShape(t, scale = 1) {
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  const z = (Math.random() - 0.5) * 4;
  return new THREE.Vector3(x * scale, y * scale, z * scale);
}

// 创建背景星星粒子
function createStarParticles() {
  const scene = getScene();
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const sizes = new Float32Array(STAR_COUNT);
  const twinklePhase = new Float32Array(STAR_COUNT);
  
  for (let i = 0; i < STAR_COUNT; i++) {
    // 分布在更大的空间范围
    positions[i * 3] = (Math.random() - 0.5) * 200;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 150;
    positions[i * 3 + 2] = -20 - Math.random() * 80;
    
    // 金色调星星
    const brightness = 0.5 + Math.random() * 0.5;
    colors[i * 3] = brightness;
    colors[i * 3 + 1] = brightness * (0.7 + Math.random() * 0.3);
    colors[i * 3 + 2] = brightness * Math.random() * 0.3;
    
    sizes[i] = Math.random() * 3 + 0.5;
    twinklePhase[i] = Math.random() * Math.PI * 2;
  }
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('twinklePhase', new THREE.BufferAttribute(twinklePhase, 1));
  
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      attribute float twinklePhase;
      varying vec3 vColor;
      varying float vTwinkle;
      uniform float time;
      
      void main() {
        vColor = color;
        vTwinkle = 0.5 + 0.5 * sin(time * 2.0 + twinklePhase);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (200.0 / -mvPosition.z) * vTwinkle;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = (1.0 - dist * 2.0) * vTwinkle;
        gl_FragColor = vec4(vColor * 1.5, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  
  starSystem = new THREE.Points(geometry, material);
  scene.add(starSystem);
}

// 创建闪烁光点粒子
function createSparkleParticles() {
  const scene = getScene();
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(SPARKLE_COUNT * 3);
  const colors = new Float32Array(SPARKLE_COUNT * 3);
  const sizes = new Float32Array(SPARKLE_COUNT);
  const velocities = new Float32Array(SPARKLE_COUNT * 3);
  const lifetimes = new Float32Array(SPARKLE_COUNT);
  
  for (let i = 0; i < SPARKLE_COUNT; i++) {
    resetSparkle(positions, velocities, lifetimes, colors, sizes, i);
  }
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
  geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
  
  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      attribute float lifetime;
      varying vec3 vColor;
      varying float vAlpha;
      
      void main() {
        vColor = color;
        vAlpha = lifetime;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z) * lifetime;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float glow = 1.0 - smoothstep(0.0, 0.5, dist);
        gl_FragColor = vec4(vColor * 2.0, glow * vAlpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  
  sparkleSystem = new THREE.Points(geometry, material);
  scene.add(sparkleSystem);
}

function resetSparkle(positions, velocities, lifetimes, colors, sizes, i) {
  // 从爱心周围生成
  const t = Math.random() * Math.PI * 2;
  const point = heartShape(t, 1.2);
  
  positions[i * 3] = point.x + (Math.random() - 0.5) * 5;
  positions[i * 3 + 1] = point.y + (Math.random() - 0.5) * 5;
  positions[i * 3 + 2] = point.z + (Math.random() - 0.5) * 5;
  
  velocities[i * 3] = (Math.random() - 0.5) * 0.5;
  velocities[i * 3 + 1] = Math.random() * 0.3 + 0.1;
  velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
  
  lifetimes[i] = 1.0;
  
  // 金色/白色闪光
  const isGold = Math.random() > 0.3;
  if (isGold) {
    colors[i * 3] = 1.0;
    colors[i * 3 + 1] = 0.8 + Math.random() * 0.2;
    colors[i * 3 + 2] = 0.2 + Math.random() * 0.3;
  } else {
    colors[i * 3] = 1.0;
    colors[i * 3 + 1] = 1.0;
    colors[i * 3 + 2] = 0.9;
  }
  
  sizes[i] = Math.random() * 4 + 2;
}

export function createParticles() {
  const scene = getScene();
  
  // 创建背景粒子
  createStarParticles();
  createSparkleParticles();
  
  // 创建主爱心粒子
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const originalPositions = new Float32Array(PARTICLE_COUNT * 3);
  const velocities = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const t = (i / PARTICLE_COUNT) * Math.PI * 2;
    const point = heartShape(t, 1);
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 3
    );
    
    positions[i * 3] = point.x + offset.x;
    positions[i * 3 + 1] = point.y + offset.y;
    positions[i * 3 + 2] = point.z + offset.z;
    
    originalPositions[i * 3] = positions[i * 3];
    originalPositions[i * 3 + 1] = positions[i * 3 + 1];
    originalPositions[i * 3 + 2] = positions[i * 3 + 2];
    
    velocities[i * 3] = 0;
    velocities[i * 3 + 1] = 0;
    velocities[i * 3 + 2] = 0;

    // 金色渐变 - 增强电影质感
    const goldVariation = Math.random();
    const depth = Math.random();
    colors[i * 3] = 1.0;
    colors[i * 3 + 1] = 0.65 + goldVariation * 0.35;
    colors[i * 3 + 2] = depth * 0.25;
    
    sizes[i] = Math.random() * 2.5 + 0.5;
  }
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('originalPosition', new THREE.BufferAttribute(originalPositions, 3));
  geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
  
  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      scale: { value: 1 }
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      uniform float time;
      uniform float scale;
      
      void main() {
        vColor = color;
        vec3 pos = position * scale;
        pos.x += sin(time + position.y * 0.5) * 0.1;
        pos.y += cos(time + position.x * 0.5) * 0.1;
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z) * scale;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
        vec3 glow = vColor * (1.0 + 0.5 * (1.0 - dist * 2.0));
        gl_FragColor = vec4(glow, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  
  particleSystem = new THREE.Points(geometry, material);
  scene.add(particleSystem);
  particles = geometry;
}

export function explodeParticles() {
  if (isExploded) return false;
  isExploded = true;
  
  const positions = particles.getAttribute('position');
  const velocities = particles.getAttribute('velocity');
  
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const x = positions.array[i * 3];
    const y = positions.array[i * 3 + 1];
    const z = positions.array[i * 3 + 2];
    
    const direction = new THREE.Vector3(x, y, z).normalize();
    const speed = 2 + Math.random() * 3;
    
    velocities.array[i * 3] = direction.x * speed;
    velocities.array[i * 3 + 1] = direction.y * speed;
    velocities.array[i * 3 + 2] = direction.z * speed;
  }
  velocities.needsUpdate = true;
  return true;
}

export function restoreParticles() {
  isExploded = false;
}

export function setTargetScale(scale) {
  targetScale = Math.max(0.3, Math.min(2.5, scale));
}

export function getTargetScale() { return targetScale; }
export function getIsExploded() { return isExploded; }
export function getHeartScale() { return heartScale; }

export function updateParticles(time) {
  if (!particleSystem) return;
  
  // 更新主爱心粒子
  particleSystem.material.uniforms.time.value = time;
  heartScale += (targetScale - heartScale) * 0.05;
  particleSystem.material.uniforms.scale.value = heartScale;
  
  const positions = particles.getAttribute('position');
  const velocities = particles.getAttribute('velocity');
  const originalPositions = particles.getAttribute('originalPosition');
  
  if (isExploded) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions.array[i * 3] += velocities.array[i * 3] * 0.1;
      positions.array[i * 3 + 1] += velocities.array[i * 3 + 1] * 0.1;
      positions.array[i * 3 + 2] += velocities.array[i * 3 + 2] * 0.1;
      velocities.array[i * 3] *= 0.98;
      velocities.array[i * 3 + 1] *= 0.98;
      velocities.array[i * 3 + 2] *= 0.98;
    }
  } else {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions.array[i * 3] += (originalPositions.array[i * 3] - positions.array[i * 3]) * 0.02;
      positions.array[i * 3 + 1] += (originalPositions.array[i * 3 + 1] - positions.array[i * 3 + 1]) * 0.02;
      positions.array[i * 3 + 2] += (originalPositions.array[i * 3 + 2] - positions.array[i * 3 + 2]) * 0.02;
    }
  }
  positions.needsUpdate = true;
  particleSystem.rotation.y = Math.sin(time * 0.2) * 0.1;
  
  // 更新背景星星
  if (starSystem) {
    starSystem.material.uniforms.time.value = time;
    starSystem.rotation.y = time * 0.01;
  }
  
  // 更新闪烁光点
  if (sparkleSystem) {
    sparkleSystem.material.uniforms.time.value = time;
    const sparklePos = sparkleSystem.geometry.getAttribute('position');
    const sparkleVel = sparkleSystem.geometry.getAttribute('velocity');
    const sparkleLife = sparkleSystem.geometry.getAttribute('lifetime');
    const sparkleColors = sparkleSystem.geometry.getAttribute('color');
    const sparkleSizes = sparkleSystem.geometry.getAttribute('size');
    
    for (let i = 0; i < SPARKLE_COUNT; i++) {
      sparklePos.array[i * 3] += sparkleVel.array[i * 3];
      sparklePos.array[i * 3 + 1] += sparkleVel.array[i * 3 + 1];
      sparklePos.array[i * 3 + 2] += sparkleVel.array[i * 3 + 2];
      
      sparkleLife.array[i] -= 0.008;
      
      if (sparkleLife.array[i] <= 0) {
        resetSparkle(sparklePos.array, sparkleVel.array, sparkleLife.array, 
                     sparkleColors.array, sparkleSizes.array, i);
      }
    }
    sparklePos.needsUpdate = true;
    sparkleLife.needsUpdate = true;
  }
}
