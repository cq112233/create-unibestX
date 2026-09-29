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
const CLI = path.join(CLI_DIR, 'bin', 'index.js');

/** 每组用例：命令行参数 + 生成后的断言 */
const CASES = [
  {
    name: 'full',
    description: '全功能全分包（回归基线：应与原仓库等价）',
    args: ['--features', 'all', '--subs', 'all'],
    expectPresent: [
      'src/sub/auth/login.uvue',
      'src/router/interceptor.uts',
      'uni_modules/e-chart',
      'src/pages/basic/views/BasicView.uvue',
      'src/pages/function/views/FunctionView.uvue',
    ],
    expectAbsent: [
      'src/pages/basic/components',
      'src/pages/function/components',
      'src/pages/ai',
      '.claude',
      'docs',
      'Dockerfile',
      'uni_modules/uni-ui-x',
      'uni_modules/ali-iconfont',
      'scripts/router-guard-test',
      'dist',
      'unpackage',
      'packages/cli',
      'pnpm-workspace.yaml',
    ],
  },
  {
    name: 'minimal',
    description: '最小集：无可选功能与分包，保留 auth 底座',
    args: ['--features', 'none', '--subs', 'none'],
    expectPresent: [
      'src/pages/index/index.uvue',
      'src/pages/me/me.uvue',
      'src/sub/auth/login.uvue',
      'src/router/interceptor.uts',
      'src/store/vapor/app.ts',
    ],
    expectAbsent: [
      'src/pages/ai',
      'src/i18n',
      'uni_modules/lime-i18n',
      'src/pages/basic/components',
      'src/pages/function/components',
      'uni_modules/e-chart',
      '.claude',
      'docs',
    ],
  },
  {
    name: 'i18n-echarts',
    description: '只留 i18n + ECharts，不要任何分包',
    args: ['--features', 'i18n,echarts', '--subs', 'none'],
    expectPresent: [
      'src/i18n/locales/en-US.json',
      'src/pages/basic/views/BasicView.uvue',
      'src/pages/function/views/FunctionView.uvue',
      'uni_modules/e-chart',
      'src/sub/auth/login.uvue',
    ],
    expectAbsent: [
      'src/sub/device',
      'src/pages/ai',
      'src/pages/basic/components',
      'src/pages/function/components',
    ],
  },
  {
    name: 'auth-subs',
    description: 'device/lodash 两个分包',
    args: ['--features', 'none', '--subs', 'device,lodash'],
    expectPresent: [
      'src/sub/auth/login.uvue',
      'src/router/interceptor.uts',
      'src/sub/device/device.uvue',
      'src/sub/lodash/lodash.uvue',
      'uni_modules/iRainna-lodash',
      'src/pages/basic/views/BasicView.uvue',
      'src/pages/function/views/FunctionView.uvue',
    ],
    expectAbsent: [
      'src/sub/crypto',
      'src/sub/time',
      'src/sub/zpaging',
      'src/sub/rxjsDemo',
      'uni_modules/lime-dayuts',
      'uni_modules/z-paging-x',
      'uni_modules/mp-html',
      'uni_modules/unix-crypto',
      'src/pages/ai',
      'src/pages/basic/components',
      'src/pages/function/components',
    ],
  },
  {
    name: 'default-auth-only',
    description: '默认创建：4 核心特性全选，不传分包参数（仅保留 auth 分包）',
    args: ['--features', 'all'],
    expectPresent: [
      'src/sub/auth/login.uvue',
      'src/router/interceptor.uts',
      'src/pages/basic/views/BasicView.uvue',
      'src/pages/function/views/FunctionView.uvue',
      'uni_modules/e-chart',
    ],
    expectAbsent: [
      'src/sub/device',
      'src/sub/lodash',
      'src/sub/crypto',
      'src/sub/zpaging',
      'src/pages/ai',
      'src/pages/basic/components',
      'src/pages/function/components',
      '.claude',
      'docs',
      'Dockerfile',
    ],
  },
  {
    name: 'nested-only',
    description: '只留 nested-scroll：组件保留，基础/功能视图纯净',
    args: ['--features', 'none', '--subs', 'nested-scroll'],
    expectPresent: [
      'src/sub/nested-scroll/nested-scroll.uvue',
      'src/components/NestedScroll',
      'src/pages/function/views/FunctionView.uvue',
    ],
    expectAbsent: [
      'src/sub/zpaging',
      'uni_modules/z-paging-x',
      'src/pages/function/components',
    ],
  },
  {
    name: 'zpaging-only',
    description: '只留 zpaging：依赖保留，基础/功能视图纯净',
    args: ['--features', 'none', '--subs', 'zpaging'],
    expectPresent: [
      'src/sub/zpaging/zpaging.uvue',
      'uni_modules/z-paging-x',
      'src/pages/function/views/FunctionView.uvue',
    ],
    expectAbsent: [
      'src/sub/nested-scroll',
      'src/components/NestedScroll',
      'src/pages/function/components',
    ],
    fileAssertions: [
      {
        file: 'src/pages/function/views/FunctionView.uvue',
        notContains: ['ZPagingDemoCard', 'UtilsNavCard', 'EchartsDemoCard'],
      },
    ],
  },
  {
    name: 'utils-partial',
    description: '只留 device 分包：功能视图纯净无 card 残留',
    args: ['--features', 'none', '--subs', 'device'],
    expectPresent: [
      'src/sub/device/device.uvue',
      'src/pages/function/views/FunctionView.uvue',
    ],
    expectAbsent: [
      'src/sub/lodash',
      'src/sub/crypto',
      'src/sub/time',
      'uni_modules/iRainna-lodash',
      'uni_modules/unix-crypto',
      'uni_modules/lime-dayuts',
      'src/pages/function/components',
    ],
  },
];

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

