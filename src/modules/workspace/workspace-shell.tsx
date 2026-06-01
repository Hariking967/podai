"use client";

import { User } from "better-auth";
import { Sidebar } from "./sidebar";
import { WorkspaceHeader } from "./workspace-header";

interface Props {
  projectName: string;
  user: User;
  children: React.ReactNode;
}

export function WorkspaceShell({ projectName, user, children }: Props) {
  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden">
      <Sidebar projectName={projectName} />
      <div className="flex-1 flex flex-col min-w-0">
        <WorkspaceHeader projectName={projectName} user={user} />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
