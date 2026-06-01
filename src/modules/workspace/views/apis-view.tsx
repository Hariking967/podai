"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Plus, Trash2, Key } from "lucide-react";

interface ApiKey {
  id: string;
  apiKey: string;
  createdAt: string;
  isActive: boolean;
}

const postJson = async <T,>(url: string, body: unknown): Promise<T> => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed");
  return data as T;
};

export default function ApisView() {
  const params = useParams();
  const projectName = decodeURIComponent((params?.project as string) || "");
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery<
    Array<{ id: string; name: string; role?: string }>
  >({
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

  const { data: keysData } = useQuery<{ success: boolean; data: ApiKey[] }>({
    queryKey: ["api-keys", projectId],
    queryFn: async () => {
      const res = await fetch(
        `/api/project/api-keys?projectId=${encodeURIComponent(projectId!)}`
      );
      return res.json();
    },
    enabled: !!projectId && isOwner,
  });

  const keys = keysData?.data ?? [];

  const createKey = useMutation({
    mutationFn: () => postJson("/api/project/create-api-key", { projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", projectId] });
      toast.success("API key created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeKey = useMutation({
    mutationFn: (keyId: string) =>
      postJson("/api/project/revoke-api-key", { keyId, projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", projectId] });
      toast.success("Key revoked");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isOwner) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500">
          <Key className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Only the project owner can manage API keys</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">API Keys</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Keys for the external /api/external/run endpoint
          </p>
        </div>
        <Button
          onClick={() => createKey.mutate()}
          disabled={createKey.isPending}
          className="bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20"
        >
          <Plus className="h-4 w-4 mr-2" />
          {createKey.isPending ? "Creating..." : "New Key"}
        </Button>
      </div>

      {keys.length === 0 ? (
        <div className="text-center py-10 text-gray-500 border border-dashed border-gray-800 rounded-xl">
          <Key className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No API keys yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <div
              key={k.id}
              className="flex items-center gap-3 bg-[#111] border border-gray-800 rounded-lg p-3"
            >
              <Key className="h-4 w-4 text-gray-500 shrink-0" />
              <code className="flex-1 text-xs font-mono text-gray-300 truncate">
                {k.apiKey.slice(0, 12)}...{k.apiKey.slice(-8)}
              </code>
              <span className="text-xs text-gray-600">
                {new Date(k.createdAt).toLocaleDateString()}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(k.apiKey);
                  toast.success("Copied");
                }}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => revokeKey.mutate(k.id)}
                disabled={revokeKey.isPending}
                className="text-gray-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
