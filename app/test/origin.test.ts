/**
 * HTTP transport 的來源檢查。
 *
 * 原本 `cors({ origin: true })` 反射任意 origin，任何網頁都能驅動本機的
 * MCP server。這一組把「誰進得來、誰進不來」釘住。
 */

import { describe, expect, it } from "vitest";
import { defaultAllowedOrigins, isOriginAllowed, parseAllowedOrigins } from "../src/mcp/origin.js";

const PORT = 8848;
const allowed = defaultAllowedOrigins(PORT);

describe("預設允許清單", () => {
  it("放行 claude.ai 與本機兩種寫法", () => {
    expect(isOriginAllowed("https://claude.ai", allowed)).toBe(true);
    expect(isOriginAllowed(`http://localhost:${PORT}`, allowed)).toBe(true);
    expect(isOriginAllowed(`http://127.0.0.1:${PORT}`, allowed)).toBe(true);
  });

  it("放行 claude.ai 的子網域", () => {
    expect(isOriginAllowed("https://app.claude.ai", allowed)).toBe(true);
  });

  // 沒帶 Origin 的是原生程式（Claude Desktop、curl）。瀏覽器發跨來源請求
  // 一定會帶，所以這條不是瀏覽器攻擊面。
  it("沒有 Origin 的請求放行", () => {
    expect(isOriginAllowed(undefined, allowed)).toBe(true);
  });
});

describe("擋下來的", () => {
  it("任意網站進不來——這是原本 origin:true 的洞", () => {
    expect(isOriginAllowed("https://evil.example", allowed)).toBe(false);
  });

  // 前綴/includes 比對會在這兩條上破功
  it("借用 claude.ai 當前綴或後綴的網域進不來", () => {
    expect(isOriginAllowed("https://claude.ai.evil.com", allowed)).toBe(false);
    expect(isOriginAllowed("https://notclaude.ai", allowed)).toBe(false);
    expect(isOriginAllowed("https://xclaude.ai", allowed)).toBe(false);
  });

  it("claude.ai 走 http 不算", () => {
    expect(isOriginAllowed("http://claude.ai", allowed)).toBe(false);
  });

  it("其他 port 的 localhost 不算", () => {
    expect(isOriginAllowed("http://localhost:3000", allowed)).toBe(false);
  });

  it("解不開的字串不算", () => {
    expect(isOriginAllowed("not a url", allowed)).toBe(false);
    expect(isOriginAllowed("", allowed)).toBe(false);
  });
});

describe("ALLOWED_ORIGINS 覆寫", () => {
  it("沒設就用預設", () => {
    expect(parseAllowedOrigins(undefined, PORT)).toEqual(defaultAllowedOrigins(PORT));
    expect(parseAllowedOrigins("  ", PORT)).toEqual(defaultAllowedOrigins(PORT));
  });

  it("逗號分隔，去掉空白與尾斜線", () => {
    expect(parseAllowedOrigins("https://a.example/, https://b.example", PORT)).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });

  // 明確指定清單的人是要收緊，不該被萬用規則悄悄放寬
  it("明確設了清單就不再套用 claude.ai 的萬用規則", () => {
    const custom = parseAllowedOrigins("https://vigil.example", PORT);
    expect(isOriginAllowed("https://vigil.example", custom)).toBe(true);
    expect(isOriginAllowed("https://app.claude.ai", custom)).toBe(false);
  });
});
