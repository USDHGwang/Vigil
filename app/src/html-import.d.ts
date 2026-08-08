/**
 * HTML 靜態資源的型別宣告：esbuild 的 raw-html plugin（build-worker.ts）
 * 與 vitest 都把 `?raw` import 當成字串。只給 Workers 進入點用。
 */
declare module "*.html?raw" {
  const content: string;
  export default content;
}
