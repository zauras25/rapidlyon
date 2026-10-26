import { redirect } from "next/navigation";

// Admin authentication and redirects intentionally wait for the request.
export const instant = false;

export default async function AdminPage() {
  redirect("/admin/operations");
}
