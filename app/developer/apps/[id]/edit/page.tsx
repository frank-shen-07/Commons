import { PublishingWizard } from "@/components/developer/wizard";
export const metadata = { title: "Edit app draft" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <PublishingWizard draftId={(await params).id} />; }
