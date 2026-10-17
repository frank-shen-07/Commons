import { AdminPortal } from "@/components/admin/portal";
export const metadata = { title: "Review submission" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <AdminPortal revisionId={(await params).id} />;
}
