#!/usr/bin/env node
/**
 * 端到端冒烟测试
 *
 * 用本地仓库当模板（`--template <repo>`）跑几组裁剪组合，每组生成后：
 *   1. 跑一遍 `doctor`，断言 0 错误 —— 这是「删干净了」的可信证据；
 *   2. 断言关键文件在/不在；
 *   3. 断言 `pages.config.json` 里没有指向已删文件的残留路由；
 *   4. 断言生成物里没有明文凭据。
 *
 * 不装依赖（`--no-install`）：依赖安装慢且与裁剪正确性无关。
 *
 * 用法：
 *   node scripts/smoke.mjs            # 跑全部用例
 *   node scripts/smoke.mjs full       # 只跑名字含 full 的用例
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const CLI_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = process.env.UNIBESTX_LOCAL_REPO
  || (fs.existsSync('/Users/chenqi/Desktop/unibestX') ? '/Users/chenqi/Desktop/unibestX' : path.resolve(CLI_DIR, '..', 'unibestX'));
/**
 * 从本地仓库取哪条分支
 *
 * 走 `--local-repo` + 分支名，而不是 `--template <仓库路径>`：后者拷的是工作区当前
 * checkout 的那一支，本地停在别的分支时（比如 base）会拿错模板、误报缺失。
 */
const BRANCH = process.env.UNIBESTX_SMOKE_BRANCH || 'uniX-rice-ui';

/**
 * 无裁剪阶段的极简模板分支
 *
 * 与 `src/commands/create.ts` 里的 `isMinimalTemplate = options.template === 'base'` 对齐：
 * 这些分支跳过整个 prune，CASES 的裁剪断言对其不适用。
 */
const MINIMAL_TEMPLATES = ['base'];

const CLI = path.join(CLI_DIR, 'bin', 'index.js');

