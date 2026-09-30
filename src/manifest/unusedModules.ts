/**
 * 零引用 uni_modules 清单
 *
 * 这些模块在全项目中没有任何页面渲染、也没有被任何源码 import，属于纯冗余。
 * 其中 12 个是被 uni-ui-x 的 uni_modules.dependencies 拖进来的传递依赖 ——
 * 项目里从未渲染过 <uni-ui-x>，所以整条依赖链都可以删。
 *
 * 刻意不在列的模块（虽然自身没有直接调用，但保留方依赖它们）：
 * lime-shared / lime-style（lime-icon 依赖）、uni-scss（uni-icons 依赖）。
 * 另：e-chart / z-paging-x / iRainna-lodash / lime-dayuts / mp-html / unix-crypto
 * 由对应的功能或分包开关负责，不在此处重复声明。
 */
export const UNUSED_MODULES: string[] = [
  // --- uni-ui-x 及其 12 个传递依赖 ---
  'uni-ui-x',
  'uni-badge-view',
  'uni-collapse-x',
  'uni-drag-cell',
  'uni-fab-button',
  'uni-index-bar',
  'uni-link-x',
  'uni-nav-bar-x',
  'uni-number-box-x',
  'uni-rate-x',
  'uni-refresh-box',
  'uni-tab-bar',
  'uni-time-format',
  // --- 孤立模块 ---
  /** 完整实现了 beforeEach/afterEach，但项目走的是自研 src/router/interceptor.uts */
  'unix-router-guard',
  /** App.uvue 中已注明「目前本项目没用到」 */
  'ali-iconfont',
  'kux-marked',
  'sp-editor',
  /** 登录是 mock 实现，没有走微信登录 */
  'ul-wechat-login',
  'uni-id-common',
  'uni-config-center',
  'uni-upgrade-center-app',
  /**
   * DCloud 官方 UTS 示例插件。uts-openSchema / uts-progressNotification 各模板分支都有，
   * 其余 6 个只出现在 uniX-uview-ultra 分支 —— 该分支里同样没有任何页面标签、
   * easycom 规则或源码 import 引用到它们，属于 UTS 演示残留。
   */
  'uts-openSchema',
  'uts-progressNotification',
  'uts-button',
  'uts-dialogpage',
  'uts-eventbus',
  'uts-get-native-view',
  'uts-worker',
  'uts-worker-sendable-transfer',
  'lime-qrcode',
  /** 组件仅在孤儿文件 SignatureCard.uvue 里被引用 */
  'lime-signature',
  /** 纯冗余图标与辅助样式组件，业务均不使用 */
  'lime-icon',
  'lime-shared',
  'lime-style',
  'uni-scss',
]

/** 清理冗余模块时需要同步删除的孤儿文件 */
export const ORPHAN_FILES: string[] = [
  /** 无人 import，真身在 src/components/TabbarMaskModal/ */
  'src/pages/basic/components/TabbarMaskModal.uvue',
  /** 无人 import，删掉它 lime-signature 即彻底无引用 */
  'src/pages/function/components/SignatureCard.uvue',
]

/** 清理冗余模块时需要同步移除的 package.json scripts */
export const SCRIPTS_TIED_TO_UNUSED_MODULES: string[] = ['icons', 'icons:check']

/**
 * 清理冗余模块时需要同步移除的开发脚手架
 *
 * router-guard-test 是 unix-router-guard 的纯逻辑回归 harness，
 * 它的 build.mjs 从 uni_modules/unix-router-guard/lib 读源文件 ——
 * 插件删了它还留着，就是个必然报错的死目录。
 */
export const HARNESS_TIED_TO_UNUSED_MODULES: string[] = ['scripts/router-guard-test']
