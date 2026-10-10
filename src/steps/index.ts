/**
 * 项目创建步骤与核心生命周期操作统一导出模块
 */

// ── 用户交互向导 5 大独立分步 ──
export * from './step1-mode'        // 第一步：单选模板模式（极简模式 vs 复杂模式）
export * from './step2-ui'          // 第二步：单选 UI 组件库（rice-ui / uview-ultra / 无）
export * from './step3-system-base' // 第三步：多选系统底座（i18n 国际化、theme 主题色）
export * from './step4-features'    // 第四步：多选扩展功能（lodash, echarts, z-paging-x 等）
export * from './step5-reserved'    // 第五步：预留位（包管理器选择与扩展支持）

// ── CLI 执行管线生命周期阶段 ──
export * from './prompt'            // 交互向导总协调器（串联 0~5 步与快速模式解析）
export * from './acquire'           // 阶段一：模板拉取（本地克隆 / 本地目录 / 远程 Git 仓库）
export * from './sanitize'          // 阶段二：规范化与隐私脱敏（清理 IDE 缓存与测试 AppID）
export * from './prune'             // 阶段二：按需精准裁剪（删未选文件、修补代码、同步路由与 Demo）
export * from './finalize'          // 阶段二：收尾同步（更新 package.json 元数据与 .env）

