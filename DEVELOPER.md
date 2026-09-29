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
pnpm start test-app-min --features none --subs none --yes
```

## 自动化冒烟测试 (Smoke Test)

脚手架内置高标准的端到端冒烟测试，覆盖 8 组功能/分包组合以及命令行边界契约：

```bash
# 编译产物并运行冒烟测试
pnpm build
pnpm smoke

# 只运行特定用例
node scripts/smoke.mjs minimal
node scripts/smoke.mjs full
```

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
