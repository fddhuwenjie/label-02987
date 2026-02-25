import * as THREE from 'three';
import { getScene } from './scene.js';

const PARTICLE_COUNT = 15000;
let particles, particleSystem;
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

export function createParticles() {
  const scene = getScene();
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

    // 金色渐变
    const goldVariation = Math.random();
    colors[i * 3] = 1.0;
    colors[i * 3 + 1] = 0.7 + goldVariation * 0.3;
    colors[i * 3 + 2] = goldVariation * 0.3;
    
    sizes[i] = Math.random() * 2 + 0.5;
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

export function updateParticles(time) {
  if (!particleSystem) return;
  
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
}
