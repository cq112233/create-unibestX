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
      'uni_modules/uts-worker',
      'uni_modules/uts-button',
      'scripts/router-guard-test',
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
      'src/router/interceptor.uts',
      'src/store/vapor/app.ts',
      'uni_modules/z-paging-x',
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
      'uni_modules/z-paging-x',
    ],
    expectAbsent: [
      'src/sub/crypto',
      'src/sub/time',
      'src/sub/zpaging',
      'src/sub/rxjsDemo',
      'uni_modules/mp-html',
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
      'uni_modules/z-paging-x',
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
    description: '只留 nested-scroll：组件保留，基础/功能视图纯净，z-paging-x 插件常驻',
    args: ['--features', 'none', '--subs', 'nested-scroll'],
    expectPresent: [
      'src/sub/auth/login.uvue',
      'uni_modules/z-paging-x',
    ],
    expectAbsent: [
      'src/sub/zpaging',
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
    name: 'utils-partial',
    description: '只留 device 分包：功能视图纯净无 card 残留',
    args: ['--features', 'none', '--subs', 'device'],
    expectPresent: [
      'src/sub/auth/login.uvue',
    ],
    expectAbsent: [
      'src/sub/lodash',
      'src/sub/crypto',
      'src/sub/time',
      'uni_modules/iRainna-lodash',
      'uni_modules/unix-crypto',
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
 *   - example* —— 虽是 httpDemo 的示例接口，但 tests/unit/api/api.test.ts 也 import 它
 * 以及 tests/unit/api/api.test.ts。
 *
 * 曾经 httpDemo 的 extraRemovePaths 写成整目录 'src/api'，于是不勾 httpDemo 时
 * 把 auth/privacy 一起删掉，生成物直接爆一堆悬空 import。这里对**每一个用例**
 * 无条件断言 src/api 完整存在，杜绝同类回归再次静默滑过。
 */
const API_ASSETS_ALWAYS_KEPT = [
  'src/api/auth/auth.uts',
  'src/api/privacy/privacy.uts',
  'src/api/example.uts',
  'src/api/example.d.uts.ts',
  'tests/unit/api/api.test.ts',
];

for (const testCase of CASES) {
  testCase.expectPresent.push(...API_ASSETS_ALWAYS_KEPT);
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

  try {
    for (const testCase of selected) {
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
