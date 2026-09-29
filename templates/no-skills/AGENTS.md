# {{PROJECT_NAME}} —— uni-app X 开发规约

本项目是 **uni-app X** 项目（`.uvue` / `.uts` / `.ts`），技术栈 **Vue3 + UTS + Vite + Tailwind CSS**，
可编译到 Android / iOS / 鸿蒙 / H5 / 微信小程序。

> 本文件由 `create-unibestx` 生成。原模板还带有一套 AI Skill 知识库
> （`.agents/` + `.claude/`，含 `unibestX-skill` 的「1 入口 + 7 分册」与 superpowers 技能框架），
> 本次生成时**未勾选**，所以这里把最关键的红线直接内联。需要完整分册时可在原仓库获取。

## 硬性红线

1. **一律禁止 `interface`** —— 定义对象结构、状态、参数、返回值一律用 `type` 别名，
   否则触发 UTS 的 `UTS110111163` 编译错误。

2. **`layout: 'navbar'` 的页面必须显式写 `style: { navigationStyle: 'custom' }`** ——
   漏写不报错，但导航栏、返回箭头、状态栏占位会静默消失。

3. **`.uts` 导入必须带扩展名**（`@/src/utils/foo.uts`）—— 去掉会 TS2307 且丢补全；
   `@` 指向项目根。

4. **严禁自己写 `uni.request`** —— 鉴权头 / 业务码判定 / 401 跳登录都在
   `src/http/request.uts` 的拦截器里，统一复用 `src/http/` 导出的请求方法。

5. **动手造轮子前先查 `src/utils/`** —— 路由与路径、主题色、环境变量、多语言文案、
   提示弹窗、返回键接管、下拉刷新与导航栏控制、文件上传、系统与安全区尺寸、
   防抖节流与流式处理、LaTeX 排版都已有现成模块。不要自己写 `uni.getSystemInfoSync()`、
   裸写 `setInterval` 做防抖、直接读 `import.meta.env.VITE_XXX`。

6. **页面骨架** —— 根容器用 `view`，可用高度走 `flex-1` 撑满，滚动区在内部自写 `scroll-view`。

## VDOM 与 Vapor 双模式

`manifest.json` 的 `uni-app-x.vapor` 决定渲染模式（默认 Vapor），同一份代码要兼容两种模式。
两种模式下表现不一致的 UTS 语法、组件属性、生命周期、CSS 样式，用条件编译分流并记录下来。

## 提交约定

**禁止 `git add -A`** —— 构建产物在本仓库被 git 跟踪，请逐文件显式添加。