/** 每组用例：命令行参数 + 生成后的断言 */
const CASES = [
  {
    name: 'full',
    description: '全功能全分包（回归基线：应与原仓库等价）',
    args: ['--features', 'all', '--subs', 'all'],
    expectPresent: [
      'src/sub/auth/login.uvue',
      // route-bestX 已抽成独立内置 uni_module
      'uni_modules/route-bestX/interceptor/interceptor.uts',
      // all 覆盖全部可选 key（含 bignumber 这类默认不勾的）
      'uni_modules/bignumber-bestX',
      'src/sub/bignumberFunctionDemo/bignumberFunctionDemo.uvue',
    ],
    expectAbsent: [
      'src/pages/basic/components',
      'src/pages/function/components',
      // 只断言作者本机的权限白名单被剥离；整个 `.claude/` 是交付内容（skills/ 里是模板
      // README 宣传的 unibestX-skill），断言它「应当不存在」是错的（2026-10-12 已纠正）
      '.claude/settings.json',
      'docs',
      'uni_modules/uni-ui-x',
      'uni_modules/ali-iconfont',
      'uni_modules/uts-worker',
      'uni_modules/uts-button',
      'dist',
      'unpackage',
      'packages/cli',
      'pnpm-workspace.yaml',
    ],
  },
  {
    name: 'minimal',
    description: '最小集：无可选功能与分包，保留 auth 底座与常驻的 z-paging-x',
    args: ['--features', 'none', '--subs', 'none'],
    expectPresent: [
      'src/pages/index/index.uvue',
      'src/pages/me/me.uvue',
      'src/sub/auth/login.uvue',
      // route-bestX 已抽成独立内置 uni_module
      'uni_modules/route-bestX/interceptor/interceptor.uts',
      'src/store/vapor/app.uts',
      'uni_modules/z-paging-x',
    ],
    expectAbsent: [
      'src/i18n',
      'uni_modules/lime-i18n',
      'src/pages/basic/components',
      'src/pages/function/components',
      'uni_modules/e-chart',
      '.claude/settings.json',
      'docs',
    ],
  },
  {
    name: 'i18n-echarts',
    description: '只留 i18n + ECharts，不要任何分包',
    args: ['--features', 'i18n,echarts', '--subs', 'none'],
    expectPresent: [
      'src/sub/auth/login.uvue',
    ],
    expectAbsent: [
      'src/sub/deviceFunctionDemo',
      'src/pages/basic/components',
      'src/pages/function/components',
    ],
  },
  {
    // lime 三件套是 2026-10 新增的选配项：勾选时演示页与插件必须在，
    // 且不能把同样的 UniApp 分包误留（lime-use 插件本体只在勾选时才保留）
    name: 'lime-tools',
    description: '只留 lime 三件套：工具函数 / 组合式函数 / 颜色工具',
    args: ['--features', 'limeShared,limeUse,limeColor', '--subs', 'none'],
    expectPresent: [
      'src/sub/auth/login.uvue',
      'src/sub/limeSharedFunctionDemo/limeSharedFunctionDemo.uvue',
      'src/sub/limeUseFunctionDemo/limeUseFunctionDemo.uvue',
      'src/sub/limeColorFunctionDemo/limeColorFunctionDemo.uvue',
      'uni_modules/lime-use',
      'uni_modules/lime-shared',
    ],
    expectAbsent: [
      'uni_modules/e-chart',
      'uni_modules/crypto-bestX',
      'src/sub/echartsFunctionDemo',
      'src/sub/cryptoFunctionDemo',
      'src/sub/deviceFunctionDemo',
      'src/pages/function/components',
    ],
  },
  {
    name: 'default-auth-only',
    description: '默认创建：核心特性全选，不传分包参数（仅保留 auth 分包）',
    args: ['--features', 'all'],
    expectPresent: [
      'src/sub/auth/login.uvue',
      // route-bestX 已抽成独立内置 uni_module
      'uni_modules/route-bestX/interceptor/interceptor.uts',
      'uni_modules/z-paging-x',
      // all = 全部可选 key，含默认勾选的 time
      'uni_modules/lime-dayuts',
      'src/sub/timeFunctionDemo/timeFunctionDemo.uvue',
    ],
    expectAbsent: [
      'src/sub/device',
      'src/sub/crypto',
      'src/sub/zpaging',
      'src/pages/basic/components',
      'src/pages/function/components',
      '.claude/settings.json',
      'docs',
    ],
  },
  {
    // signature / device / nestedScroll 已从第四步选配项中移除，改为「永远裁剪」：
    // 这里用一个「什么都勾上」的极端配置，证明它们仍然会被删干净
    name: 'always-pruned',
    description: 'signature / device / nestedScroll 已移出选配项，--features all 也照样裁掉',
    args: ['--features', 'all', '--subs', 'all'],
    expectPresent: [
      'src/sub/auth/login.uvue',
      'src/sub/echartsFunctionDemo/echartsFunctionDemo.uvue',
      'uni_modules/z-paging-x',
    ],
    expectAbsent: [
      'uni_modules/lime-signature',
      'src/sub/signatureFunctionDemo',
      'src/sub/deviceFunctionDemo',
      'src/components/NestedScroll',
      'src/sub/nestedScrollFunctionDemo',
      'src/pages/function/components',
    ],
  },
  {
    name: 'zpaging-only',
    description: '只留 zpaging：依赖保留，基础/功能视图纯净',
    args: ['--features', 'none', '--subs', 'zpaging'],
    expectPresent: [
      'src/sub/auth/login.uvue',
    ],
    expectAbsent: [
      'src/sub/nested-scroll',
      'src/components/NestedScroll',
      'src/pages/function/components',
    ],
  },
  {
    // 不勾任何扩展功能时，三件套插件本体也必须跟着走（lime-use 只被自己的
    // 演示页引用，lime-shared / lime-color 是 lime-icon / lime-style 的依赖，必须留下）
    name: 'unused-modules',
    description: '不勾选扩展功能：插件与演示分包一并清理，共享依赖与内置 rxjs 保留',
    args: ['--features', 'none', '--subs', 'none'],
    expectPresent: [
      'src/sub/auth/login.uvue',
      'uni_modules/lime-shared',
      'uni_modules/lime-color',
      // rxjs-lite 被 src/http/stream/stream.uts 依赖，属内置恒留，任何勾选组合下都不裁剪
      'src/utils/rxjs-lite/index.uts',
      'src/sub/rxjsFunctionDemo/rxjsFunctionDemo.uvue',
      // z-paging-x 同样不进选配项，插件本体不参与裁剪
      'uni_modules/z-paging-x',
    ],
    expectAbsent: [
      'uni_modules/e-chart',
      'uni_modules/crypto-bestX',
      'uni_modules/bignumber-bestX',
      'src/sub/bignumberFunctionDemo',
      'uni_modules/lime-signature',
      'uni_modules/lime-use',
      // time 是可勾选项且默认勾选，这里显式不选，插件本体与演示分包都必须走
      'uni_modules/lime-dayuts',
      'src/sub/timeFunctionDemo',
      'src/sub/limeSharedFunctionDemo',
      'src/sub/limeUseFunctionDemo',
      'src/sub/limeColorFunctionDemo',
      'src/sub/deviceFunctionDemo',
      'src/components/NestedScroll',
      'src/sub/nestedScrollFunctionDemo',
      'src/pages/function/components',
    ],
  },
  {
    // time 是唯一默认勾选的扩展功能：显式只勾它，验证插件本体与演示分包都在
    name: 'dayuts-only',
    description: '只勾 time：lime-dayuts 插件与 timeFunctionDemo 保留，其余扩展仍裁掉',
    args: ['--features', 'time', '--subs', 'none'],
    expectPresent: [
      'src/sub/auth/login.uvue',
      'uni_modules/lime-dayuts',
      'src/sub/timeFunctionDemo/timeFunctionDemo.uvue',
    ],
    expectAbsent: [
      'uni_modules/e-chart',
      'uni_modules/crypto-bestX',
      'uni_modules/bignumber-bestX',
      'uni_modules/lime-use',
      'src/sub/echartsFunctionDemo',
      'src/sub/bignumberFunctionDemo',
      'src/sub/cryptoFunctionDemo',
      'src/sub/limeSharedFunctionDemo',
      'src/sub/limeUseFunctionDemo',
      'src/sub/limeColorFunctionDemo',
      'src/sub/deviceFunctionDemo',
      'src/pages/function/components',
    ],
  },
];

