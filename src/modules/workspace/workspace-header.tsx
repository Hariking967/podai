"use client";

import { User } from "better-auth";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { LogOut, Home } from "lucide-react";
import { NotificationCenter } from "@/modules/notifications/notification-center";
import { useQuery } from "@tanstack/react-query";

interface Props {
  projectName: string;
  user: User;
}

interface Project {
  id: string;
  name: string;
  role?: string;
}

export function WorkspaceHeader({ projectName, user }: Props) {
  const router = useRouter();

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects", user.id],
    queryFn: async () => {
      const res = await fetch(`/api/project/get-all?userId=${encodeURIComponent(user.id)}`);
      return res.json();
    },
  });

  const project = (projects as Project[]).find((p) => p.name === projectName);

  return (
    <header className="h-14 border-b border-gray-800/60 flex items-center justify-between px-4 bg-[#0f0f0f] shrink-0">
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-gray-500 hover:text-white transition-colors"
          title="Back to projects"
        >
          <Home className="h-4 w-4" />
        </button>
        <span className="text-gray-600">/</span>
        <span className="text-sm text-gray-300 font-medium">{projectName}</span>
        {project?.role && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 capitalize">
            {project.role}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {project?.id && (
          <NotificationCenter userId={user.id} projectId={project.id} />
        )}
        <span className="text-xs text-gray-500 hidden sm:block">{user.email}</span>
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-500 hover:text-white h-8 w-8 p-0"
          onClick={() => authClient.signOut().then(() => router.push("/"))}
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>
  );
}
