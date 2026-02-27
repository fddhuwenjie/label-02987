# 3D粒子爱心交互系统

## How to Run

### Docker启动
```bash
# 构建并启动
docker-compose up --build -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

访问地址: http://localhost:8081

### 本地启动
```bash
cd frontend
npm install
npm run dev
```

访问地址: http://localhost:8081

## Services

| 服务 | 端口 | 描述 |
|------|------|------|
| frontend | 8081 | 3D粒子爱心前端应用 |

## 测试账号

本项目为纯前端应用，无需登录账号。

## 题目内容

创建一个3d粒子交互的爱心动态图，可以植入照片 其他元素要求较多的粒子组成，主题颜色成金色有电影质感，实施摄像头识别手势交互，放大为5指张开，缩小为五指并拢，缩小时粒子冲击四周并将上传的照片进行放大，放大后根据食指进行选择和移动。

---

## 项目介绍

基于Three.js和MediaPipe的3D粒子爱心交互系统，支持摄像头手势识别控制。

### 功能特性

- 15000+金色粒子组成的3D爱心动态效果
- 电影级视觉质感（光晕、渐变、粒子发光）
- 实时摄像头手势识别
- 照片上传与交互展示

### 手势控制

| 手势 | 功能 |
|------|------|
| ✋ 五指张开 | 放大爱心（照片模式下退出并恢复爱心） |
| ✊ 五指并拢 | 缩小爱心/取消选择当前照片 |
| ☝️ 食指指向 | 选择和移动照片 |

注：缩小到一定程度后触发粒子爆炸并显示照片，握拳可取消当前选中的照片以便选择下一张。

### 技术栈

- Three.js - 3D渲染引擎
- MediaPipe Hands - 手势识别（通过CDN加载）
- Vite - 构建工具
- Vitest - 单元测试框架
- Nginx - 生产环境服务器
- Docker - 容器化部署

### 项目结构

```
frontend/src/
├── main.js      # 应用入口，初始化和动画循环
├── scene.js     # Three.js场景管理
├── particles.js # 粒子系统（爱心形状、爆炸效果）
├── gesture.js   # 手势识别模块
├── photo.js     # 照片上传与交互
├── utils.js     # 工具函数（日志、Toast提示等）
└── tests/       # 单元测试
    ├── setup.js
    ├── utils.test.js
    ├── particles.test.js
    ├── gesture.test.js
    └── photo.test.js
```

### 运行测试

```bash
cd frontend
npm test              # 运行所有测试
npm run test:watch    # 监听模式
npm run test:coverage # 生成覆盖率报告
```

### 依赖说明

- `three` - 3D渲染核心库（npm 本地安装）
- `vite` - 开发构建工具
- `vitest` - 测试框架

#### 关于 MediaPipe 的加载方式

MediaPipe Hands 采用运行时动态加载脚本的方式，而非在 package.json 中声明依赖，原因如下：

1. **不支持标准 ES Module**：`@mediapipe/hands` 包设计为浏览器全局脚本，直接 `import { Hands } from '@mediapipe/hands'` 会导致初始化失败
2. **模型文件需远程加载**：MediaPipe 的 WASM 和模型文件（约 10MB+）必须通过 `locateFile` 从 CDN 获取，无法打包到本地
3. **避免依赖冲突**：在 package.json 声明但实际不使用会造成混淆，增加 node_modules 体积却无实际作用

因此采用动态创建 `<script>` 标签的方式加载，既保证功能正常，又保持依赖管理的清晰。

### 功能限制

- 最多上传10张照片
- 单张照片最大5MB
- 支持格式：JPEG、PNG、GIF、WebP