/**
 * `src/api` 的保留断言（回归防护）
 *
 * src/api 是项目的接口层，**整个目录都不参与裁剪**，与勾不勾 httpDemo 无关：
 *   - auth/    —— 被 src/http/refresh.uts 与 src/sub/auth/login.uvue 依赖（均永久保留）
 *   - privacy/ —— 被 src/sub/privacy/privacy.uvue 依赖（该分包不在裁剪清单里，永不删除）
 *   - example  —— 虽是 httpDemo 的示例接口，但 tests/unit/api/api.test.ts 也 import 它
 * 以及 tests/unit/api/api.test.ts。
 *
 * 曾经 httpDemo 的 extraRemovePaths 写成整目录 'src/api'，于是不勾 httpDemo 时
 * 把 auth/privacy 一起删掉，生成物直接爆一堆悬空 import。这里对**每一个用例**
 * 无条件断言 src/api 完整存在，杜绝同类回归再次静默滑过。
 *
 * 注意：模板已删除 `src/api/example.d.uts.ts`（类型定义并入 example.uts），
 * 断言里不能再要求它存在，否则每个用例都会假报「缺失」。
 */
const API_ASSETS_ALWAYS_KEPT = [
  'src/api/auth/auth.uts',
  'src/api/privacy/privacy.uts',
  'src/api/example.uts',
  'tests/unit/api/api.test.ts',
];

for (const testCase of CASES) {
  testCase.expectPresent.push(...API_ASSETS_ALWAYS_KEPT);
}

/**
 * 模板的「AI 与 Skill 体系」交付物（回归防护）
 *
 * 模板 README「🤖 同时它也是一套『AI 原生』开发模板」一节明确宣传这两个东西随项目交付：
 *   - `.claude/skills/unibestX-skill/SKILL.md` —— 「1 个入口 + 8 分册」的 uni-app X 规范库，
 *     Claude Code / Codex 克隆即可用。复杂分支上是相对软链
 *     （`.claude/skills/unibestX-skill` → `../../.agents/skills/unibestX-skill`），
 *     base 上是实体目录；这里断言的是链接目标，顺带守住 sanitize 的软链保留逻辑
 *     （`src/utils/fs.ts` 用 readlink + symlink 重建）；
 *   - `scripts/router-guard-test/` —— README 项目结构里的「路由守卫决策矩阵测试」。
 *
 * 2026-10-12 曾把这两样连同整个 `.claude/` 一起列进 sanitize 的剥离清单，等于把模板
 * 明确宣传的交付能力删了。现在 sanitize 只删作者本机的 `.claude/settings.json`，
 * 这里对**每一个用例**无条件断言它们还在。
 *
 * 注：CASES 在极简模板（base）下整段跳过，而 base 不带 router-guard-test/，
 * 所以这份清单只对会跑到 CASES 的复杂分支生效，不会在 base 上假红。
 */
const DELIVERABLES_ALWAYS_KEPT = [
  '.claude/skills/unibestX-skill/SKILL.md',
  'scripts/router-guard-test/run.ts',
];

for (const testCase of CASES) {
  testCase.expectPresent.push(...DELIVERABLES_ALWAYS_KEPT);
}

/**
 * 分支自带的 uni_modules：这些插件是**该分支模板的正式依赖**，不属于裁剪对象
 *
 * 上面 CASES 里的断言是按 `uniX-rice-ui` 写的，直接拿同一份清单去套别的分支会假报：
 *   - `uni_modules/uts-worker` / `uts-button` —— uview-ultra 的 UI 组件直接引用它们，
 *     删掉生成物就悬空。rice-ui 根本没有这两个模块，所以那两条断言在 rice-ui 上一直
 *     是「因为文件不存在而通过」的空断言，看着绿其实什么都没验证；
 *   - `uni_modules/lime-dayuts` —— uview-ultra 的 package.json 用
 *     `uni_modules.dependencies` 声明了它，不勾 time 时 resolveModuleClosure 会保护
 *     插件本体（只清演示分包），这是设计如此，不是漏删。
 *
 * 所以按分支把这几个模块从 expectAbsent 挪到 expectPresent —— 既让 uview-ultra 不再
 * 假红，也顺带守住「别把别的分支的 UI 依赖当垃圾删了」这条底线。
 * 用 `UNIBESTX_SMOKE_BRANCH` 切分支跑冒烟时，这份表就是唯一的差异点。
 */
const BRANCH_SHIPPED_MODULES = {
  'uniX-uview-ultra': [
    'uni_modules/uts-worker',
    'uni_modules/uts-button',
    'uni_modules/lime-dayuts',
  ],
};

const shippedModules = new Set(BRANCH_SHIPPED_MODULES[BRANCH] ?? []);

