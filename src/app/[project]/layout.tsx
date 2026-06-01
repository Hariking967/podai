import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/modules/workspace/workspace-shell";

interface Props {
  children: React.ReactNode;
  params: Promise<{ project: string }>;
}

export default async function WorkspaceLayout({ children, params }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/');

  const { project } = await params;

  return (
    <WorkspaceShell
      projectName={decodeURIComponent(project)}
      user={session.user}
    >
      {children}
    </WorkspaceShell>
  );
}
