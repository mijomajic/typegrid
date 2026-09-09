import { redirect } from "next/navigation";
import { getUser } from "@/lib/server";

export default async function MyProfile() {
  const user = await getUser();
  redirect(user ? "/u/" + encodeURIComponent(user.username) : "/app/connect");
}