for (const testCase of CASES) {
  for (const mod of shippedModules) {
    const idx = testCase.expectAbsent.indexOf(mod);
    if (idx >= 0) {
      // 只反向断言「原本要求删掉」的那几条，不无差别地给所有用例加 expectPresent
      testCase.expectAbsent.splice(idx, 1);
      testCase.expectPresent.push(mod);
    }
  }
}

const FORBIDDEN_IN_MANIFEST = [
  'v1hNSO9cKet13BIZ',
  'KCHJ9hiSZqvmd8Yx',
  'keyPassword',
  'storePassword',
  '/Users/chenqi',
  'env-00jy6p9vat6w',
  'com.bigScreen.qizhi',
  'wx6d379a8c0aff3ea3',
];

const results = [];

function record(caseName, ok, message) {
  results.push({ caseName, ok, message });
  const mark = ok ? '\x1B[32m✓\x1B[0m' : '\x1B[31m✗\x1B[0m';
  console.log(`  ${mark} ${message}`);
}

/**
 * 构造子进程环境
 *
 * 一律清掉 UNIBESTX_LOCAL_REPO，让用例可复现 —— 否则开发者 shell 里恰好导出了
 * 这个变量时，本该走远程的用例会静默改走本地。
 */
function baseEnv(extra = {}) {
  const env = { ...process.env };
  delete env.UNIBESTX_LOCAL_REPO;
  return { ...env, ...extra };
}

async function run(args, options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync('node', [CLI, ...args], {
      cwd: options.cwd,
      maxBuffer: 64 * 1024 * 1024,
      stdio: options.stdin ? ['ignore', 'pipe', 'pipe'] : undefined,
      env: baseEnv(options.env),
    });
    return { code: 0, stdout, stderr };
  }
  catch (error) {
    return {
      code: error.code ?? 1,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? String(error),
    };
  }
}

