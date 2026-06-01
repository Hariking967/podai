"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Database, LogOut, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { User } from "better-auth";

interface Project {
  id: string;
  name: string;
  neonApiKey?: string | null;
  hostName?: string | null;
  isOwner?: boolean;
  role?: "owner" | "editor" | "viewer";
  createdAt: string;
}

const getJson = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data as T;
};

const postJson = async <T,>(url: string, body: unknown): Promise<T> => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data as T;
};

export default function DashboardView({ user }: { user: User }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", user.id],
    queryFn: () =>
      getJson<Project[]>(`/api/project/get-all?userId=${encodeURIComponent(user.id)}`),
  });

  const createProject = useMutation({
    mutationFn: () => postJson("/api/project/create", { name, neonApiKey: apiKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
      setName("");
      setApiKey("");
      toast.success("Project created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleColor = (role?: string) => {
    if (role === "owner") return "text-green-400";
    if (role === "editor") return "text-blue-400";
    return "text-gray-400";
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-gray-800/60 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-green-400" />
          <span className="font-semibold text-lg">XBase</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{user.email}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
            onClick={() => authClient.signOut().then(() => router.push("/"))}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Your Projects</h1>
            <p className="text-gray-400 text-sm mt-1">
              Select a project to open the workspace
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 hover:border-green-500/50">
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#111] border-gray-800 text-white">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label className="text-gray-300">Project Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="my-database"
                    className="mt-1 bg-black/40 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Neon Connection String</Label>
                  <Textarea
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="postgresql://user:pass@host/db"
                    rows={3}
                    className="mt-1 bg-black/40 border-gray-700 text-white text-xs font-mono"
                  />
                </div>
                <Button
                  onClick={() => createProject.mutate()}
                  disabled={!name.trim() || !apiKey.trim() || createProject.isPending}
                  className="w-full bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30"
                >
                  {createProject.isPending ? "Creating..." : "Create Project"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Database className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No projects yet</p>
            <p className="text-sm mt-1">Create your first project to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => router.push(`/${encodeURIComponent(p.name)}/tables`)}
                className="text-left p-5 rounded-xl bg-[#111] border border-gray-800 hover:border-green-500/40 hover:bg-[#141414] transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <Database className="h-5 w-5 text-green-400 group-hover:text-green-300" />
                  <span className={`text-xs font-medium capitalize ${roleColor(p.role)}`}>
                    {p.role ?? "viewer"}
                  </span>
                </div>
                <p className="font-semibold text-white truncate">{p.name}</p>
                {p.hostName && !p.isOwner && (
                  <p className="text-xs text-gray-500 mt-1">by {p.hostName}</p>
                )}
                <p className="text-xs text-gray-600 mt-2">
                  {new Date(p.createdAt).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
