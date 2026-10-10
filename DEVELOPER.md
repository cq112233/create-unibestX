# 开发者文档

## 本地开发与调试

```bash
# 1. 安装依赖
pnpm install

# 2. 启动监听模式（实时编译）
pnpm dev

# 3. 本地调试运行 CLI
pnpm start -v
pnpm start -h

# 4. 运行创建命令测试
pnpm start test-app --yes
pnpm start test-app-rice -u rice-ui --yes
pnpm start test-app-min --features none --yes
```

## 用本地模板仓库调试（`--local-repo`）

模板仓库有多条并列分支（`main` / `uniX-uview-ultra` / `uniX-rice-ui` / `base`），
用 `--local-repo` 可以**按分支名**从本地仓库取内容，不必反复切分支：

```bash
# 常开：之后所有创建都从本地取
export UNIBESTX_LOCAL_REPO=/Users/chenqi/Desktop/unibestX

# 取指定分支；工作区正好在该分支上时会连未提交改动一起用
pnpm start my-app --template uniX-uview-ultra --yes

# 临时改回远程
pnpm start my-app --no-local --yes
```

日志会点明这次取的是「工作区（含 N 处未提交改动）」还是「本地克隆，仅已提交内容」——
两者对未提交改动的处理不同，别搞混。

取分支用的是 `git clone --local`（对象库硬链接），不会改动模板仓库，也不会复制那 1.4 GB 的 `.git`。

## 自动化冒烟测试 (Smoke Test)

脚手架内置高标准的端到端冒烟测试，覆盖 8 组功能/分包组合、命令行边界契约，以及
本地模板仓库的配置契约：

```bash
# 编译产物并运行冒烟测试
pnpm build
pnpm smoke

# 只运行特定用例
node scripts/smoke.mjs minimal
node scripts/smoke.mjs full

# 只跑契约检查（快，不需要跑完整生成）
node scripts/smoke.mjs contract      # 命令行边界契约
node scripts/smoke.mjs local-repo    # 本地模板仓库配置契约
```

冒烟测试通过 `--local-repo` + 分支名取模板（默认 `uniX-rice-ui`，可用
`UNIBESTX_SMOKE_BRANCH` 覆盖），所以**不受你本地 checkout 停在哪条分支影响**。

## 发布流程

```bash
# 1. 代码格式化与检查
pnpm build

# 2. 更新版本号
npm version patch # 或 minor / major

# 3. 发布到 npm
npm login --registry=https://registry.npmjs.org/
npm publish --registry=https://registry.npmjs.org/
```
