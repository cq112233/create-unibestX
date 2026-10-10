# create-unibestx

> 🚀 **unibestX (uni-app X)** 跨端项目脚手架工具。

[![npm version](https://img.shields.io/npm/v/create-unibestx.svg)](https://www.npmjs.com/package/create-unibestx)
[![license](https://img.shields.io/npm/l/create-unibestx.svg)](LICENSE)
[![node version](https://img.shields.io/node/v/create-unibestx.svg)](https://nodejs.org/)

基于 **uni-app X + Vue3 + UTS + Vite5 + Tailwind CSS**，支持一键创建高性能、现代化移动端与小程序跨端应用。

---

## ✨ 功能特性

- ⚡ **快速创建** - 交互式引导或一行命令秒级生成项目，体验极致流畅
- 🎯 **UI 组件库选型** - 三选一：**Rice UI**（官方持续迭代，强烈推荐）、**uview-ultra**（内置深度修复版）或 **无 UI 库**（原生组件 + Tailwind CSS 纯净基线）
- 🪶 **极简模式 (Minimal)** - 另有 `base` 分支纯净骨架，零冗余代码，跳过 UI 库与功能裁剪，适合从零定制搭建
- 🧩 **按需功能裁剪与解耦**：
  - **系统底座（默认全选）**：可自主选配 **i18n 国际化**（未勾选时自动降级纯中文直出）、**theme 主题色**（未勾选时自动降级静态默认单色）；
  - **扩展功能（按需勾选）**：ECharts 图表、lime-signature 签名板、RxJS 响应式流、设备与系统能力、Lodash 工具库、Crypto 加解密、WebView 双向通讯、NestedScroll 嵌套滚动等 8 项高频能力；
  - **核心底座（恒定内置）**：登录鉴权与路由守卫（auth / 路由拦截器）、`z-paging-x` 原生分页插件本体、`lime-dayuts` 时间日期处理永久内置，开箱即用。
- 🧹 **演示视图智能联动** - 未勾选的功能特性不仅彻底清理源码与插件，还将自动同步剔除 `FunctionView` 业务演示列表中的入口按钮，代码零悬空
- 🛡️ **四查自检保障** - 生成后自动执行完整性诊断（悬空 Import、悬空组件标签、路由一致性、依赖一致性），任一错误即自动回滚，保障生成物 100% 健壮
- 🌐 **双源镜像与本地调试** - 默认走 Gitee 极速源，失败自动切换 GitHub 备份；支持 `--local-repo` 从本地工作区或分支秒级克隆，调试极速无网络延迟

---

## 📦 环境要求

| 依赖 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | **≥ 20.12** | [@clack/prompts](https://www.npmjs.com/package/@clack/prompts) 的硬性要求 |
| HBuilderX | **5.21+**（推荐 5.24） | 运行 `pnpm dev:*` 等 CLI 跨端运行命令前**必须先启动**，CLI 本质是驱动 HBuilderX 完成跨端编译 |
| Git | 任意近期版本 | 用于浅克隆模板仓库 |

> 旧版 HBuilderX 可在 `manifest.json` 中把 `uni-app-x.vapor` 改为 `false` 切回 VDOM 模式。

---

## 🚀 快速使用

### 1. 全局安装或免安装使用

```bash
# 使用 pnpm（推荐）
pnpm create unibestx my-app

# 使用 npm / npx
npx create-unibestx my-app

# 全局安装（提供 bestx / create-unibestx / unibestx 三个等价命令）
npm i -g create-unibestx
bestx my-app
```

### 2. 交互式创建

直接执行命令进入引导界面：

```bash
pnpm create unibestx
```

命令行将依次引导您完成 5 步交互：

1. **项目名称**：输入并校验合法英文标识；
2. **第一步（模板模式）**：复杂模式（推荐，进入后续定制） / 极简模式（直接拉取 base 分支纯净骨架）；
3. **第二步（UI 组件库）**：Rice UI（默认推荐） / uview-ultra / 无 UI 库；
4. **第三步（系统底座）**：多选 i18n 国际化、theme 主题色（默认全选）；
5. **第四步（扩展功能）**：多选 ECharts、签名板、RxJS、设备能力、Lodash、Crypto、WebView、NestedScroll（默认全不选，按需勾选）；
6. **第五步（预留与包管理器）**：配置包管理器（pnpm / npm / yarn）及是否立即安装依赖。

> 选择极简模式时，将直接跳过第 2~5 步，落到 `base` 分支零冗余骨架。

---

### 3. 命令行快捷参数（CI / 极速创建）

```bash
# 推荐组合：Rice UI + 常用系统底座与扩展功能
pnpm create unibestx my-app -u rice-ui -f i18n,theme,echarts

# 指定 UI 库与按需扩展特性
pnpm create unibestx my-app -u uview-ultra -f lodash,crypto

# 极简模式：直接使用 base 纯净分支
pnpm create unibestx my-app --template base

# 跳过提问，使用默认推荐配置快速生成
pnpm create unibestx my-app --yes

# 调试本地模板仓库（推荐：按分支取，本地未提交改动也会生效）
export UNIBESTX_LOCAL_REPO=/Users/chenqi/Desktop/unibestX
pnpm create unibestx my-app -u rice-ui

# 单次指定，并显式选分支
pnpm create unibestx my-app --local-repo /Users/chenqi/Desktop/unibestX --template uniX-uview-ultra

# 指向某个具体目录（指哪个目录拷哪个目录，不吃分支语义）
pnpm create unibestx my-app --no-local --template /Users/chenqi/Desktop/unibestX
```

---

## 🧪 本地模板仓库调试（`--local-repo`）

unibestX 仓库有多条并列分支（`main` / `uniX-uview-ultra` / `uniX-rice-ui` / `base`），
而工作区同一时刻只能停在一条上。`--local-repo` 让脚手架**按分支名**从本地仓库取内容，
既不会串分支，也不会因为工作区停在别的分支而拿错模板。

```bash
# 方式一：环境变量常开（配一次，之后所有创建都走本地）
export UNIBESTX_LOCAL_REPO=/Users/chenqi/Desktop/unibestX
pnpm create unibestx my-app                      # 取默认的 uniX-rice-ui 分支
pnpm create unibestx my-app -u uview-ultra       # 取 uniX-uview-ultra 分支

# 方式二：命令行单次指定
pnpm create unibestx my-app --local-repo /Users/chenqi/Desktop/unibestX --template uniX-uview-ultra

# 临时改回远程拉取
pnpm create unibestx my-app --no-local
```

**取内容的规则**（日志会明确告诉你走了哪条）：

| 情况 | 取到的内容 | 日志 |
| --- | --- | --- |
| 工作区正好在请求的分支上 | 直接拷工作区，**含未提交改动** | `（工作区，含 N 处未提交改动）` |
| 工作区在别的分支上 | `git clone --local` 取该分支**已提交**内容 | `（本地克隆，仅已提交内容）` |

> 想边改模板边测生成，就先 `cd` 到 unibestX 切到目标分支再创建 —— 这条路径会带上你未提交的改动。
> 取分支用的是 `git clone --local`（对象库硬链接），不会改动你的仓库，也不会复制庞大的 `.git`。

**配置解析优先级**：`--no-local` > `--local-repo <path>` > `--local-repo`（取环境变量）> `UNIBESTX_LOCAL_REPO`。

**出错即停，不静默回落远程** —— 路径不存在、不是 git 仓库、分支本地没有，都会直接报错退出
（分支不存在时会列出可用分支）。这是刻意的：静默回落会让你以为在测 A，实际在测 B。

---

## 🛠️ 参数说明

| 参数 | 缩写 | 说明 | 可选值 / 示例 |
| --- | --- | --- | --- |
| `--ui` | `-u` | 指定 UI 库与模板基线 | `rice-ui`（默认，推荐），`uview-ultra`，`none`（无 UI 库） |
| `--features` | `-f` | 显式指定要启用的功能特性列表（**功能开关的入口**） | `i18n,theme,echarts` / `none`（全不选）/ `all`（全选） |
| `--template` | `-t` | 模板来源（分支名或本地路径） | `uniX-rice-ui`（Rice UI，默认）、`uniX-uview-ultra`、`main`（无 UI 库）、`base`（极简模板）、本地路径 |
| `--local-repo` | - | 本地模板仓库路径。设了之后按 `--template` 的分支名从本地仓库取内容；不带值读 `UNIBESTX_LOCAL_REPO` | `/Users/chenqi/Desktop/unibestX` |
| `--no-local` | - | 单次关闭本地模板模式，临时改回远程拉取 | - |
| `--keep-unused-modules` | - | 保留全部 `uni_modules`（跳过零引用自动清理） | - |
| `--package-manager` | `-m` / `--pm` | 指定包管理器 | `pnpm`（默认）、`npm`、`yarn` |
| `--no-install` | - | 生成后不自动安装依赖 | - |
| `--yes` | `-y` | 快速生成，跳过交互提问（使用默认配置） | - |
| `--keep-on-fail` | - | 自检失败时保留生成物现场，便于排查（默认自动回滚） | - |
| `--version` | `-v` | 查看脚手架版本信息 | - |
| `--help` | `-h` | 查看帮助文档 | - |

---

## 🧩 功能特性详解 (`--features`)

脚手架将可选功能划分清晰，支持在交互界面选择或通过 `--features` 自由组合：

### 1. 系统底座（System Base）

| 特性 Key | 名称与说明 | 默认状态 | 裁剪/降级策略 |
| --- | --- | --- | --- |
| `i18n` | **i18n 国际化**（多语言国际化支持） | ✅ 默认开启 | 未勾选时清理 `lime-i18n` 插件与多语言包，TabBar、NavBar 自动桥接降级为纯中文直出，Store 安全兜底 |
| `theme` | **theme 主题色**（主题换肤与暗黑模式支持） | ✅ 默认开启 | 未勾选时清理 `src/theme`、`theme.json` 及主题演示，TabBar、NavBar、AppKu 自动降级为静态默认单色 |

### 2. 扩展功能（Extra Features）

对齐功能页 `FunctionView` 的业务演示能力，**默认全不选**，用户按需勾选或通过 `--features` 指定：

| 特性 Key | 名称与说明 | 包含插件 / 目录 |
| --- | --- | --- |
| `echarts` | **ECharts 跨端图表**（折线图、柱状图、饼图跨端渲染） | `uni_modules/e-chart`, `src/sub/echartsFunctionDemo` |
| `signature` | **lime-signature 签名板**（手写签名板、画笔调节、撤销重做与保存） | `uni_modules/lime-signature`, `src/sub/signatureFunctionDemo` |
| `rxjs` | **RxJS 响应式流**（UTS 自研 rxjs-lite，防抖节流与流式传输） | `src/sub/rxjsFunctionDemo` |
| `device` | **原生设备能力**（拨号、分享、文件预览、震动、键盘、扫码等） | `src/sub/deviceFunctionDemo` |
| `lodash` | **Lodash 工具库**（深拷贝、去重、防抖节流与高频工具函数） | `uni_modules/iRainna-lodash`, `src/sub/lodashFunctionDemo` |
| `crypto` | **Crypto 加密解密**（MD5、AES、DES、SHA-256、HMAC、Base64） | `uni_modules/unix-crypto`, `src/sub/cryptoFunctionDemo` |
| `webview` | **WebView 双向通讯**（网页内嵌、跨端 postMessage 与 evalJS 交互） | `src/sub/webviewFunctionDemo`, `static/webview`, `hybrid` |
| `nestedScroll` | **NestedScroll 自研嵌套滚动**（解决双重原生滚动冲突，平滑衔接） | `src/components/NestedScroll`, `src/sub/nestedScrollFunctionDemo` |

### 3. 常驻核心底座（不可裁剪）

以下模块作为 unibestX 的核心基座能力，**永久内置**，不参与裁剪：

- **登录鉴权与路由守卫（auth / 路由拦截器）**：包含 `src/sub/auth` 登录页、路由拦截与全局 401 守卫；
- **z-paging-x 原生分页插件**：`uni_modules/z-paging-x` 核心列表底座开箱即用，`<z-paging-x>` 标签全局可用；
- **lime-dayuts 时间日期处理**：核心日期时间工具库。

---

## 📋 生成物的自描述信息

生成后的 `package.json` 会写入一个 `unibestx` 字段，记录本次生成的完整配置，方便日后回溯与团队协同：

```jsonc
{
  "unibestx": {
    "features": ["echarts", "i18n", "theme"], // 勾选的功能特性列表
    "templateMode": "complex",                 // 模板模式：complex（复杂模式）/ minimal（极简模式）
    "uiLibrary": "rice-ui",                   // UI 组件库：rice-ui / uview-ultra / none
    "template": "uniX-rice-ui",                // 模板来源：远程分支名 / local:<分支> / local（字面目录）
    "createdAt": "2026-10-10T14:00:00.000Z",   // 生成时间（ISO 8601）
    "cliVersion": "1.0.4"                      // 脚手架 CLI 版本
  }
}
```

同时收尾阶段会自动：

- 重写 `package.json` 的项目名与裁剪后的依赖/脚本；
- 将 `.env` 里的 `VITE_APP_TITLE` 对齐为项目名；
- 清理 `VITE_DEV_SANDBOX_PAGES` 中已删除的页面；
- 脚手架**不会**在生成的项目里执行 `git init`，需要版本管理时请自行初始化。

---

## 🔍 项目健康自检 (Doctor)

脚手架内置针对 uni-app X 项目的四查自检工具。**每次生成项目后都会自动跑一遍，出现 error 会直接回滚生成物**；也可以对任意已有项目手动调用：

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

存在 error 时进程以状态码 `1` 退出，只有 warning 时以 `0` 退出，便于接入 CI 质检。

---

## 🏃 常用跨端命令

项目生成后，进入项目目录即可运行以下命令（请确保已先启动 HBuilderX）：

```bash
pnpm dev              # 运行到 H5 / Web
pnpm dev:mp-weixin    # 运行到微信小程序
pnpm dev:mp-alipay    # 运行到支付宝小程序
pnpm dev:app-android  # 运行到 Android 平台
pnpm dev:app-ios      # 运行到 iOS (模拟器)
pnpm dev:app-harmony  # 运行到 HarmonyOS 鸿蒙
```

---

## 🔧 本地开发

脚手架自身的开发、调试与冒烟测试流程见 [DEVELOPER.md](DEVELOPER.md)。

---

## 📄 License

[MIT](LICENSE)
