# create-unibestx

> 🚀 **unibestX (uni-app X)** 跨端项目脚手架工具。

基于 **uni-app X + Vue3 + UTS + Vite5 + Tailwind CSS**，支持一键创建高性能、现代化移动端与小程序跨端应用。

---

## ✨ 功能特性

- ⚡ **快速创建** - 交互式引导或一行命令秒级生成项目
- 🎯 **UI 组件库选型** - 三选一：**Rice UI**（官方持续迭代，强烈推荐）、**uview-ultra**（内置深度修复版）或 **无 UI 库**（原生组件 + Tailwind CSS 纯净基线）
- 🪶 **极简模板** - 另有 `base` 分支的最小化干净基线，跳过 UI 库与功能选择，适合从零搭建
- 🧩 **按需功能裁剪** - 可配置多语言 i18n、ECharts 图表；登录鉴权与路由守卫、明暗主题切换作为核心底座永久内置
- 📦 **演示分包按需保留** - 12 个能力分包（Crypto、设备能力、HTTP、Lodash、嵌套滚动等）默认全部不保留，需要时用 `--subs` 逐个勾选或 `--subs all` 全量保留；`z-paging-x` 分页插件本体始终保留
- 🛡️ **四查自检保障** - 生成后自动执行完整性诊断，任一错误即回滚生成物，确保 0 悬空引用、0 悬空标签、0 失效路由与依赖闭包
- 🌐 **双源镜像容灾** - 默认走 Gitee 国内极速源，失败自动切换 GitHub 备份，也支持本地离线模板

---

## 📦 环境要求

