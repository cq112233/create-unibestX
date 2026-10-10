# 本地模板仓库调试配置项 —— 设计规格

日期：2026-10-10
状态：待评审
范围：create-unibestX CLI 的模板获取链路

## 1. 背景与问题

`/Users/chenqi/Desktop/unibestX` 仓库已完成重构，长期存在三条并列分支：

| 分支 | 对应模板 |
|---|---|
| `uniX-rice-ui` | 完整模板 · Rice UI（默认） |
| `uniX-uview-ultra` | 完整模板 · uview-ultra |
| `main` | 完整模板 · 无第三方 UI 库 |
| `base` | 极简模板（不在本次改动范围内） |

而工作区同一时刻只能停在其中一条分支上。当前 CLI 存在两个具体问题：

**问题一：本地模板来源与请求的模板名完全脱钩，且静默串分支。**

`resolveTemplate` 只判断"这个字符串是否指向一个存在的目录"，命中即整目录拷贝。用户本地仓库停在 `uniX-rice-ui` 时执行 `--template uniX-uview-ultra`，因为该字符串不是目录，会被当作分支名走远程克隆 —— 表面上没走本地。但若用户主动写 `--template /Users/chenqi/Desktop/unibestX`，拿到的永远是当前 checkout 的那一支，与你以为请求的模板毫无关系，且日志不作任何提示。

**问题二：硬编码的本机兜底路径会随包分发。**

`acquire.ts` 中远程克隆失败时的容灾分支硬编码了 `/Users/chenqi/Desktop/unibestX`。这条路径会随 npm 包发布到所有用户机器上，在那里只会 `existsSync` 返回 false 而静默跳过 —— 属于无意义的死代码。

**问题三：冒烟测试的模板分支取决于开发者的 checkout 状态。**

`scripts/smoke.mjs` 用 `--template <REPO_ROOT>` 取模板，取到的是工作区当前分支的内容。开发者本地停在 `base` 时运行冒烟，会因缺少 z-paging-x 等 rice-ui 内容而误报失败。

### 目标

提供一个配置项，让开发者把"模板从本地哪个仓库取"固化成配置，并使**请求的分支名**在本地模式下同样被尊重 —— 从本地仓库精确取出对应分支的内容，杜绝静默串分支。

## 2. 已确认的设计决策

| 决策点 | 结论 |
|---|---|
| 取分支的手段 | `git clone --local --single-branch -b <branch>`（而非 `git worktree`），零副作用、复用现有 clone 链路 |
| 配置项的内容 | 本地 unibestX 仓库的根路径 |
| 配置入口 | 环境变量常开 + CLI 单次覆盖 |
| 取内容的基准 | 按分支取，工作区优先 |
| `base` 分支 | 同样走本地分支，极简路的逻辑一行不改 |
| `--template <路径>` | 保留字面拷贝语义，仅增加分支名日志作为安全网 |

## 3. 配置项定义

### 3.1 三个入口与优先级

```
UNIBESTX_LOCAL_REPO=/Users/chenqi/Desktop/unibestX   # 环境变量，设置后常开
--local-repo <path>                                   # 单次覆盖路径
--no-local                                            # 单次关闭本地模式
```

优先级（高 → 低）：

1. `--no-local`
2. `--local-repo <path>`
3. 裸 `--local-repo`（不带值，取 `UNIBESTX_LOCAL_REPO`）
4. `UNIBESTX_LOCAL_REPO` 环境变量

`--no-local` 与 `--local-repo` 同时出现时，`--no-local` 生效，并输出一行警告说明本地模式已被显式关闭。

裸 `--local-repo`（不带值）而 `UNIBESTX_LOCAL_REPO` 未设置时，报错退出并提示两种配置方式 —— 显式要求本地模式却没有可用路径，属于配置错误，不应静默退回远程。

环境变量名 `UNIBESTX_LOCAL_REPO` 沿用 `scripts/smoke.mjs` 中已在使用的同名变量，保持工具链一致。

`CliFlags` 新增两个字段承载上述入口：`'local-repo'?: boolean | string`（minimist 对裸用与带值会给出不同类型）与 `'no-local'?: boolean`。

### 3.2 路径归一与校验

配置值先做一次归一：以 `git -C <path> rev-parse --show-toplevel` 取真实仓库根。因此填入子目录路径或 worktree 路径均可正常解析。

