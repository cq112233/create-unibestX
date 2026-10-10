/**
 * 【阶段二：按需精准裁剪】
 *
 * 核心裁剪引擎，根据用户在向导中勾选的功能特性（Selection），对复杂模板进行精准降维瘦身：
 * 1. 差异比对：找出未勾选的功能特性，提取其关联的待删文件（removePaths）、代码补丁（patches）与替换规则；
 * 2. 智能依赖保护：
 *    - 自动解析被保留插件的依赖闭包（如保留 uview-ultra 时，防止误删其依赖的 lime-dayuts 和 mp-html）；
 *    - 常驻核心插件白名单保护（如 z-paging-x 插件本体不参与裁剪，仅清理演示分包）；
 * 3. 物理文件删除：批量清理无用分包、示例页面与插件；
 * 4. 特性优雅降级：
 *    - i18n 未勾选时，将 TabBar、NavBar 和全局 Store 桥接重写为纯中文直出；
 * 5. 代码补丁与引用修改：应用 applyPatches 与 applyReplacements，剔除 main.uts 等入口文件的挂载代码；
 * 6. 路由表同步：扫描 pages.config.json 和 pages.json，自动剔除已删除页面路由和无效 easycom 组件规则；
 * 7. 演示页面同步：自动清理 BasicView.uvue 和 FunctionView.uvue 中的废弃 Demo 入口按钮；
 * 8. 空目录清理：递归收敛已删空的文件夹，保持项目目录整洁。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  ALWAYS_KEEP_MODULES,
  ALWAYS_PRUNE_FEATURE_ASSETS,
  FEATURES,
} from '../manifest'
import type { PatchRule, Replacement } from '../types'
import { fs, readJson, removeEmptyDirs, removePaths, writeJson } from '../utils/fs'
import { applyPatches, applyReplacements } from '../utils/patch'


export type Selection = {
  /** 已勾选的 feature key */
  features: string[]
  /** 是否清理零引用 uni_modules（兼容选项） */
  cleanUnusedModules?: boolean
}

export type PruneResult = {
  removedPaths: string[]
  appliedRules: number
  skippedRules: string[]
  replacedFiles: string[]
  removedDeps: string[]
  removedScripts: string[]
  routeCleanup: {
    pages: string[]
    subPackages: string[]
    easycom: string[]
  }
}

/**
 * 按勾选结果裁剪项目
 */
