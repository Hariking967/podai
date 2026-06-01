"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Crown, Edit3, Eye, UserPlus, Clock } from "lucide-react";
import { toast } from "sonner";

interface Collaborator {
  projectId: string;
  userId: string;
  role: "owner" | "editor" | "viewer";
  name: string;
  email: string;
}

interface PendingInvite {
  id: string;
  invitedEmail: string;
  role: string;
  createdAt: string;
}

interface ContributorsData {
  collaborators: Collaborator[];
  pendingInvites: PendingInvite[];
}

const postJson = async <T,>(url: string, body: unknown): Promise<T> => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed");
  return data as T;
};

const roleIcon = (role: string) => {
  if (role === "owner") return <Crown className="h-3.5 w-3.5 text-yellow-400" />;
  if (role === "editor") return <Edit3 className="h-3.5 w-3.5 text-blue-400" />;
  return <Eye className="h-3.5 w-3.5 text-gray-400" />;
};

const roleStyle = (role: string) => {
  if (role === "owner") return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
  if (role === "editor") return "text-blue-400 bg-blue-500/10 border-blue-500/20";
  return "text-gray-400 bg-gray-500/10 border-gray-500/20";
};

export default function ContributorsView() {
  const params = useParams();
  const projectName = decodeURIComponent((params?.project as string) || "");
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("viewer");

  const { data: projects = [] } = useQuery<Array<{ id: string; name: string; role?: string }>>({
    queryKey: ["projects", userId],
    queryFn: async () => {
      const res = await fetch(
        `/api/project/get-all?userId=${encodeURIComponent(userId!)}`
      );
      return res.json();
    },
    enabled: !!userId,
  });

  const project = (projects as Array<{ id: string; name: string; role?: string }>).find(
    (p) => p.name === projectName
  );
  const projectId = project?.id;
  const isOwner = project?.role === "owner";

  const { data: contribData } = useQuery<ContributorsData>({
    queryKey: ["contributors", projectId],
    queryFn: async () => {
      const res = await fetch(
        `/api/project/contributors?projectId=${encodeURIComponent(projectId!)}`
      );
      if (!res.ok) throw new Error("Failed to load contributors");
      return res.json();
    },
    enabled: !!projectId,
  });

  const invite = useMutation({
    mutationFn: () =>
      postJson("/api/project/invite", { projectId, email, role: inviteRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contributors", projectId] });
      setEmail("");
      toast.success(`Invitation sent to ${email}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const collaborators = contribData?.collaborators ?? [];
  const pendingInvites = contribData?.pendingInvites ?? [];

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div>
        <h2 className="text-base font-semibold flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-green-400" />
          Team Members
        </h2>
        {collaborators.length === 0 ? (
          <p className="text-sm text-gray-500">No members yet</p>
        ) : (
          <div className="space-y-2">
            {collaborators.map((c) => (
              <div
                key={c.userId}
                className="flex items-center gap-3 bg-[#111] border border-gray-800 rounded-lg p-3"
              >
                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs text-gray-300 shrink-0">
                  {(c.name || c.email)[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{c.name || c.email}</p>
                  <p className="text-xs text-gray-500 truncate">{c.email}</p>
                </div>
                <span
                  className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border capitalize ${roleStyle(c.role)}`}
                >
                  {roleIcon(c.role)}
                  {c.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {isOwner && (
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2 mb-4">
            <UserPlus className="h-4 w-4 text-green-400" />
            Invite Member
          </h2>
          <div className="flex gap-2">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              type="email"
              className="flex-1 bg-black/40 border-gray-700 text-white"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "editor" | "viewer")}
              className="bg-black/40 border border-gray-700 text-white text-sm rounded px-3"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
            <Button
              onClick={() => invite.mutate()}
              disabled={!email.trim() || invite.isPending}
              className="bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 shrink-0"
            >
              {invite.isPending ? "Sending..." : "Invite"}
            </Button>
          </div>
          <div className="mt-3 p-3 rounded-lg bg-[#111] border border-gray-800 space-y-1">
            <p className="text-xs text-gray-400">
              <Eye className="h-3 w-3 inline mr-1" />
              <strong className="text-gray-300">Viewer</strong> — read-only. Cannot run SQL, Python, or modify any data.
            </p>
            <p className="text-xs text-gray-400">
              <Edit3 className="h-3 w-3 inline mr-1" />
              <strong className="text-gray-300">Editor</strong> — full read/write. Can run queries and modify data.
            </p>
          </div>
        </div>
      )}

      {isOwner && pendingInvites.length > 0 && (
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-amber-400" />
            Pending Invitations
          </h2>
          <div className="space-y-2">
            {pendingInvites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-3 bg-[#111] border border-gray-800/60 rounded-lg p-3"
              >
                <div className="flex-1">
                  <p className="text-sm text-gray-300">{inv.invitedEmail}</p>
                  <p className="text-xs text-gray-600">
                    {inv.role} · sent {new Date(inv.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  pending
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