校验失败的处理原则是**直接报错退出，绝不静默回落远程**：

| 情况 | 行为 |
|---|---|
| 路径不存在 | 报错退出，提示检查 `--local-repo` / `UNIBESTX_LOCAL_REPO` |
| 路径存在但不是 git 仓库 | 报错退出，提示该路径不是 git 仓库 |
| git 命令不可用 | 报错退出，提示安装 git |

静默回落会让开发者以为在测 A 实际在测 B，这正是本次要消灭的问题类型。

## 4. 模板来源解析

### 4.1 `--template` 的形态判定

改写现有 `resolveTemplate`，判定顺序如下：

1. **绝对路径**，或以 `./`、`../` 开头 → 按路径处理。目标不存在则报错退出（形态明确是路径却不存在，属于用户笔误，不应悄悄当成分支名去远程找）。
2. **不含路径分隔符的裸名**（如 `base`、`main`、`uniX-rice-ui`）→ 按分支名处理。
   - 若 cwd 下恰好存在同名目录，输出一行警告说明已按分支名解释，需要目录请写 `./name`。
   - 该规则同时修掉了"`main` 被 cwd 下同名目录顶替"的现存隐患。
3. **含路径分隔符的相对路径**（如 `templates/base`）→ 按路径处理，不存在则报错。

判定为路径时**直接走字面目录拷贝，不查询本地模式** —— 即 `--local-repo` 与 `--template <路径>` 同时给出时，路径形态优先。第 4.2 节的本地/远程分支只对判定为分支名的取值生效。

### 4.2 分支名 → 来源

分支名解析完成后：

- **本地模式生效** → 走本地仓库取该分支（第 5 节）
- **本地模式未生效** → 走现有的远程浅克隆（Gitee 主源 + GitHub 容灾），行为不变

### 4.3 路径形态的安全网

若 `--template` 命中的目录本身是一个 git 仓库根，日志额外点名它当前的 HEAD 分支，例如：

```
模板来源: 本地目录 /Users/chenqi/Desktop/unibestX（当前分支 uniX-rice-ui，含 3 处未提交改动）
```

这条日志只做提示，不改变"指哪个目录拷哪个目录"的语义。

## 5. 按分支取内容

新增 `acquireFromLocalRepo(repoRoot, branch, targetDir)`，流程：

1. `git -C <root> rev-parse --verify --quiet refs/heads/<branch>`
   分支不存在 → **报错退出**，并列出本地可用分支，提示先 `git fetch`
2. `git -C <root> symbolic-ref --quiet --short HEAD` 读当前分支（detached HEAD 时该命令失败，视为"不等于请求分支"）
3. **HEAD == 请求分支** → 直接 `copyDir(<root>, targetDir, SKIP_DIRS)`
   - 目的：包含你未提交的改动，支持边改模板边测生成
   - 工作区脏时在日志中标出未提交改动条数
4. **HEAD != 请求分支** → `git clone --local --single-branch -b <branch> <root> <targetDir>`
   - 随后删除 `.git`，并执行现有的 `pruneEmptyDirs`
5. 日志明确区分两种来源：

```
模板来源: 本地仓库 /Users/chenqi/Desktop/unibestX #uniX-rice-ui（工作区，含 3 处未提交改动）
模板来源: 本地仓库 /Users/chenqi/Desktop/unibestX #uniX-uview-ultra（本地克隆，仅已提交内容）
```

第 3 条与第 4 条对未提交改动的处理不同，**必须在日志里说清楚**，否则开发者切错分支时会拿到"看起来对但少了改动"的模板。

### 5.1 远程失败时的本地容灾

替换现有的硬编码兜底：

- 远程克隆失败 且 本地模式已配置 → 用本地仓库的同名分支重试（日志说明已切换来源）
- 远程克隆失败 且 本地模式未配置 → 沿用现有的报错文案

## 6. 代码结构

按职责切分为两个边界清晰的单元：

### 6.1 `src/utils/localRepo.ts`（新增）

配置解析与校验，纯逻辑 + 一次 git 调用，可独立测试。

```ts
export type LocalRepoConfig =
  | { mode: 'off' }
  | { mode: 'on', root: string }

export async function resolveLocalRepo(
  flags: CliFlags,
): Promise<LocalRepoConfig>
```

职责：读取 flags 与环境变量、按优先级求解、路径归一、校验失败时抛出明确错误。