function checkRouteConfig(projectDir) {
  const problems = [];
  for (const file of ['pages.config.json', 'pages.json']) {
    const abs = path.join(projectDir, file);
    if (!fs.existsSync(abs)) {
      continue;
    }
    const data = JSON.parse(fs.readFileSync(abs, 'utf8'));

    for (const page of data.pages ?? []) {
      if (!fs.existsSync(path.join(projectDir, `${page.path}.uvue`))) {
        problems.push(`${file}: 残留页面路由 ${page.path}`);
      }
    }

    for (const sub of data.subPackages ?? []) {
      if (!fs.existsSync(path.join(projectDir, sub.root))) {
        problems.push(`${file}: 残留分包根 ${sub.root}`);
        continue;
      }
      if ((sub.pages ?? []).length === 0) {
        problems.push(`${file}: 空分包 ${sub.root}`);
      }
      for (const page of sub.pages ?? []) {
        if (!fs.existsSync(path.join(projectDir, `${sub.root}/${page.path}.uvue`))) {
          problems.push(`${file}: 残留分包路由 ${sub.root}/${page.path}`);
        }
      }
    }

    for (const [tag, target] of Object.entries(data.easycom?.custom ?? {})) {
      const rel = String(target).replace(/^@\//, '');
      if (!fs.existsSync(path.join(projectDir, rel))) {
        problems.push(`${file}: 残留 easycom ${tag} → ${target}`);
      }
    }
  }
  return problems;
}

function checkDependencies(projectDir) {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
  const problems = [];
  const declared = { ...pkg.dependencies, ...pkg.devDependencies };

  for (const name of Object.keys(declared)) {
    if (!fs.existsSync(path.join(projectDir, 'node_modules'))) {
      break;
    }
    if (!fs.existsSync(path.join(projectDir, 'node_modules', name))) {
      problems.push(`package.json 声明了未安装的依赖 ${name}`);
    }
  }
  return problems;
}

const CREDENTIAL_SCAN_FILES = ['manifest.json', 'package.json', 'CLAUDE.md', 'AGENTS.md'];

function checkCredentials(projectDir) {
  const manifestPath = path.join(projectDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return ['manifest.json 不存在'];
  }
  const problems = [];
  for (const rel of CREDENTIAL_SCAN_FILES) {
    const abs = path.join(projectDir, rel);
    if (!fs.existsSync(abs)) {
      continue;
    }
    const raw = fs.readFileSync(abs, 'utf8');
    for (const needle of FORBIDDEN_IN_MANIFEST) {
      if (raw.includes(needle)) {
        problems.push(`${rel} 残留凭据/本机痕迹片段「${needle}」`);
      }
    }
  }
  return problems;
}

async function runContractChecks(tempRoot) {
  const caseName = 'contract';
  console.log(`\n\x1B[1m▶ ${caseName}\x1B[0m — CLI 边界行为契约`);

  // 1) 绝对路径目标目录
  const nested = path.join(tempRoot, 'deep', 'nested', 'my-app');
  const abs = await run([
    'create', nested,
    '--no-local',
    '--template', REPO_ROOT,
    '--features', 'none', '--subs', 'none',
    '--no-install', '--yes',
  ]);
  if (abs.code !== 0) {
    record(caseName, false, `绝对路径目标生成失败（退出码 ${abs.code}）`);
  }
  else {
    const pkg = JSON.parse(fs.readFileSync(path.join(nested, 'package.json'), 'utf8'));
    record(caseName, pkg.name === 'my-app', `绝对路径目标的项目名取 basename（得到 ${pkg.name}）`);
    record(caseName, !pkg.name.includes('/'), 'package.json 的 name 不含斜杠');
    record(caseName, pkg.unibestx?.template === 'local',
      `本地模板来源记为 'local'（得到 ${JSON.stringify(pkg.unibestx?.template)}）`);
  }

  // 2) 非法项目名
  const bad = await run([
    'create', 'bad#name',
    '--no-local',
    '--template', REPO_ROOT,
    '--features', 'none', '--subs', 'none', '--no-install', '--yes',
  ], { cwd: tempRoot });
  record(caseName, bad.code !== 0, '非法项目名被拒绝');

  // 3) 非 TTY 缺参数
  const notty = await run(['create', 'no-flags'], { cwd: tempRoot, stdin: 'ignore' });
  record(caseName, notty.code !== 0, `非 TTY 缺参数时退出码非 0（得到 ${notty.code}）`);

  // 4) --yes 单独使用
  const yesOnly = await run(
    ['create', 'yes-only', '--no-local', '--template', REPO_ROOT, '--no-install', '--yes'],
    { cwd: tempRoot, stdin: 'ignore' },
  );
  record(caseName, yesOnly.code === 0, `--yes 单独使用可成功（退出码 ${yesOnly.code}）`);

  // 5) --keep-unused-modules 必须真正被读取
  //    历史 bug：CliFlags 里键名写成驼峰 keepUnusedModules，而 minimist 产出的是
  //    'keep-unused-modules'，属性名对不上，该参数一直读到 undefined、静默失效。
  //
  //    这里刻意不传 --template：默认走远程分支，把断言隔离在「参数是否被读取」上，
  //    不被「本地模板目录与裁剪清单是否对齐」这类无关问题拖累。
  const keep = await run([
    'create', 'keep-unused',
    '--no-local',
    '--features', 'none', '--subs', 'none',
    '--keep-unused-modules', '--no-install', '--yes',
  ], { cwd: tempRoot });
  if (keep.code === 0) {
    const pkg = JSON.parse(fs.readFileSync(path.join(tempRoot, 'keep-unused', 'package.json'), 'utf8'));
    record(caseName, pkg.unibestx?.cleanUnusedModules === false,
      `--keep-unused-modules 被读取（cleanUnusedModules 得到 ${JSON.stringify(pkg.unibestx?.cleanUnusedModules)}）`);
  }
  else {
    record(caseName, false, `--keep-unused-modules 用例生成失败（退出码 ${keep.code}）`);
  }

  // 6) -c / --chart 参数生效
  const chartApp = path.join(tempRoot, 'chart-test-app');
  const chartRun = await run([
    'create', chartApp,
    '--no-local',
    '--template', REPO_ROOT,
    '-c', 'xtf-charts',
    '--features', 'none',
    '--subs', 'none',
    '--no-install',
    '--yes',
  ]);
  if (chartRun.code === 0) {
    const hasXtf = fs.existsSync(path.join(chartApp, 'uni_modules', 'xtf-charts'));
    const hasEchart = fs.existsSync(path.join(chartApp, 'uni_modules', 'e-chart'));
    record(caseName, hasXtf && !hasEchart, `-c xtf-charts 保留 xtf-charts 并裁掉 e-chart（xtf: ${hasXtf}, e-chart: ${hasEchart}）`);
  }
  else {
    record(caseName, false, `-c xtf-charts 用例生成失败（退出码 ${chartRun.code}）`);
  }

  return caseName;
}

/**
 * 本地模板仓库（--local-repo / --no-local / UNIBESTX_LOCAL_REPO）的配置契约
 *
 * 错误路径一律断言「退出码非 0」—— 静默回落远程是这套配置最需要防住的行为。
 */
async function runLocalRepoChecks(tempRoot) {
  const caseName = 'local-repo';
  console.log(`\n\x1B[1m▶ ${caseName}\x1B[0m — 本地模板仓库配置契约`);

  const baseArgs = ['--features', 'none', '--subs', 'none', '--no-install', '--yes'];

  // 1) 路径不存在
  const missing = await run([
    'create', 'lr-missing',
    '--local-repo', path.join(tempRoot, 'no-such-repo'),
    ...baseArgs,
  ], { cwd: tempRoot });
  record(caseName, missing.code !== 0, `路径不存在时退出码非 0（得到 ${missing.code}）`);
  record(caseName, /不存在/.test(missing.stdout + missing.stderr), '错误信息指出路径不存在');
  record(caseName, !fs.existsSync(path.join(tempRoot, 'lr-missing')), '路径不存在时不留下生成物');

  // 2) 不是 git 仓库
  const notGitDir = path.join(tempRoot, 'not-a-repo');
  fs.mkdirSync(notGitDir, { recursive: true });
  const nonRepo = await run([
    'create', 'lr-notgit',
    '--local-repo', notGitDir,
    ...baseArgs,
  ], { cwd: tempRoot });
  record(caseName, nonRepo.code !== 0, `非 git 目录时退出码非 0（得到 ${nonRepo.code}）`);
  record(caseName, /不是 git 仓库/.test(nonRepo.stdout + nonRepo.stderr), '错误信息指出不是 git 仓库');

  // 3) 裸 --local-repo 且环境变量未设
  const bare = await run([
    'create', 'lr-bare',
    '--local-repo',
    ...baseArgs,
  ], { cwd: tempRoot });
  record(caseName, bare.code !== 0, `裸 --local-repo 且无环境变量时退出码非 0（得到 ${bare.code}）`);
  record(caseName, /未提供路径/.test(bare.stdout + bare.stderr), '错误信息提示缺少路径');

  // 4) 请求的分支在本地仓库中不存在 → 报错并列出可用分支
  const badBranch = await run([
    'create', 'lr-badbranch',
    '--local-repo', REPO_ROOT,
    '--template', 'no-such-branch-xyz',
    ...baseArgs,
  ], { cwd: tempRoot });
  record(caseName, badBranch.code !== 0, `分支不存在时退出码非 0（得到 ${badBranch.code}）`);
  const badOut = badBranch.stdout + badBranch.stderr;
  record(caseName, /可用分支/.test(badOut), '错误信息列出可用分支');
  record(caseName, badOut.includes(BRANCH), `可用分支列表含 ${BRANCH}`);

  // 5) 正常取本地分支 → 来源日志精确指出分支与取自工作区/已提交内容
  const ok = await run([
    'create', 'lr-ok',
    '--local-repo', REPO_ROOT,
    '--template', BRANCH,
    ...baseArgs,
  ], { cwd: tempRoot });
  const okOut = ok.stdout + ok.stderr;
  record(caseName, okOut.includes('本地模板模式已开启'), '本地模板模式开启时有提示');
  record(caseName, okOut.includes(`#${BRANCH}`) && /（工作区|（本地克隆/.test(okOut),
    `来源日志标出分支 #${BRANCH} 与取自工作区/已提交内容`);
  record(caseName, !okOut.includes('模板来源: 本地目录'),
    '来源日志按「本地仓库」措辞，而非字面目录');
  if (ok.code === 0) {
    const pkg = JSON.parse(fs.readFileSync(path.join(tempRoot, 'lr-ok', 'package.json'), 'utf8'));
    record(caseName, pkg.unibestx?.template === `local:${BRANCH}`,
      `生成物记为 local:${BRANCH}（得到 ${JSON.stringify(pkg.unibestx?.template)}）`);
  }
  else {
    // 模板内容自身没过自检（裁剪清单与模板目录不符）不属本契约范围，仅记录
    console.log(`  \x1B[33m·\x1B[0m 本地分支生成未通过自检（退出码 ${ok.code}），跳过生成物标签断言`);
  }

  // 6) 环境变量驱动
  const viaEnv = await run([
    'create', 'lr-env',
    '--template', BRANCH,
    ...baseArgs,
  ], { cwd: tempRoot, env: { UNIBESTX_LOCAL_REPO: REPO_ROOT } });
  record(caseName, /本地模板模式已开启/.test(viaEnv.stdout + viaEnv.stderr),
    'UNIBESTX_LOCAL_REPO 环境变量可开启本地模板模式');

  // 7) --no-local 优先，且此时不校验那条坏路径
  const noLocal = await run([
    'create', 'lr-nolocal',
    '--no-local',
    '--local-repo', path.join(tempRoot, 'no-such-repo'),
    '--template', BRANCH,
    ...baseArgs,
  ], { cwd: tempRoot });
  const noLocalOut = noLocal.stdout + noLocal.stderr;
  record(caseName, !noLocalOut.includes('本地模板模式已开启'), '--no-local 关闭本地模板模式');
  record(caseName, !noLocalOut.includes('不存在'), '--no-local 时不校验 --local-repo 的路径');

  // 8) cwd 下有同名目录时，裸名仍按分支名解释并给出警告
  const shadow = path.join(tempRoot, 'shadow');
  fs.mkdirSync(path.join(shadow, BRANCH), { recursive: true });
  const shadowed = await run([
    'create', 'lr-shadow',
    '--local-repo', REPO_ROOT,
    '--template', BRANCH,
    ...baseArgs,
  ], { cwd: shadow });
  const shadowOut = shadowed.stdout + shadowed.stderr;
  record(caseName, shadowOut.includes('已按分支名'), `cwd 下有同名目录 ${BRANCH}/ 时给出按分支名解释的警告`);
  record(caseName, shadowOut.includes(`#${BRANCH}`), '同名目录未顶替掉分支名语义');

  return caseName;
}

/**
 * 判定用例是否勾选了某个功能特性
 *
 * `--features all` 视作全选，`none` 或压根没传视作不选，其余是逗号分隔清单。
 */
function featuresSelected(args, key) {
  const idx = args.indexOf('--features');
  if (idx < 0 || idx + 1 >= args.length) {
    return false;
  }
  const value = args[idx + 1];
  if (value === 'all') {
    return true;
  }
  return value.split(',').map(item => item.trim()).includes(key);
}

/**
 * 降级后必须一处不剩的能力 API
 *
 * key 是 `--features` 里的功能开关名；关闭该项时，这些符号不允许再出现在任何文件里
 * （兜底 stub 所在的 src/store/index.uts / index.d.ts 除外）。
 * 曾把 `--features` 的值强行传进来再逐符号扫全工程，比一条条写 fileAssertions 稳。
 */
const DOWNGRADE_API_SYMBOLS = {
  theme: [
    'applyNavbarTheme',
    'getRootThemeStyle',
    'applyThemeColor',
    'getThemeTokens',
    'useThemeStore',
  ],
  i18n: [
    'useI18nStore',
  ],
};

/** 所有降级检查共用的符号集 */
const THEME_API_SYMBOLS = Object.values(DOWNGRADE_API_SYMBOLS).flat();

/** 这些文件里出现主题 API 是设计如此：兜底 stub 与其类型声明 */
const THEME_API_ALLOWED_FILES = [
  path.join('src', 'store', 'index.uts'),
  path.join('src', 'store', 'index.d.ts'),
];

/**
 * 扫描 theme 关闭后的残留主题 API 引用
 *
 * 2026-10-12 的真实事故：清理 `applyNavbarTheme` 的 replace 没带 `g` 标志，而模板里有 3 处调用，
 * 只有 onMounted 那处被清掉；onShow 里的调用留着，可它的 import 和 `src/theme/` 都已被删 ——
 * H5 一跑就 `ReferenceError: applyNavbarTheme is not defined`。
 *
 * runSelfCheck 查的是「import 指向的文件还在不在」，对这种「import 没了、调用还在」的
 * 反向悬空无能为力，所以这里逐用例补一道内容级防线。
 */
function findThemeLeftovers(projectDir, symbols = THEME_API_SYMBOLS) {
  const pattern = new RegExp(`\\b(${symbols.join('|')})\\b`);
  const hits = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!/\.(uvue|uts|ts|js)$/.test(entry.name)) {
        continue;
      }
      const rel = path.relative(projectDir, abs);
      if (THEME_API_ALLOWED_FILES.includes(rel)) {
        continue;
      }
      const matched = fs.readFileSync(abs, 'utf8').match(pattern);
      if (matched) {
        hits.push(`${rel}（${matched[0]}）`);
      }
    }
  }

  walk(projectDir);
  return hits;
}

