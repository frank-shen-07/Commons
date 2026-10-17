import { notFound } from "next/navigation";
import { PublicGithubAppDetail } from "@/components/github-app-detail";
import { repositoryName } from "@/lib/publishing/validation";

export const metadata = { title: "GitHub repository preview" };

export default async function GithubAppPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  let repository: string;
  try {
    repository = repositoryName(`${owner}/${repo}`);
  } catch {
    notFound();
  }

  return <PublicGithubAppDetail repository={repository} />;
}