### 6.2 `src/steps/acquire.ts`（改写）

保留"取内容"这一件事，`TemplateSource` 扩展为三态：

```ts
export type TemplateSource =
  | { kind: 'literal-dir', dir: string }
  | { kind: 'local-branch', repoRoot: string, branch: string, from: 'workspace' | 'clone' }
  | { kind: 'git', branch: string, repo: string }
```

同时：

- 删除硬编码的 `/Users/chenqi/Desktop/unibestX` 兜底
- 删除无人消费的 `AcquireResult.strippedGit` 返回值

## 7. 生成物元信息

`package.json` 的 `unibestx.template` 字段细化为：

| 来源 | 记录值 |
|---|---|
| 字面目录拷贝 | `local` |
| 本地分支 | `local:<branch>` |
| 远程克隆 | `<branch>` |

**只记分支名，不记绝对路径** —— 生成物是要被提交和分享的，塞入本机路径不合适，也让生成物失去可复现性。

实现上，`finalize` 不再靠猜路径形态（现有 `isLocalTemplate` 用 `path.isAbsolute` / `./` 前缀判断）来决定记录值，改为直接接收 `acquireTemplate` 解析出的来源标签字符串（新增一个 `templateLabel: string` 参数）。

## 8. 连带改动

### 8.1 冒烟测试 `scripts/smoke.mjs`

- 模板来源改为 `--local-repo <REPO_ROOT>` + `--template <分支>`
- 分支由 `UNIBESTX_SMOKE_BRANCH` 覆盖，默认 `uniX-rice-ui`
- 这直接根治"开发者 checkout 停在 `base` 时冒烟误报 z-paging-x 缺失"的问题：即使本地停在 base，冒烟也能精确取到 rice-ui 分支的内容
- 保留至少一个用例走字面路径形态（`--no-local --template <绝对路径>`），覆盖 `template: 'local'` 的断言
- 新增断言：本地分支模式下 `unibestx.template === 'local:<branch>'`

### 8.2 新增冒烟契约用例

| 用例 | 断言 |
|---|---|
| `--local-repo` 指向不存在的路径 | 退出码非 0 |
| `--local-repo` 指向非 git 目录 | 退出码非 0 |
| `--template <不存在的分支>`（本地模式） | 退出码非 0，且输出中列出可用分支 |
| `--no-local` + `UNIBESTX_LOCAL_REPO` 同时存在 | 走远程路径，本地模式被关闭 |
| 裸 `--template main` 且 cwd 存在同名目录 | 按分支名解释，输出警告 |

### 8.3 文档

- `src/utils/help.ts`：新增 `--local-repo` / `--no-local` 说明，示例段补本地调试用法
- `README.md`：参数表新增两行；把 `--template /Users/chenqi/Desktop/unibestX` 这条示例替换为新的推荐用法；生成物元信息一节补 `local:<branch>`
- `DEVELOPER.md`：本地开发一节补"如何用本地模板仓库调试三分支"

### 8.4 启动提示

本地模式生效时，`create` 流程开头输出一行提示，避免"忘了关本地模式却以为在测远程"：

```
本地模板模式已开启: /Users/chenqi/Desktop/unibestX（--no-local 可单次关闭）
```

## 9. 明确不做

- 不改动 `base` 分支极简路的任何内容与判定逻辑（`isMinimalTemplate` 跳过裁剪、跳过 UI 选择的行为原样保留）
- 不重构 `optionsFromFlags` 与 `promptCreateOptions` 之间已存在的重复代码
- 不做分支自动 `git fetch`
- 不支持配置多个本地仓库
- 不引入配置文件（`.unibestxrc` / `unibestx.config.json`）
- `CreateOptions` 不加 `localRepo` 字段 —— 配置在 `createCommand` 内解析后直接传给 `acquireTemplate`，不进入用户配置模型

## 10. 兼容性说明

**行为变更**：裸名 `--template myDir`（cwd 下确实存在该目录、且不含路径分隔符）从"当目录"变为"当分支名"。这是消除 `main` 同名目录隐患的必要代价，通过第 4.1 条的警告日志兜底，并在文档中说明需要目录时请写 `./myDir`。

**保持兼容**：`--template /abs/path`、`--template ./rel-path`、`--template <分支名>` 三种现有用法语义不变。

**未配置本地仓库时**：所有行为与当前版本完全一致。