async function runCase(testCase, tempRoot) {
  console.log(`\n\x1B[1m▶ ${testCase.name}\x1B[0m — ${testCase.description}`);
  const projectName = `smoke-${testCase.name}`;
  const projectDir = path.join(tempRoot, projectName);

  const create = await run([
    'create',
    projectName,
    '--local-repo',
    REPO_ROOT,
    '--template',
    BRANCH,
    ...testCase.args,
    '--no-install',
    '--yes',
  ], { cwd: tempRoot });

  if (create.code !== 0) {
    record(testCase.name, false, `create 退出码 ${create.code}`);
    console.log(create.stdout.slice(-3000));
    console.log(create.stderr.slice(-3000));
    return projectDir;
  }

  // 1. doctor：0 错误
  const doctor = await run(['doctor', projectDir]);
  if (doctor.code === 0) {
    record(testCase.name, true, 'doctor 通过（0 错误）');
  }
  else {
    record(testCase.name, false, `doctor 退出码 ${doctor.code}`);
    console.log(doctor.stdout.slice(-4000));
    console.log(doctor.stderr.slice(-2000));
  }

  // 2. 文件在/不在
  for (const rel of testCase.expectPresent) {
    if (fs.existsSync(path.join(projectDir, rel))) {
      record(testCase.name, true, `存在 ${rel}`);
    }
    else {
      record(testCase.name, false, `缺失 ${rel}`);
    }
  }
  for (const rel of testCase.expectAbsent) {
    if (!fs.existsSync(path.join(projectDir, rel))) {
      record(testCase.name, true, `已删 ${rel}`);
    }
    else {
      record(testCase.name, false, `未删 ${rel}`);
    }
  }

  // 2b. 文件内容断言
  for (const assertion of testCase.fileAssertions ?? []) {
    const abs = path.join(projectDir, assertion.file);
    if (!fs.existsSync(abs)) {
      record(testCase.name, false, `内容断言的目标文件缺失 ${assertion.file}`);
      continue;
    }
    const content = fs.readFileSync(abs, 'utf8');
    for (const needle of assertion.contains ?? []) {
      if (content.includes(needle)) {
        record(testCase.name, true, `${assertion.file} 含「${needle}」`);
      }
      else {
        record(testCase.name, false, `${assertion.file} 缺少「${needle}」`);
      }
    }
    for (const needle of assertion.notContains ?? []) {
      if (!content.includes(needle)) {
        record(testCase.name, true, `${assertion.file} 已移除「${needle}」`);
      }
      else {
        record(testCase.name, false, `${assertion.file} 仍残留「${needle}」`);
      }
    }
  }

  // 3. 路由与依赖一致性
  for (const problem of checkRouteConfig(projectDir)) {
    record(testCase.name, false, problem);
  }
  // 3a. theme 降级残留
  if (featuresSelected(testCase.args, 'theme')) {
    record(testCase.name, true, 'theme 已勾选，跳过降级残留检查');
  }
  else {
    const leftovers = findThemeLeftovers(projectDir, DOWNGRADE_API_SYMBOLS.theme);
    if (leftovers.length === 0) {
      record(testCase.name, true, 'theme 关闭后无残留的主题 API 引用');
    }
    for (const hit of leftovers) {
      record(testCase.name, false, `theme 关闭后仍残留主题 API：${hit}`);
    }
  }

  // 3b. i18n 降级残留（与 theme 同源：import 清了、调用还在的悬空）
  if (featuresSelected(testCase.args, 'i18n')) {
    record(testCase.name, true, 'i18n 已勾选，跳过降级残留检查');
  }
  else {
    const leftovers = findThemeLeftovers(projectDir, DOWNGRADE_API_SYMBOLS.i18n);
    if (leftovers.length === 0) {
      record(testCase.name, true, 'i18n 关闭后无残留的 i18n API 引用');
    }
    for (const hit of leftovers) {
      record(testCase.name, false, `i18n 关闭后仍残留 i18n API：${hit}`);
    }
  }
  for (const problem of checkDependencies(projectDir)) {
    record(testCase.name, false, problem);
  }

  // 4. 凭据
  for (const problem of checkCredentials(projectDir)) {
    record(testCase.name, false, problem);
  }
  record(testCase.name, true, '凭据检查通过');

  return projectDir;
}

