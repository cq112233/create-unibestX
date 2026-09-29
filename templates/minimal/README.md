# {{PROJECT_NAME}}

由 [create-unibestx](https://github.com/cq112233/unibestX) 生成的 `uni-app X` 项目。

技术栈：**uni-app X + Vue3 + UTS + Vite5 + Tailwind CSS**。

## 开始之前

- 需要 **HBuilderX 5.21 及以上**（推荐 5.24，完整体验 Vapor 蒸汽模式）。
- 用 CLI 命令（`pnpm dev:*`）前**必须先启动 HBuilderX** —— CLI 本质是驱动正在运行的 HBuilderX 完成编译。
- 旧版 HBuilderX 可在 `manifest.json` 中把 `uni-app-x.vapor` 改为 `false` 切回 VDOM 模式。

## 安装与运行

```bash
pnpm install

pnpm dev            # 运行到 H5
pnpm dev:web        # 同上
pnpm dev:mp-weixin  # 运行到微信小程序
pnpm dev:app-android
pnpm dev:app-ios
pnpm dev:app-harmony
```

## 目录结构

```text
├── App.uvue              # 应用入口（根组件会被插件自动注入到每个页面）
├── main.uts              # 应用创建入口
├── manifest.json         # 各端打包配置（appid 为占位值，需自行替换）
├── pages.config.json     # 路由与 easycom 的真实来源（pages.json 由插件生成）
├── plugins/              # 自定义 Vite 插件（uni-pages / layouts / root-plugin 等）
├── src/
│   ├── pages/            # 主包页面（4 个 Tab：首页 / 基础 / 功能 / 我的）
│   ├── sub/              # 分包页面
│   ├── components/       # 全局组件
│   ├── http/             # 请求封装（拦截器里统一处理鉴权头、业务码、401）
│   ├── store/            # 状态管理（Vapor / VDOM 双模式门面）
│   ├── tabbar/           # 底部导航配置与容器
│   ├── layouts/          # 页面布局（navbar 等）
│   ├── i18n/             # 多语言
│   └── utils/            # 内置工具模块（详见下方）
└── static/               # 静态资源
```

## 内置工具

`src/utils/` 下已有现成模块，**动手写通用能力前先看一眼**，避免重复造轮子：

| 模块 | 用途 |
|---|---|
| `route` | 取路由与路径 |
| `theme` | 取主题色 |
| `env` | 读环境变量 |
| `i18n` | 多语言文案 |
| `toast` | 提示弹窗 |
| `backPress` | 返回键接管 |
| `refresh` | 下拉刷新与导航栏控制 |
| `upload` | 文件上传 |
| `systemInfo` | 系统与安全区尺寸 |
| `rxjs-lite` | 防抖节流与流式处理 |

## 注意事项

- **页面 `layout: 'navbar'` 时，`style.navigationStyle` 必须显式写 `'custom'`**，漏写会让导航栏、返回箭头、状态栏占位**静默消失且不报错**。
- **不要自己写 `uni.request`** —— 鉴权头、业务码判定、401 跳登录都在 `src/http/request.uts` 的拦截器里。
- **不要 `interface`** —— UTS 对对象字面量赋值有严格限制，本项目统一用 `type`。

## 生成信息

本项目的功能开关记录在 `package.json` 的 `unibestx` 字段中，包含勾选的功能、保留的分包与模板来源。

---

完整文档见原仓库 [unibestX](https://github.com/cq112233/unibestX)。
