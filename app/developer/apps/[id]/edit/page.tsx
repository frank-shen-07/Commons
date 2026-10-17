import { PublishingWizard } from "@/components/developer/wizard";
export const metadata = { title: "Edit app listing" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ local?: string }>;
}) {
  const id = (await params).id;
  const localOnly = (await searchParams).local === "1";
  return (
    <PublishingWizard
      key={`${id}:${localOnly}`}
      draftId={id}
      localOnly={localOnly}
    />
  );
}