export async function prune(
  projectRoot: string,
  projectName: string,
  selection: Selection,
  step: (msg: string) => void,
  warn: (msg: string) => void,
): Promise<PruneResult> {
  const kept = new Set(selection.features)

  const removeList: string[] = []
  const patchRules: PatchRule[] = []
  const replacements: Replacement[] = []
  const removedDeps: string[] = []
  const removedScripts: string[] = []

  // ---------- 1. 通用功能开关（系统底座与扩展功能统一裁剪） ----------
  for (const feature of FEATURES) {
    if (kept.has(feature.key)) {
      continue
    }
    removeList.push(...feature.removePaths ?? [])
    patchRules.push(...feature.patches ?? [])
    replacements.push(...feature.replacements ?? [])
    removedDeps.push(...feature.removeDeps ?? [])
    removedScripts.push(...feature.removeScripts ?? [])
  }

  // 默认全局资产清理（如果配置了）
  removeList.push(...ALWAYS_PRUNE_FEATURE_ASSETS.removePaths)
  replacements.push(...ALWAYS_PRUNE_FEATURE_ASSETS.replacements)
  removedDeps.push(...ALWAYS_PRUNE_FEATURE_ASSETS.removeDeps)
  removedScripts.push(...ALWAYS_PRUNE_FEATURE_ASSETS.removeScripts)

  // ---------- 2. 删文件 ----------
  let uniqueRemovals = [...new Set(removeList)]

  // 自动保护被保留模块依赖的模块（如 uview-ultra → lime-dayuts）
  const protectedDeps = resolveModuleClosure(projectRoot, makeRemovalCheck(uniqueRemovals))
  if (protectedDeps.size > 0) {
    uniqueRemovals = uniqueRemovals.filter(p => !protectedDeps.has(p))
  }

  // 常驻模块（如 z-paging-x）不参与裁剪：演示分包可以走，插件本体必须留下
  const alwaysKeep = new Set(ALWAYS_KEEP_MODULES.map(mod => `uni_modules/${mod}`))
  uniqueRemovals = uniqueRemovals.filter(p => !alwaysKeep.has(p))

  // 保护 uview-ultra 分支下 uviewUltraBasicDemo 所引用的 mp-html
  if (existsSync(path.join(projectRoot, 'src/sub/uviewUltraBasicDemo')) && !uniqueRemovals.includes('src/sub/uviewUltraBasicDemo')) {
    uniqueRemovals = uniqueRemovals.filter(p => p !== 'uni_modules/mp-html')
  }

  step(`删除 ${uniqueRemovals.length} 个路径`)
  const removedPaths = await removePaths(uniqueRemovals.map(rel => path.join(projectRoot, rel)))
  const removedRel = removedPaths.map(abs => path.relative(projectRoot, abs))

  // ---------- 4. 特性降级与解耦适配 (i18n / theme) ----------
  const isGone = makeRemovalCheck(uniqueRemovals)
  const replacedFiles: string[] = []

  // 若未勾选 i18n，优雅降级 tabbar、navbar 和 store 状态桥接为纯中文直出
  if (!kept.has('i18n')) {
    const tabbarI18nBridge = path.join(projectRoot, 'src/tabbar/internal/i18n.uts')
    if (existsSync(tabbarI18nBridge)) {
      const code = `/**
 * TabBar 文本国际化桥接函数（纯中文无 i18n 模式）
 */
export function formatTabbarText(text: string): string {
  if (text == 'tabbar.home') return '首页';
  if (text == 'tabbar.basic') return '基础';
  if (text == 'tabbar.function') return '功能';
  if (text == 'tabbar.me') return '我的';
  if (text == 'tabbar.ai') return 'AI';
  return text;
}

export function setTabbarItem(): void {
  // 纯中文模式，无需动态设置国际化文本
}
`
      await fs.writeFile(tabbarI18nBridge, code, 'utf-8')
      replacedFiles.push('src/tabbar/internal/i18n.uts')
    }

    const navbarI18nBridge = path.join(projectRoot, 'src/layouts/navbar/utils/i18n.uts')
    if (existsSync(navbarI18nBridge)) {
      const code = `/**
 * 将导航栏标题进行国际化多语言转换（纯中文无 i18n 模式）
 */
export function formatNavbarTitle(title: string): string {
  if (title == 'tabbar.home') return '首页';
  if (title == 'tabbar.basic') return '基础';
  if (title == 'tabbar.function') return '功能';
  if (title == 'tabbar.me') return '我的';
  if (title == 'tabbar.ai') return 'AI';
  return title;
}
`
      await fs.writeFile(navbarI18nBridge, code, 'utf-8')
      replacedFiles.push('src/layouts/navbar/utils/i18n.uts')
    }

    // 将项目内原有的 tabbar.* 多语言 key 直接替换为中文直出
    const zhKeyMap: Record<string, string> = {
      'tabbar.home': '首页',
      'tabbar.basic': '基础',
      'tabbar.function': '功能',
      'tabbar.me': '我的',
      'tabbar.ai': 'AI',
    }

    const filesToReplaceI18nKeys = [
      'src/tabbar/config.uts',
      'src/tabbar/components/TabViews.uvue',
      'src/pages/index/index.uvue',
      'src/pages/basic/basic.uvue',
      'src/pages/function/function.uvue',
      'src/pages/me/me.uvue',
      'pages.config.json',
      'pages.json',
    ]

    for (const relFile of filesToReplaceI18nKeys) {
      const fullPath = path.join(projectRoot, relFile)
      if (existsSync(fullPath)) {
        let content = await fs.readFile(fullPath, 'utf-8')
        let changed = false
        for (const [key, zh] of Object.entries(zhKeyMap)) {
          if (content.includes(key)) {
            content = content.replaceAll(key, zh)
            changed = true
          }
        }
        if (changed) {
          await fs.writeFile(fullPath, content, 'utf-8')
          replacedFiles.push(relFile)
        }
      }
    }

    // 彻底物理删除 src/i18n 目录
    const i18nDir = path.join(projectRoot, 'src/i18n')
    if (existsSync(i18nDir)) {
      await fs.rm(i18nDir, { recursive: true, force: true })
    }

    // 优雅重写 App.uvue：移除 useI18nStore 导入与初始化调用
    const appUvuePath = path.join(projectRoot, 'App.uvue')
    if (existsSync(appUvuePath)) {
      let appContent = await fs.readFile(appUvuePath, 'utf-8')
      appContent = appContent
        .replace(/import\s*\{\s*useI18nStore\s*,\s*useThemeStore\s*\}\s*from\s*['"]\.\/src\/store['"];?/, 'import { useThemeStore } from \'./src/store\';')
        .replace(/import\s*\{\s*useThemeStore\s*,\s*useI18nStore\s*\}\s*from\s*['"]\.\/src\/store['"];?/, 'import { useThemeStore } from \'./src/store\';')
        .replace(/import\s*\{\s*useI18nStore\s*\}\s*from\s*['"]\.\/src\/store['"];?\r?\n?/, '')
      appContent = appContent.replace(
        /\s*\/\/[^\n]*i18n Store[^\n]*\r?\n\s*const i18nStore = useI18nStore\(\);?\r?\n\s*i18nStore\.initLocale\(\);?/,
        '',
      )
      appContent = appContent
        .replace(/\s*const i18nStore = useI18nStore\(\);?\r?\n?/, '\n')
        .replace(/\s*i18nStore\.initLocale\(\);?\r?\n?/, '\n')
      await fs.writeFile(appUvuePath, appContent, 'utf-8')
      replacedFiles.push('App.uvue')
    }

    const storeIndex = path.join(projectRoot, 'src/store/index.uts')
    if (existsSync(storeIndex)) {
      let storeContent = await fs.readFile(storeIndex, 'utf-8')
      storeContent = storeContent
        .replace(/export \* from '\.\/vapor\/i18n\.ts';?\r?\n?/, '')
        .replace(/export \* from '\.\/vdom\/i18n\.uts';?\r?\n?/, '')
      if (!storeContent.includes('export function useI18nStore')) {
        storeContent += `
// 无 i18n 模式下的兜底实现，防止任何遗留调用导致运行时抛出 export 缺失错误
export function useI18nStore(): any {
  return {
    state: { locale: 'zh-Hans', isEn: false },
    initLocale: () => {},
    setLocale: () => {},
  };
}
`
      }
      await fs.writeFile(storeIndex, storeContent, 'utf-8')
    }

    const storeDts = path.join(projectRoot, 'src/store/index.d.ts')
    if (existsSync(storeDts)) {
      let storeDtsContent = await fs.readFile(storeDts, 'utf-8')
      storeDtsContent = storeDtsContent.replace(/export \* from '\.\/vapor\/i18n';?\r?\n?/, '')
      if (!storeDtsContent.includes('useI18nStore')) {
        storeDtsContent += `
export declare function useI18nStore(): {
  state: { locale: string; isEn: boolean };
  initLocale: () => void;
  setLocale: (locale: string) => void;
};
`
      }
      await fs.writeFile(storeDts, storeDtsContent, 'utf-8')
    }
  }

  if (!kept.has('theme')) {
    step('降级 theme: 替换 TabBar / NavBar / AppKu 主题适配为静态单色并移除主题配置')

    // 彻底物理删除 src/theme 目录
    const themeDir = path.join(projectRoot, 'src/theme')
    if (existsSync(themeDir)) {
      await fs.rm(themeDir, { recursive: true, force: true })
    }

    // 1. 替换 src/tabbar/internal/theme.uts 为静态固定颜色（消除 theme.uts 与 useThemeStore 依赖）
    const tabbarThemeBridge = path.join(projectRoot, 'src/tabbar/internal/theme.uts')
    if (existsSync(tabbarThemeBridge)) {
      const code = `import { ref } from 'vue';

export type ThemeTokens = {
  bgContent: string;
  navBg: string;
  navText: string;
  tabBg: string;
  tabBorder: string;
  tabColor: string;
  tabSelected: string;
};

/**
 * 当前是否为深色模式（静态默认浅色）
 */
export const isDark = ref<boolean>(false);

/**
 * TabBar 主题样式令牌（静态单色）
 */
export const themeTokens = ref<ThemeTokens>({
  bgContent: '#f5f6fa',
  navBg: '#ffffff',
  navText: '#000000',
  tabBg: '#ffffff',
  tabBorder: '#e2e8f0',
  tabColor: '#94a3b8',
  tabSelected: '#37c2bc',
});

/**
 * TabBar 当前激活的高亮主题色
 */
export const activeThemeColor = ref<string>('#37c2bc');
`
      await fs.writeFile(tabbarThemeBridge, code, 'utf-8')
      replacedFiles.push('src/tabbar/internal/theme.uts')
    }

    // 2. 替换 src/layouts/navbar/utils/theme.uts 为静态默认颜色
    const navbarThemeBridge = path.join(projectRoot, 'src/layouts/navbar/utils/theme.uts')
    if (existsSync(navbarThemeBridge)) {
      const code = `import { ref } from 'vue';

export type ThemeTokens = {
  bgContent: string;
  navBg: string;
  navText: string;
  tabBg: string;
  tabBorder: string;
  tabColor: string;
  tabSelected: string;
};

/**
 * 布局主题设计令牌（静态默认颜色）
 */
export const navbarThemeTokens = ref<ThemeTokens>({
  bgContent: '#f5f6fa',
  navBg: '#ffffff',
  navText: '#000000',
  tabBg: '#ffffff',
  tabBorder: '#e2e8f0',
  tabColor: '#94a3b8',
  tabSelected: '#37c2bc',
});

/**
 * 下拉刷新背景底色
 */
export const refresherBackground = ref<string>('#f5f6fa');
`
      await fs.writeFile(navbarThemeBridge, code, 'utf-8')
      replacedFiles.push('src/layouts/navbar/utils/theme.uts')
    }

    // 3. 重写 App.ku.uvue：彻底移除主题动态 class、style、store 及 watch 监听
    const appKuPath = path.join(projectRoot, 'App.ku.uvue')
    if (existsSync(appKuPath)) {
      let appKuContent = await fs.readFile(appKuPath, 'utf-8')
      appKuContent = appKuContent
        .replace(/\s*:class="\{[^}]*isDark[^}]*\}"/g, '')
        .replace(/\s*:class="themeStore\.state\.isDark \? 'dark' : ''"/g, '')
        .replace(/\s*:style="themeStyle"/g, '')
        .replace(/import\s*\{\s*useThemeStore\s*\}\s*from\s*['"]@\/src\/store['"];?\r?\n?/, '')
        .replace(/import\s*\{\s*applyNavbarTheme\s*,\s*getRootThemeStyle\s*\}\s*from\s*['"]@\/src\/theme\/index\.uts['"];?\r?\n?/, '')
        .replace(/import\s*\{[^}]*\}\s*from\s*['"]@\/src\/theme\/index\.uts['"];?\r?\n?/, '')
      appKuContent = appKuContent.replace(
        /\/\/\s*激活主题状态管理 Store\r?\n\s*const themeStore = useThemeStore\(\);?\r?\n?/,
        '',
      )
      appKuContent = appKuContent.replace(
        /\s*const themeStore = useThemeStore\(\);?\r?\n?/,
        '\n',
      )
      appKuContent = appKuContent.replace(
        /\/\/\s*主题样式变量[^\n]*\r?\n\s*const themeStyle = computed\(\(\): UTSJSONObject => \{\r?\n\s*return getRootThemeStyle\([^)]*\);?\r?\n\}\);?\r?\n?/,
        '',
      )
      appKuContent = appKuContent.replace(
        /\s*const themeStyle = computed\(\(\): UTSJSONObject => \{\r?\n\s*return getRootThemeStyle\([^)]*\);?\r?\n\}\);?\r?\n?/,
        '',
      )
      appKuContent = appKuContent.replace(
        /\s*applyNavbarTheme\([^)]*\);?\r?\n?/,
        '\n',
      )
      appKuContent = appKuContent.replace(
        /\/\/\s*主题模式[^\n]*\r?\n\s*watch\(\(\): boolean => [^,]+isDark, \([^)]*\) => \{\r?\n\s*applyNavbarTheme\([^)]*\);?\r?\n\}\);?\r?\n?/,
        '',
      )
      appKuContent = appKuContent.replace(
        /\s*watch\(\(\): boolean => [^,]+isDark, \([^)]*\) => \{\r?\n\s*applyNavbarTheme\([^)]*\);?\r?\n\}\);?\r?\n?/,
        '',
      )
      await fs.writeFile(appKuPath, appKuContent, 'utf-8')
      replacedFiles.push('App.ku.uvue')
    }

    // 4. 重写 App.uvue：移除主题 Store 实例化与颜色生效调用
    const appUvuePath = path.join(projectRoot, 'App.uvue')
    if (existsSync(appUvuePath)) {
      let appContent = await fs.readFile(appUvuePath, 'utf-8')
      appContent = appContent
        .replace(/import\s*\{\s*useThemeStore\s*,\s*useI18nStore\s*\}\s*from\s*['"]\.\/src\/store['"];?/, 'import { useI18nStore } from \'./src/store\';')
        .replace(/import\s*\{\s*useI18nStore\s*,\s*useThemeStore\s*\}\s*from\s*['"]\.\/src\/store['"];?/, 'import { useI18nStore } from \'./src/store\';')
        .replace(/import\s*\{\s*useThemeStore\s*\}\s*from\s*['"]\.\/src\/store['"];?\r?\n?/, '')
        .replace(/import\s*\{\s*applyThemeColor\s*,\s*themeColor\s*\}\s*from\s*['"]@\/src\/theme\/index\.uts['"];?\r?\n?/, '')
        .replace(/import\s*\{[^}]*\}\s*from\s*['"]@\/src\/theme\/index\.uts['"];?\r?\n?/, '')
      appContent = appContent.replace(
        /\s*\/\/[^\n]*初始化外观模式[^\n]*\r?\n\s*(?:const (?:app|theme)Store = use(?:App|Theme)Store\(\);?\r?\n\s*)?(?:app|theme)Store\.initThemeMode\(\);?\r?\n\s*(?:\/\/[^\n]*\r?\n\s*)?if\s*\((?:app|theme)Store\.state\.theme\.length > 0\)\s*\{\r?\n\s*(?:themeColor\.value = [^;]+;?\r?\n\s*)?(?:applyThemeColor\([^)]*\);?\r?\n\s*)?\}/,
        '',
      )
      appContent = appContent.replace(
        /\s*\/\/[^\n]*Theme Store[^\n]*\r?\n\s*const themeStore = useThemeStore\(\);?\r?\n\s*themeStore\.initThemeMode\(\);?\r?\n\s*\/\/[^\n]*\r?\n\s*if\s*\(themeStore\.state\.theme\.length > 0\)\s*\{\r?\n\s*themeColor\.value = themeStore\.state\.theme;?\r?\n\s*applyThemeColor\(themeStore\.state\.theme\);?\r?\n\s*\}/,
        '',
      )
      appContent = appContent
        .replace(/\s*const themeStore = useThemeStore\(\);?\r?\n?/, '\n')
        .replace(/\s*(?:app|theme)Store\.initThemeMode\(\);?\r?\n?/, '\n')
        .replace(/\s*themeColor\.value = [^;]+;?\r?\n?/, '\n')
        .replace(/\s*applyThemeColor\([^)]*\);?\r?\n?/, '\n')
      await fs.writeFile(appUvuePath, appContent, 'utf-8')
      replacedFiles.push('App.uvue')
    }

    // 5. 适配 src/components/NavBar/NavBar.uvue：剥离对 @/src/theme/index.uts 的依赖
    const navBarPath = path.join(projectRoot, 'src/components/NavBar/NavBar.uvue')
    if (existsSync(navBarPath)) {
      let navBarContent = await fs.readFile(navBarPath, 'utf-8')
      navBarContent = navBarContent
        .replace(/import\s*\{\s*getThemeTokens\s*\}\s*from\s*['"]@\/src\/theme\/index\.uts['"];?\r?\n?/, '')
        .replace(/import\s*type\s*\{\s*ThemeTokens\s*\}\s*from\s*['"]@\/src\/theme\/index\.uts['"];?\r?\n?/, '')
        .replace(/import\s*\{\s*useThemeStore\s*\}\s*from\s*['"]@\/src\/store['"];?\r?\n?/, '')
      navBarContent = navBarContent.replace(
        /\/\/\s*亮 \/ 暗主题 token[^\n]*\r?\n\s*const themeTokens = computed\(\(\): ThemeTokens => \{\r?\n\s*return getThemeTokens\(useThemeStore\(\)\.state\.isDark\);?\r?\n\}\);?/,
        `// 默认导航栏浅色样式
const defaultNavBg = '#ffffff';
const defaultNavText = '#000000';`,
      )
      navBarContent = navBarContent
        .replace(/themeTokens\.value\.navBg/g, 'defaultNavBg')
        .replace(/themeTokens\.value\.navText/g, 'defaultNavText')
        .replace(/useThemeStore\(\)\.state\.isDark \? '#334155' : '#e2e8f0'/g, '\'#e2e8f0\'')
      await fs.writeFile(navBarPath, navBarContent, 'utf-8')
      replacedFiles.push('src/components/NavBar/NavBar.uvue')
    }

    // 6. 适配 src/components/TabbarMaskModal/TabbarMaskModal.uvue
    const tabbarModalPath = path.join(projectRoot, 'src/components/TabbarMaskModal/TabbarMaskModal.uvue')
    if (existsSync(tabbarModalPath)) {
      let content = await fs.readFile(tabbarModalPath, 'utf-8')
      content = content
        .replace(/import\s*\{\s*useThemeStore\s*\}\s*from\s*['"]@\/src\/store['"];?\r?\n?/, '')
        .replace(/const themeStore = useThemeStore\(\);?\r?\n\s*const isDark = computed\(\(\): boolean => themeStore\.state\.isDark\);?/, 'const isDark = computed((): boolean => false);')
      await fs.writeFile(tabbarModalPath, content, 'utf-8')
      replacedFiles.push('src/components/TabbarMaskModal/TabbarMaskModal.uvue')
    }

    // 7. 适配 src/components/NestedScroll/NestedScroll.uvue
    const nestedScrollPath = path.join(projectRoot, 'src/components/NestedScroll/NestedScroll.uvue')
    if (existsSync(nestedScrollPath)) {
      let content = await fs.readFile(nestedScrollPath, 'utf-8')
      content = content
        .replace(/import\s*\{\s*useThemeStore\s*\}\s*from\s*['"]@\/src\/store['"];?\r?\n?/, '')
        .replace(/const themeStore = useThemeStore\(\);?\r?\n\s*const isDark = computed\(\(\): boolean => themeStore\.state\.isDark\);?/, 'const isDark = computed((): boolean => false);')
      await fs.writeFile(nestedScrollPath, content, 'utf-8')
      replacedFiles.push('src/components/NestedScroll/NestedScroll.uvue')
    }

    // 8. 适配 src/store/index.uts：移除 theme store 导出，加入安全兜底 stub
    const storeIndex = path.join(projectRoot, 'src/store/index.uts')
    if (existsSync(storeIndex)) {
      let storeContent = await fs.readFile(storeIndex, 'utf-8')
      storeContent = storeContent
        .replace(/export \* from '\.\/vapor\/theme\.ts';?\r?\n?/, '')
        .replace(/export \* from '\.\/vdom\/theme\.uts';?\r?\n?/, '')
      if (!storeContent.includes('export function useThemeStore')) {
        storeContent += `
// 无 theme 模式下的兜底实现，防止任何遗留调用导致运行时抛出 export 缺失错误
export function useThemeStore(): any {
  return {
    state: { isDark: false, theme: '#37c2bc', themeMode: 'light' },
    initThemeMode: () => {},
    setTheme: (_color: string) => {},
    setThemeMode: (_mode: string) => {},
  };
}
`
      }
      await fs.writeFile(storeIndex, storeContent, 'utf-8')
    }

    // 9. 适配 src/store/index.d.ts
    const storeDts = path.join(projectRoot, 'src/store/index.d.ts')
    if (existsSync(storeDts)) {
      let storeDtsContent = await fs.readFile(storeDts, 'utf-8')
      storeDtsContent = storeDtsContent.replace(/export \* from '\.\/vapor\/theme';?\r?\n?/, '')
      if (!storeDtsContent.includes('useThemeStore')) {
        storeDtsContent += `
export declare function useThemeStore(): {
  state: { isDark: boolean; theme: string; themeMode: string };
  initThemeMode: () => void;
  setTheme: (color: string) => void;
  setThemeMode: (mode: string) => void;
};
`
      }
      await fs.writeFile(storeDts, storeDtsContent, 'utf-8')
    }


    // 11. 替换 pages.config.json 与 pages.json 中的 @theme 变量为静态浅色值
    for (const pagesFile of ['pages.config.json', 'pages.json']) {
      const pPath = path.join(projectRoot, pagesFile)
      if (existsSync(pPath)) {
        let pContent = await fs.readFile(pPath, 'utf-8')
        pContent = pContent
          .replace(/"@navigationBarTextStyle"/g, '"black"')
          .replace(/"@navigationBarBackgroundColor"/g, '"#ffffff"')
          .replace(/"@backgroundColor"/g, '"#f8fafc"')
          .replace(/"@backgroundColorContent"/g, '"#f8fafc"')
          .replace(/"@backgroundColorTop"/g, '"#f8fafc"')
          .replace(/"@backgroundColorBottom"/g, '"#f8fafc"')
          .replace(/"@backgroundTextStyle"/g, '"dark"')
        await fs.writeFile(pPath, pContent, 'utf-8')
        replacedFiles.push(pagesFile)
      }
    }
  }

  // ---------- 7. 改引用 ----------
  step('清理悬空引用')
  const aliveRules = patchRules.filter(rule => !isGone(rule.file) && existsSync(path.join(projectRoot, rule.file)))
  const aliveReplacements = replacements.filter(rule => !isGone(rule.file) && existsSync(path.join(projectRoot, rule.file)))

  const patchOutcomes = await applyPatches(projectRoot, aliveRules, warn)
  const replacementOutcomes = await applyReplacements(projectRoot, aliveReplacements, warn)

  const appliedRules = patchOutcomes.filter(o => !o.skipped).length
    + replacementOutcomes.filter(o => !o.skipped).length
  const skippedRules = [
    ...patchOutcomes.filter(o => o.skipped).map(o => `${o.file} ← ${o.label}`),
    ...replacementOutcomes.filter(o => o.skipped).map(o => `${o.file} ← ${o.label}`),
  ]

  // ---------- 8. 同步路由与 easycom ----------
  step('同步 pages.config.json / pages.json')
  const routeCleanup = await syncRouteConfigs(projectRoot, warn)

  // ---------- 8.5 同步基础页与功能页演示列表 ----------
  step('同步基础页与功能页演示列表')
  await cleanViewDemoLists(projectRoot, warn)

  // ---------- 9. 清理代码生成物的残留 ----------
  step('清理 .d.uts.ts 残留与 gen-uts-dts 源清单')
  await cleanGeneratedArtifacts(projectRoot, warn)

  // ---------- 10. 收拾空壳目录 ----------
  step('清理空目录')
  const emptyDirs = await removeEmptyDirs(
    projectRoot,
    projectRoot,
    ['node_modules', '.git', 'unpackage', 'dist', '.hbuilderx', '.idea'],
  )
  removedRel.push(...emptyDirs)

  return {
    removedPaths: removedRel,
    appliedRules,
    skippedRules,
    replacedFiles,
    removedDeps: [...new Set(removedDeps)],
    removedScripts: [...new Set(removedScripts)],
    routeCleanup,
  }
}

async function cleanGeneratedArtifacts(
  projectRoot: string,
  warn: (msg: string) => void,
): Promise<void> {
  const dtsFiles = await fsWalk(path.join(projectRoot, 'uni_modules'), '.d.uts.ts')
  const srcDts = await fsWalk(path.join(projectRoot, 'src'), '.d.uts.ts')
  const dangling: string[] = []

  for (const dts of [...dtsFiles, ...srcDts]) {
    const source = dts.replace(/\.d\.uts\.ts$/, '.uts')
    if (!existsSync(source)) {
      await fs.rm(dts, { force: true })
      dangling.push(path.relative(projectRoot, dts))
    }
  }
  // 兼容修正历史残留的 src/http/index.d.uts.ts 路径
  const httpDts = path.join(projectRoot, 'src/http/index.d.uts.ts')
  if (existsSync(httpDts)) {
    let httpContent = await fs.readFile(httpDts, 'utf-8')
    if (httpContent.includes('\'./internal/')) {
      httpContent = httpContent.replaceAll('\'./internal/', '\'./request/internal/')
      await fs.writeFile(httpDts, httpContent, 'utf-8')
    }
  }

  const genFile = path.join(projectRoot, 'scripts/gen-uts-dts.mjs')
  if (!existsSync(genFile)) {
    return
  }

  const content = await fs.readFile(genFile, 'utf-8')
  const eol = content.includes('\r\n') ? '\r\n' : '\n'
  const lines = content.split(/\r?\n/)

  const start = lines.findIndex(line => /^const EXTRA_SOURCES = \[/.test(line))
  if (start === -1) {
    warn('scripts/gen-uts-dts.mjs 里找不到 EXTRA_SOURCES，跳过同步')
    return
  }
  let end = -1
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\];/.test(lines[i]!)) {
      end = i
      break
    }
  }
  if (end === -1) {
    warn('scripts/gen-uts-dts.mjs 的 EXTRA_SOURCES 数组没有正常闭合，跳过同步')
    return
  }

  const dropped: string[] = []
  const kept: string[] = []
  for (let i = start + 1; i < end; i++) {
    const line = lines[i]!
    const m = line.match(/path\.join\(ROOT,\s*'([^']+)'\)/)
    if (m && !existsSync(path.join(projectRoot, m[1]!))) {
      dropped.push(m[1]!)
      continue
    }
    kept.push(line)
  }

  if (dropped.length === 0) {
    return
  }

  const next = [...lines.slice(0, start + 1), ...kept, ...lines.slice(end)].join(eol)
  await fs.writeFile(genFile, next, 'utf-8')
}

async function fsWalk(dir: string, suffix: string): Promise<string[]> {
  if (!existsSync(dir)) {
    return []
  }
  const out: string[] = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') {
        continue
      }
      out.push(...await fsWalk(abs, suffix))
    }
    else if (entry.name.endsWith(suffix)) {
      out.push(abs)
    }
  }
  return out
}

function makeRemovalCheck(removed: string[]): (file: string) => boolean {
  const normalized = removed.map(rel => rel.replace(/\\/g, '/').replace(/\/$/, ''))
  return (file: string): boolean => {
    const target = file.replace(/\\/g, '/')
    return normalized.some(rel => target === rel || target.startsWith(`${rel}/`))
  }
}

function subPagePath(root: string, pagePath: string): string {
  return `${root}/${pagePath}`
}

/**
 * 检测保留模块依赖了被删模块的情况，返回需要保护（不删除）的模块路径集合。
 * 例如 uview-ultra 依赖 lime-dayuts，即使 lime-dayuts 被分包逻辑标记删除，
 * 也必须保留以避免编译失败。
 */
function resolveModuleClosure(projectRoot: string, isGone: (p: string) => boolean): Set<string> {
  const modulesDir = path.join(projectRoot, 'uni_modules')
  const protectedPaths = new Set<string>()
  if (!existsSync(modulesDir)) {
    return protectedPaths
  }

  for (const name of readdirSync(modulesDir)) {
    if (name.startsWith('.')) {
      continue
    }
    // 跳过自身已被标记删除的模块
    if (isGone(`uni_modules/${name}`)) {
      continue
    }

    const pkgFile = path.join(modulesDir, name, 'package.json')
    if (!existsSync(pkgFile)) {
      continue
    }

    const raw = readFileSync(pkgFile, 'utf-8')
    const pkg = JSON.parse(raw) as Record<string, any>
    const deps = new Set<string>()

    for (const key of ['dependencies', 'devDependencies']) {
      for (const dep of Object.keys(pkg[key] ?? {})) {
        deps.add(dep)
      }
    }
    const uniDeps = pkg.uni_modules?.dependencies
    if (Array.isArray(uniDeps)) {
      for (const dep of uniDeps) {
        deps.add(String(dep))
      }
    }
    else if (uniDeps && typeof uniDeps === 'object') {
      for (const dep of Object.keys(uniDeps)) {
        deps.add(dep)
      }
    }

    for (const dep of deps) {
      if (dep === 'uni-scss') {
        continue
      }
      if (isGone(`uni_modules/${dep}`)) {
        // 该依赖被标记删除但仍被保留模块引用，自动保护
        protectedPaths.add(`uni_modules/${dep}`)
      }
    }
  }

  return protectedPaths
}

export async function syncRouteConfigs(
  projectRoot: string,
  warn: (msg: string) => void,
): Promise<PruneResult['routeCleanup']> {
  const cleanup: PruneResult['routeCleanup'] = { pages: [], subPackages: [], easycom: [] }

  for (const file of ['pages.config.json', 'pages.json']) {
    const abs = path.join(projectRoot, file)
    if (!existsSync(abs)) {
      continue
    }
    const data = await readJson<Record<string, any>>(abs)
    if (data == null || typeof data !== 'object') {
      continue
    }

    // --- pages ---
    if (Array.isArray(data.pages)) {
      data.pages = data.pages.filter((page: any) => {
        if (typeof page?.path !== 'string') {
          return true
        }
        if (existsSync(path.join(projectRoot, `${page.path}.uvue`))) {
          return true
        }
        cleanup.pages.push(`${file}: ${page.path}`)
        return false
      })
    }

    // --- subPackages ---
    if (Array.isArray(data.subPackages)) {
      const nextSubs: any[] = []
      for (const sub of data.subPackages) {
        if (typeof sub?.root !== 'string') {
          nextSubs.push(sub)
          continue
        }
        if (!existsSync(path.join(projectRoot, sub.root))) {
          cleanup.subPackages.push(`${file}: ${sub.root}（目录已删）`)
          continue
        }
        const pages = Array.isArray(sub.pages)
          ? sub.pages.filter((page: any) => {
              if (typeof page?.path !== 'string') {
                return true
              }
              if (existsSync(path.join(projectRoot, `${subPagePath(sub.root, page.path)}.uvue`))) {
                return true
              }
              cleanup.pages.push(`${file}: ${subPagePath(sub.root, page.path)}`)
              return false
            })
          : []
        if (pages.length === 0) {
          cleanup.subPackages.push(`${file}: ${sub.root}（已无页面）`)
          continue
        }
        nextSubs.push({ ...sub, pages })
      }
      data.subPackages = nextSubs
    }

    // --- easycom.custom ---
    const custom = data?.easycom?.custom
    if (custom && typeof custom === 'object') {
      for (const [tag, target] of Object.entries(custom)) {
        if (typeof target !== 'string') {
          continue
        }
        const rel = target.replace(/^@\//, '')
        if (!existsSync(path.join(projectRoot, rel))) {
          delete custom[tag]
          cleanup.easycom.push(`${file}: ${tag} → ${target}`)
        }
      }
    }

    await writeJson(abs, data, '\t')
  }

  // 保证生成物中始终存在 pages.json，防止 HBuilderX / Vite 首次启动冷读取 easycom 时报 ENOENT
  const pagesConfigPath = path.join(projectRoot, 'pages.config.json')
  const pagesJsonPath = path.join(projectRoot, 'pages.json')
  if (existsSync(pagesConfigPath) && !existsSync(pagesJsonPath)) {
    await fs.copyFile(pagesConfigPath, pagesJsonPath)
  }

  return cleanup
}

async function cleanViewDemoLists(
  projectRoot: string,
  warn: (msg: string) => void,
): Promise<void> {
  const views = [
    'src/pages/basic/views/BasicView.uvue',
    'src/pages/function/views/FunctionView.uvue',
  ]

  for (const relView of views) {
    const absView = path.join(projectRoot, relView)
    if (!existsSync(absView)) {
      continue
    }

    const content = await fs.readFile(absView, 'utf-8')
    let nextContent = content
    let hasChanges = false
    const demoListMatch = content.match(/const demoList:[^=]+=\s*\[([\s\S]*?)\];/)
    if (demoListMatch) {
      const listBlock = demoListMatch[1]
      const itemRegex = /(\s*\{[\s\S]*?path:\s*'([^']+)'[\s\S]*?\},?)/g
      let match: RegExpExecArray | null

      while ((match = itemRegex.exec(listBlock)) !== null) {
        const fullItem = match[1]
        const rawPath = match[2]
        const checkRel = rawPath.replace(/^\//, '')
        const uvueFile = `${checkRel}.uvue`
        const dirPath = path.dirname(checkRel)

        if (!existsSync(path.join(projectRoot, uvueFile)) && !existsSync(path.join(projectRoot, dirPath))) {
          nextContent = nextContent.replace(fullItem, '')
          hasChanges = true
        }
      }
    }

    if (hasChanges) {
      await fs.writeFile(absView, nextContent, 'utf-8')
    }
  }
}
