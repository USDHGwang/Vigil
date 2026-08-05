import type { NextConfig } from "next";

/**
 * GitHub Pages 是子路徑託管：repo 叫 Vigil，網址就是
 * https://<user>.github.io/Vigil/ ——**不設 basePath 的話，所有 _next 資源
 * 都會去打根目錄然後 404**，頁面會變成沒有樣式的純文字。
 *
 * 用環境變數帶進來，本機 `pnpm dev` / `pnpm build` 不受影響（空字串），
 * 只有 Pages 的 workflow 會設 `PAGES_BASE_PATH=/Vigil`。
 */
const basePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // 靜態匯出：產出純 HTML/CSS/JS 資料夾，可丟到任何靜態 hosting（GitHub Pages / Vercel / Netlify）
  output: "export",
  images: { unoptimized: true },
  ...(basePath === "" ? {} : { basePath, assetPrefix: basePath }),
  // 子路徑託管時路徑要有結尾斜線，不然 /sign 會被導去別的地方
  trailingSlash: true,
};

export default nextConfig;