| 依赖 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | **≥ 20.12** | [@clack/prompts](https://www.npmjs.com/package/@clack/prompts) 的硬性要求 |
| HBuilderX | **5.21+**（推荐 5.24） | 运行 `pnpm dev:*` 等 CLI 命令前**必须先启动**，CLI 本质是驱动 HBuilderX 完成跨端编译 |
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
2. **第一步（模板模式）**：复杂模式（推荐，进入后续配置） / 极简模式（直接拉取 base 分支纯净基线）；
3. **第二步（UI 组件库）**：Rice UI（默认推荐） / uview-ultra / 无 UI 库；
4. **第三步（系统底座）**：多选 i18n 国际化、theme 主题色（默认全选）；
5. **第四步（扩展功能）**：多选 lodash, echarts, z-paging-x, crypto, dayuts, webview 等（默认全选）；
6. **第五步（预留与包管理器）**：配置包管理器（pnpm / npm / yarn）及是否立即安装依赖。

选择极简模式时，将跳过第 2~5 步，直接落到 `base` 分支零冗余骨架。

---

### 3. 命令行快捷参数（CI / 极速创建）

```bash
# 推荐组合：Rice UI + 开启指定功能
pnpm create unibestx my-app -u rice-ui --features i18n,theme,lodash,echarts

# 极简模式：直接使用 base 纯净分支
pnpm create unibestx my-app --template base

# 跳过提问，使用默认推荐配置快速生成
pnpm create unibestx my-app --yes


# 调试本地模板仓库（推荐：按分支取，本地未提交改动也会生效）
export UNIBESTX_LOCAL_REPO=/Users/chenqi/Desktop/unibestX
pnpm create unibestx my-app

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
|---|---|---|
| 工作区正好在请求的分支上 | 直接拷工作区，**含未提交改动** | `（工作区，含 N 处未提交改动）` |
| 工作区在别的分支上 | `git clone --local` 取该分支**已提交**内容 | `（本地克隆，仅已提交内容）` |

> 想边改模板边测生成，就先 `cd` 到 unibestX 切到目标分支再创建 —— 这条路径会带上你未提交的改动。
> 取分支用的是 `git clone --local`（对象库硬链接），不会改动你的仓库，也不会复制那 1.4 GB 的 `.git`。

**配置解析优先级**：`--no-local` > `--local-repo <path>` > `--local-repo`（取环境变量）> `UNIBESTX_LOCAL_REPO`。

**出错即停，不静默回落远程** —— 路径不存在、不是 git 仓库、分支本地没有，都会直接报错退出
（分支不存在时会列出可用分支）。这是刻意的：静默回落会让你以为在测 A，实际在测 B。

---

## 🛠️ 参数说明

| 参数 | 缩写 | 说明 | 可选值 / 示例 |
|---|---|---|---|
| `--ui` | `-u` | 指定 UI 库与模板基线 | `rice-ui`（默认，推荐），`uview-ultra`，`none`（无 UI 库） |
| `--features` | `-f` | 显式指定要启用的功能列表（**功能开关的唯一入口**） | `i18n,echarts` / `none`（全不选）/ `all`（全选） |
| `--subs` | - | 显式指定要保留的演示分包 | 分包目录名逗号分隔 / `none` / `all` |
| `--template` | `-t` | 模板来源（分支名或本地路径） | `uniX-rice-ui`（Rice UI，默认）、`uniX-uview-ultra`、`main`（无 UI 库）、`base`（极简模板）、本地路径 |
| `--local-repo` | - | 本地模板仓库路径。设了之后按 `--template` 的分支名从本地仓库取内容；不带值读 `UNIBESTX_LOCAL_REPO` | `/Users/chenqi/Desktop/unibestX` |
| `--no-local` | - | 单次关闭本地模板模式，临时改回远程拉取 | - |
| `--keep-unused-modules` | - | 保留零引用的 `uni_modules`（默认会自动清理精简） | - |
| `--package-manager` | `-m` / `--pm` | 指定包管理器 | `pnpm`（默认）、`npm`、`yarn` |
| `--no-install` | - | 生成后不自动安装依赖 | - |
| `--yes` | `-y` | 快速生成，跳过交互提问 | - |
| `--keep-on-fail` | - | 自检失败时保留生成物现场，便于排查（默认自动回滚） | - |
| `--version` | `-v` | 查看脚手架版本信息 | - |
| `--help` | `-h` | 查看帮助文档 | - |

---

## 🧩 功能特性与演示分包

这两个参数是整个裁剪链路的开关，取值如下。

### 功能特性（`--features`）

| 取值 | 说明 | 默认 |
|---|---|---|
| `i18n` | 多语言国际化。不勾选会彻底删除 `lime-i18n` 插件与 `src/i18n` 目录，保留纯中文轻量环境 | ✅ 启用 |
| `echarts` | ECharts 图表（内置 `echarts.min.js`）。不勾选会裁剪 `uni_modules/e-chart` | ✅ 启用 |

登录鉴权、路由守卫、401 拦截与明暗主题切换**不在可裁剪范围内** —— 它们被状态管理底座反向依赖，属于永久内置能力。

### 演示分包（`--subs`）

共 12 个：

`crypto`（加解密）、`device`（原生设备能力）、`httpDemo`（HTTP 请求）、`layoutDemo`（布局示例）、`lodash`（Lodash 工具库）、`nested-scroll`（嵌套滚动）、`rxjsDemo`（RxJS 流式渲染）、`tailwindcss`（Tailwind 示例）、`test`（URL 参数测试）、`time`（时间日期）、`uiTest`（UI 测试）、`zpaging`（z-paging-x 原生分页）。

**默认一个都不保留**：不传 `--subs` 时，12 个分包会被全部裁掉，基础页与功能页重置为纯净空白视图。想保留就显式列出目录名，或用 `--subs all` 全量保留。

> `auth` 分包不在此列，它随登录鉴权底座一并保留。
>
> `zpaging` 分包裁掉的只是演示页 `src/sub/zpaging`；分页插件本体 `uni_modules/z-paging-x` **恒定保留**（属于列表页底座，`<z-paging-x>` 标签开箱可用），不随 `--subs` 取舍增删。

---

## 📋 生成物的自描述信息

生成后的 `package.json` 会写入一个 `unibestx` 字段，记录本次生成的完整配置，方便日后回溯：

```jsonc
{
  "unibestx": {
    "features": ["echarts", "i18n"],   // 勾选的功能
    "subPackages": ["crypto", "time"], // 保留的演示分包
    "cleanUnusedModules": true,        // 是否清理了零引用 uni_modules
    "template": "local:uniX-rice-ui",   // 模板来源：远程分支名 / local:<分支> / local（字面目录）
    "createdAt": "2026-09-30T04:00:00.000Z",
    "cliVersion": "1.0.0"
  }
}
```

同时收尾阶段会自动：重写 `package.json` 的名称与裁剪后的依赖/脚本、把 `.env` 里的 `VITE_APP_TITLE` 对齐为项目名、清理 `VITE_DEV_SANDBOX_PAGES` 中已删除的页面。脚手架**不会**在生成的项目里执行 `git init`，需要版本管理时请自行初始化。

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

存在 error 时进程以状态码 `1` 退出，只有 warning 时以 `0` 退出，便于接入 CI。

---

## 🔧 本地开发

脚手架自身的开发、调试与冒烟测试流程见 [DEVELOPER.md](DEVELOPER.md)。

---

## 📄 License

[MIT](LICENSE)
