import { initScene, renderScene } from './scene.js';
import { createParticles, updateParticles } from './particles.js';
import { setupFileUpload, updatePhotos } from './photo.js';
import { initHandTracking } from './gesture.js';
import { log, showToast, initToast } from './utils.js';

let time = 0;

function animate() {
  requestAnimationFrame(animate);
  time += 0.01;
  
  updateParticles(time);
  updatePhotos(time);
  
  renderScene();
}

async function init() {
  log('info', 'App', '应用初始化开始');
  
  try {
    initToast();
    initScene();
    log('info', 'App', '场景初始化完成');
    
    createParticles();
    log('info', 'App', '粒子系统创建完成');
    
    setupFileUpload();
    log('info', 'App', '文件上传模块初始化完成');
    
    document.getElementById('loading').style.display = 'none';
    
    const gestureReady = await initHandTracking();
    if (gestureReady) {
      log('info', 'App', '手势追踪初始化完成');
    } else {
      log('warn', 'App', '手势追踪初始化失败（请检查摄像头权限或网络连接），照片上传等基本功能仍可正常使用');
      showToast('手势识别不可用，请检查摄像头权限或网络连接', 'warn');
    }
    
    animate();
    log('info', 'App', '应用启动成功');
    
  } catch (error) {
    log('error', 'App', '应用初始化失败', error);
    showToast('应用初始化失败，请刷新页面', 'error');
    document.getElementById('loading').textContent = '加载失败，请刷新页面';
  }
}

init();
