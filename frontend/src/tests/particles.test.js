import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Three.js with class constructors
vi.mock('three', () => {
  class MockBufferGeometry {
    constructor() {
      this.attributes = {};
    }
    setAttribute(name, attr) {
      this.attributes[name] = attr;
    }
    getAttribute(name) {
      return this.attributes[name] || {
        array: new Float32Array(100),
        needsUpdate: false
      };
    }
  }
  
  class MockBufferAttribute {
    constructor(array, itemSize) {
      this.array = array;
      this.itemSize = itemSize;
      this.needsUpdate = false;
    }
  }
  
  return {
    Scene: vi.fn().mockImplementation(function() { this.add = vi.fn(); }),
    PerspectiveCamera: vi.fn().mockImplementation(function() { 
      this.position = { z: 0 }; 
      this.aspect = 1; 
      this.updateProjectionMatrix = vi.fn(); 
    }),
    WebGLRenderer: vi.fn().mockImplementation(function() { 
      this.setSize = vi.fn(); 
      this.setPixelRatio = vi.fn(); 
      this.domElement = document.createElement('canvas');
      this.render = vi.fn();
    }),
    AmbientLight: vi.fn().mockImplementation(function() {}),
    PointLight: vi.fn().mockImplementation(function() { 
      this.position = { set: vi.fn() }; 
    }),
    BufferGeometry: MockBufferGeometry,
    BufferAttribute: MockBufferAttribute,
    ShaderMaterial: vi.fn().mockImplementation(function() {
      this.uniforms = { time: { value: 0 }, scale: { value: 1 } };
    }),
    Points: vi.fn().mockImplementation(function() {
      this.material = { uniforms: { time: { value: 0 }, scale: { value: 1 } } };
      this.rotation = { y: 0 };
    }),
    Vector3: vi.fn().mockImplementation(function(x, y, z) { 
      this.x = x; this.y = y; this.z = z;
      this.normalize = vi.fn().mockReturnThis();
    }),
    Color: vi.fn().mockImplementation(function() {}),
    AdditiveBlending: 1
  };
});

// Mock scene module
vi.mock('../scene.js', () => ({
  getScene: vi.fn(() => ({ add: vi.fn() })),
  getCamera: vi.fn(() => ({ position: { z: 50 } })),
  getRenderer: vi.fn(() => ({ render: vi.fn() }))
}));

describe('particles', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('应该能导入particles模块', async () => {
    const particles = await import('../particles.js');
    expect(particles).toBeDefined();
    expect(typeof particles.createParticles).toBe('function');
    expect(typeof particles.explodeParticles).toBe('function');
    expect(typeof particles.restoreParticles).toBe('function');
    expect(typeof particles.setTargetScale).toBe('function');
    expect(typeof particles.getTargetScale).toBe('function');
    expect(typeof particles.getIsExploded).toBe('function');
    expect(typeof particles.updateParticles).toBe('function');
  });

  it('setTargetScale应该限制在0.3-2.5范围内', async () => {
    const { setTargetScale, getTargetScale } = await import('../particles.js');
    
    setTargetScale(0.1);
    expect(getTargetScale()).toBe(0.3);
    
    setTargetScale(3.0);
    expect(getTargetScale()).toBe(2.5);
    
    setTargetScale(1.5);
    expect(getTargetScale()).toBe(1.5);
  });

  it('explodeParticles应该设置isExploded为true', async () => {
    const { createParticles, explodeParticles, getIsExploded, restoreParticles } = await import('../particles.js');
    
    createParticles();
    expect(getIsExploded()).toBe(false);
    
    explodeParticles();
    expect(getIsExploded()).toBe(true);
    
    restoreParticles();
    expect(getIsExploded()).toBe(false);
  });

  it('重复调用explodeParticles应该返回false', async () => {
    const { createParticles, explodeParticles, restoreParticles } = await import('../particles.js');
    
    createParticles();
    expect(explodeParticles()).toBe(true);
    expect(explodeParticles()).toBe(false);
    
    restoreParticles();
  });
});
