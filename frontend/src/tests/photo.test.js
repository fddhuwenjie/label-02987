import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Three.js
vi.mock('three', () => ({
  TextureLoader: vi.fn(() => ({ load: vi.fn(() => ({})) })),
  PlaneGeometry: vi.fn(),
  MeshBasicMaterial: vi.fn(() => ({ opacity: 0 })),
  Mesh: vi.fn(() => ({
    position: { set: vi.fn(), x: 0, y: 0 },
    scale: { set: vi.fn(), lerp: vi.fn(), x: 1 },
    rotation: { y: 0 },
    userData: {},
    material: { opacity: 0 }
  })),
  Vector3: vi.fn((x, y, z) => ({ 
    x, y, z, 
    lerp: vi.fn().mockReturnThis(),
    unproject: vi.fn().mockReturnThis(),
    sub: vi.fn().mockReturnThis(),
    normalize: vi.fn().mockReturnThis(),
    multiplyScalar: vi.fn().mockReturnThis(),
    clone: vi.fn().mockReturnThis(),
    add: vi.fn().mockReturnThis()
  })),
  Vector2: vi.fn(),
  Raycaster: vi.fn(() => ({
    setFromCamera: vi.fn(),
    intersectObjects: vi.fn(() => [])
  })),
  DoubleSide: 2
}));

// Mock scene module
vi.mock('../scene.js', () => ({
  getScene: vi.fn(() => ({ add: vi.fn() })),
  getCamera: vi.fn(() => ({ 
    position: { z: 50, clone: vi.fn().mockReturnThis(), add: vi.fn().mockReturnThis() }
  }))
}));

// Mock utils
vi.mock('../utils.js', () => ({
  showToast: vi.fn(),
  log: vi.fn()
}));

describe('photo', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = `
      <button id="upload-btn"></button>
      <input type="file" id="file-input" />
    `;
  });

  it('应该能导入photo模块', async () => {
    const photo = await import('../photo.js');
    expect(photo).toBeDefined();
    expect(typeof photo.setupFileUpload).toBe('function');
    expect(typeof photo.showPhotos).toBe('function');
    expect(typeof photo.hidePhotos).toBe('function');
    expect(typeof photo.handlePhotoInteraction).toBe('function');
    expect(typeof photo.deselectPhoto).toBe('function');
    expect(typeof photo.hasPhotos).toBe('function');
  });

  it('setupFileUpload应该绑定事件监听器', async () => {
    const { setupFileUpload } = await import('../photo.js');
    
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('file-input');
    
    const btnClickSpy = vi.spyOn(uploadBtn, 'addEventListener');
    const inputChangeSpy = vi.spyOn(fileInput, 'addEventListener');
    
    setupFileUpload();
    
    expect(btnClickSpy).toHaveBeenCalledWith('click', expect.any(Function));
    expect(inputChangeSpy).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('hasPhotos初始应该返回false', async () => {
    const { hasPhotos } = await import('../photo.js');
    expect(hasPhotos()).toBe(false);
  });
});
