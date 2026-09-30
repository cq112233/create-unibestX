/**
 * 本文件由 `scripts/gen-uts-dts.mjs` 自动生成，请勿手工编辑。
 *
 * 它声明 `./index.uts` 的导出面，供 TS / IDE 解析类型与补全。
 * tsconfig 的 `allowArbitraryExtensions` 把 `./index.uts` 解析到同目录的
 * `index.d.uts.ts`，因此本文件必须与 `index.uts` **同目录同名**，不能挪走。
 *
 * 修改 `index.uts` 的导出后，重新执行：node scripts/gen-uts-dts.mjs
 * 校验是否已同步：node scripts/gen-uts-dts.mjs --check
 */
/**
 * 纯中文极简模式（未开启多语言）：直接返回文本，零外部插件与配置依赖
 */
export declare function t(key: string, _named: UTSJSONObject | null = null): string;

export declare function $t(key: string, _named: UTSJSONObject | null = null): string;

export declare function getI18nText(key: string): string;

export declare function setTabbarItem(): void;

export declare function setNavigationBarTitle(titleKey: string): void;
