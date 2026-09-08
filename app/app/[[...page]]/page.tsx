import { TypeGrid } from "@/components/typegrid";
import { notFound, redirect } from "next/navigation";
export default async function Workspace({
  params,
}: {
  params: Promise<{ page?: string[] }>;
}) {
  const { page } = await params;
  if (!page?.length) redirect("/app/dashboard");
  if (
    page.length !== 1 ||
    ![
      "dashboard",
      "leaderboard",
      "achievements",
      "integrations",
      "settings",
      "connect",
    ].includes(page[0])
  )
    notFound();
  return <TypeGrid page={page[0]} />;
}