async function run(args, options = {}) {
  try {
    const { stdout, stderr } = await execFileAsync('node', [CLI, ...args], {
      cwd: options.cwd,
      maxBuffer: 64 * 1024 * 1024,
      stdio: options.stdin ? ['ignore', 'pipe', 'pipe'] : undefined,
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
    '--template', REPO_ROOT,
    '--features', 'none', '--subs', 'none', '--no-install', '--yes',
  ], { cwd: tempRoot });
  record(caseName, bad.code !== 0, '非法项目名被拒绝');

  // 3) 非 TTY 缺参数
  const notty = await run(['create', 'no-flags'], { cwd: tempRoot, stdin: 'ignore' });
  record(caseName, notty.code !== 0, `非 TTY 缺参数时退出码非 0（得到 ${notty.code}）`);

  // 4) --yes 单独使用
  const yesOnly = await run(
    ['create', 'yes-only', '--template', REPO_ROOT, '--no-install', '--yes'],
    { cwd: tempRoot, stdin: 'ignore' },
  );
  record(caseName, yesOnly.code === 0, `--yes 单独使用可成功（退出码 ${yesOnly.code}）`);

  return caseName;
}

async function runCase(testCase, tempRoot) {
  console.log(`\n\x1B[1m▶ ${testCase.name}\x1B[0m — ${testCase.description}`);
  const projectName = `smoke-${testCase.name}`;
  const projectDir = path.join(tempRoot, projectName);

  const create = await run([
    'create',
    projectName,
    '--template',
    REPO_ROOT,
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
  const selected = filter
    ? CASES.filter(c => c.name.includes(filter))
    : CASES;

  if (selected.length === 0) {
    console.error(`没有匹配「${filter}」的用例`);
    process.exit(1);
  }

  if (!fs.existsSync(CLI)) {
    console.error(`找不到 ${CLI}，请先执行 pnpm build`);
    process.exit(1);
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'unibestx-smoke-'));
  console.log(`临时目录: ${tempRoot}`);
  console.log(`模板来源: ${REPO_ROOT}`);

  try {
    for (const testCase of selected) {
      await runCase(testCase, tempRoot);
    }
    if (!filter) {
      await runContractChecks(tempRoot);
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
