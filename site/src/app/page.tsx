import HomeContent from "@/components/HomeContent";

/**
 * Landing site — server 入口。
 * 實際內容在 HomeContent（client component，因接 i18n hooks）。
 */
export default function Home() {
  return <HomeContent />;
}