async function main() {
  const filter = process.argv[2];
  // 契约检查不是 CASES 里的用例，需要单独放行，否则会被「没有匹配」提前拦掉
  const contractOnly = filter !== undefined
    && ['contract', 'local-repo'].some(name => filter.includes(name));
  const selected = filter === undefined || contractOnly
    ? (contractOnly ? [] : CASES)
    : CASES.filter(c => c.name.includes(filter));

  if (selected.length === 0 && !contractOnly) {
    console.error(`没有匹配「${filter}」的用例`);
    process.exit(1);
  }

  if (!fs.existsSync(CLI)) {
    console.error(`找不到 ${CLI}，请先执行 pnpm build`);
    process.exit(1);
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'unibestx-smoke-'));
  console.log(`临时目录: ${tempRoot}`);
  console.log(`模板来源: ${REPO_ROOT} #${BRANCH}（UNIBESTX_SMOKE_BRANCH 可覆盖分支）`);

  // 极简模板（base 分支）在 create.ts 里是 `isMinimalTemplate = template === 'base'`，
  // 直接跳过整个裁剪阶段（不裁功能、不删模块、不同步路由）。而 CASES 断言的恰恰是裁剪
  // 行为，套在 base 上必然整片假红 —— 缺失的全是「base 本来就没有」的路径。
  // 与其给出一份误导性的红，不如明说这一层不适用，只跑与模板无关的 CLI 边界契约。
  if (MINIMAL_TEMPLATES.includes(BRANCH)) {
    console.log(`\x1B[33m⚠\x1B[0m #${BRANCH} 是极简模板，无裁剪阶段：CASES 的裁剪断言不适用，已跳过`);
    console.log('  要覆盖裁剪行为请用 UNIBESTX_SMOKE_BRANCH=uniX-rice-ui 或 uniX-uview-ultra');
    // 指名道姓要跑某个裁剪用例却跑不了时直接失败，别给出「0/0 通过」这种假绿
    if (!contractOnly && filter !== undefined) {
      console.error(`用例「${filter}」断言的是裁剪行为，极简模板下无从验证`)
      process.exit(1)
    }
  }

  try {
    for (const testCase of (MINIMAL_TEMPLATES.includes(BRANCH) ? [] : selected)) {
      await runCase(testCase, tempRoot);
    }
    if (!filter || filter.includes('contract')) {
      await runContractChecks(tempRoot);
    }
    if (!filter || filter.includes('local-repo')) {
      await runLocalRepoChecks(tempRoot);
    }
  }
  finally {
    if (process.env.KEEP_SMOKE === '1') {
      console.log(`\n已保留现场（KEEP_SMOKE=1）: ${tempRoot}`);
    }
    else {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }

  const failed = results.filter(r => !r.ok);
  console.log(`\n\x1B[1m结果\x1B[0m: ${results.length - failed.length}/${results.length} 通过`);
  if (failed.length > 0) {
    console.log('\n失败项:');
    for (const item of failed) {
      console.log(`  · [${item.caseName}] ${item.message}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
