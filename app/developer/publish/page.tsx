import { PublishingWizard } from "@/components/developer/wizard";
export const metadata = { title: "Prepare your app" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ repository?: string }>;
}) {
  const { repository = "" } = await searchParams;
  return <PublishingWizard initialRepository={repository} />;
}
