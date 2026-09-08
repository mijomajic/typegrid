import { TypeGrid } from "@/components/typegrid";
import { notFound, permanentRedirect } from "next/navigation";
export default async function Page({
  params,
}: {
  params: Promise<{ page: string[] }>;
}) {
  const { page } = await params;
  if (
    page.length === 1 &&
    [
      "dashboard",
      "leaderboard",
      "achievements",
      "integrations",
      "settings",
      "connect",
    ].includes(page[0])
  )
    permanentRedirect("/app/" + page[0]);
  if (page[0] === "privacy" && page.length === 1)
    return <TypeGrid page="privacy" />;
  if (page[0] === "u" && page.length === 2)
    return <TypeGrid page="u" username={page[1]} />;
  notFound();
}
