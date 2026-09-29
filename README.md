# create-unibestx

> 🚀 **unibestX (uni-app X)** 跨端项目脚手架工具。

基于 **uni-app X + Vue3 + UTS + Vite5 + Tailwind CSS**，支持一键创建高性能、现代化移动端与小程序跨端应用。

---

## ✨ 功能特性

- ⚡ **快速创建** - 通过交互式命令行或一键指令秒级生成项目
- 🎯 **组件库选型** - 自由选择 **Rice UI**（官方持续迭代推荐）或 **uview-ultra**（内置深度修复版）
- 🧩 **按需功能裁剪** - 灵活配置多语言 i18n、登录鉴权、路由守卫、ECharts 图表、AI 对话流式页、主题切换、Skill 知识库等
- 📦 **演示分包按需保留** - 12 个常用能力分包（Crypto、设备能力、HTTP、Lodash、z-paging-x、嵌套滚动等）按需裁剪或一键极简模式
- 🛡️ **四查自检保障** - 内置项目完整性诊断机制，确保 0 悬空引用、0 悬空标签、0 失效路由与依赖闭包
- 🌐 **双源镜像容灾** - 默认支持 GitHub 与 Gitee 镜像加速拉取，同时支持本地离线模板

---

## 🚀 快速使用

### 1. 全局安装或免安装使用

```bash
# 使用 pnpm（推荐）
pnpm create unibestx my-app

# 使用 npm / npx
npx create-unibestx my-app

# 全局安装
npm i -g create-unibestx
bestx my-app
```

### 2. 交互式创建

直接执行命令进入引导界面：

```bash
pnpm create unibestx
```

命令行将依次引导您选择：
1. **项目名称**
2. **UI 组件库**：Rice UI（推荐）或 uview-ultra
3. **目标平台**：Web / 微信小程序 / Android / iOS / 鸿蒙 (Harmony)
4. **功能特性**：多语言、登录鉴权、主题配置、图表、AI 对话流式传输、AI Skill 等
5. **演示分包**：保留全部、极简模式（仅留 4 个 Tab 主页面）或自定义勾选
6. **包管理器与自动安装依赖**

### 3. 命令行快捷参数（CI / 极速创建）

```bash
# 推荐组合：Rice UI + 登录鉴权 + 多语言
pnpm create unibestx my-app -u rice-ui -l -i

# 极简模式：移除所有可选功能与演示分包，仅留 4 个 Tab 纯净骨架
pnpm create unibestx my-app --features none --subs none

# 跳过提问，使用默认推荐配置快速生成
pnpm create unibestx my-app --yes

# 使用本地模板仓库（适合内网或离线开发）
pnpm create unibestx my-app --template /Users/chenqi/Desktop/unibestX
```

---

## 🛠️ 参数说明

| 参数 | 缩写 | 说明 | 可选值 / 示例 |
|---|---|---|---|
| `--ui` | `-u` | 指定 UI 库与模板基线 | `rice-ui`（默认，推荐），`uview-ultra` |
| `--platform` | `-p` | 目标支持平台（逗号分隔） | `web,mp-weixin,app-android,app-ios,app-harmony` |
| `--login` | `-l` | 启用登录鉴权与路由守卫 | `--login` / `--no-login` |
| `--i18n` | `-i` | 启用多语言 i18n 国际化 | `--i18n` / `--no-i18n` |
| `--echarts` | - | 启用 ECharts 图表支持 | `--echarts` |
| `--ai` | - | 启用 AI 对话流式传输页 | `--ai` |
| `--theme` | - | 启用明暗主题切换卡片 | `--theme` |
| `--skills` | - | 保留 AI Skill 框架与知识库 | `--skills` |
| `--docs` | - | 保留 VitePress 文档工程 | `--docs` |
| `--deploy` | - | 保留 H5 Docker 部署与 CI | `--deploy` |
| `--features` | - | 显式指定要启用的功能列表 | `i18n,theme,auth,echarts,ai` / `none` / `all` |
| `--subs` | - | 显式指定保留的演示分包 | `device,lodash,zpaging` / `none` / `all` |
| `--template` | - | 模板来源（分支名或本地路径） | `uniX-rice-ui`, `main`, `/path/to/unibestX` |
| `--package-manager`| `-m` | 指定包管理器 | `pnpm`（默认），`npm`，`yarn` |
| `--no-install` | - | 生成后不自动安装依赖 | - |
| `--yes` | `-y` | 快速生成，跳过交互提问 | - |
| `--version` | `-v` | 查看脚手架版本信息 | - |
| `--help` | `-h` | 查看帮助文档 | - |

---

## 🔍 项目健康自检 (Doctor)

脚手架内置针对 uni-app X 项目的四查自检工具：

```bash
# 检查当前目录项目
pnpm create unibestx doctor

# 检查指定项目目录
pnpm create unibestx doctor ./my-app
```

检查内容包括：
1. **悬空 Import**：检测代码中引用的本地模块是否真实存在；
2. **悬空组件标签**：检测模板中的自定义标签是否已被 import、easycom、uni_modules 或 components 解析；
3. **路由一致性**：检测 `pages.json` 与 `pages.config.json` 中的页面是否全部存在，是否存在空分包或死链；
4. **依赖一致性**：检测引用的第三方依赖是否在 `package.json` 中声明。

---

## 📄 License

[MIT](LICENSE)
