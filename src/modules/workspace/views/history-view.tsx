"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, GitCommit, Code2, TerminalSquare, Search } from "lucide-react";
import { toast } from "sonner";

interface HistoryRow {
  id: string;
  query: string;
  type: "sql" | "python";
  commitMessage?: string | null;
  createdAt: string;
}

const getJson = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error((data as { message?: string })?.message || "Failed");
  return data as T;
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function HistoryView() {
  const params = useParams();
  const projectName = decodeURIComponent((params?.project as string) || "");
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const [filter, setFilter] = useState<"all" | "sql" | "python">("all");
  const [search, setSearch] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveCode, setSaveCode] = useState("");
  const [saveType, setSaveType] = useState<"sql" | "python">("sql");
  const [commitMsg, setCommitMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: projects = [] } = useQuery<Array<{ id: string; name: string; role?: string }>>({
    queryKey: ["projects", userId],
    queryFn: () => getJson(`/api/project/get-all?userId=${encodeURIComponent(userId!)}`),
    enabled: !!userId,
  });

  const project = (projects as Array<{ id: string; name: string; role?: string }>).find((p) => p.name === projectName);
  const projectId = project?.id;
  const isViewer = project?.role === "viewer";

  const { data: historyData, refetch } = useQuery<{ success: boolean; data: HistoryRow[] }>({
    queryKey: ["history", projectId],
    queryFn: () =>
      getJson(`/api/execution/history?projectId=${encodeURIComponent(projectId!)}&limit=100`),
    enabled: !!projectId,
  });

  const rows = historyData?.data ?? [];
  const filtered = rows.filter((r) => {
    if (filter !== "all" && r.type !== filter) return false;
    if (
      search &&
      !r.query.toLowerCase().includes(search.toLowerCase()) &&
      !r.commitMessage?.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const handleSave = async () => {
    if (!projectId || !commitMsg.trim() || !saveCode.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/history/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          query: saveCode,
          type: saveType,
          commitMessage: commitMsg,
        }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { message?: string }).message);
      toast.success("Saved to history");
      setSaveOpen(false);
      setCommitMsg("");
      setSaveCode("");
      refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-xs">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search history..."
            className="pl-7 h-8 text-sm bg-black/40 border-gray-700 text-white"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "sql", "python"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-xs capitalize transition-colors ${
                filter === f
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "text-gray-500 hover:text-white border border-transparent"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {!isViewer && (
          <Button
            size="sm"
            onClick={() => setSaveOpen(true)}
            className="ml-auto h-8 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
          >
            <GitCommit className="h-3.5 w-3.5 mr-1" />
            Save with Commit
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {filtered.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-10">No history yet</p>
        ) : (
          filtered.map((row) => (
            <div
              key={row.id}
              className="bg-[#111] border border-gray-800/60 rounded-lg p-3 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {row.type === "sql" ? (
                    <Code2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  ) : (
                    <TerminalSquare className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                  )}
                  <Badge
                    variant="outline"
                    className={`text-xs border-0 ${
                      row.type === "sql"
                        ? "bg-blue-500/10 text-blue-400"
                        : "bg-purple-500/10 text-purple-400"
                    }`}
                  >
                    {row.type.toUpperCase()}
                  </Badge>
                  {row.commitMessage && (
                    <span className="text-xs text-amber-400 flex items-center gap-1">
                      <GitCommit className="h-3 w-3" />
                      {row.commitMessage}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-600">{timeAgo(row.createdAt)}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(row.query);
                      toast.success("Copied");
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Copy className="h-3.5 w-3.5 text-gray-500 hover:text-white" />
                  </button>
                </div>
              </div>
              <pre className="mt-2 text-xs text-gray-400 font-mono overflow-x-auto line-clamp-3 whitespace-pre-wrap">
                {row.query}
              </pre>
            </div>
          ))
        )}
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="bg-[#111] border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCommit className="h-4 w-4 text-amber-400" />
              Save to History
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="flex gap-2">
              {(["sql", "python"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSaveType(t)}
                  className={`px-3 py-1 rounded text-xs uppercase transition-colors ${
                    saveType === t
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "text-gray-500 border border-gray-800"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <textarea
              value={saveCode}
              onChange={(e) => setSaveCode(e.target.value)}
              placeholder={
                saveType === "sql" ? "SELECT ..." : "import pandas as pd\n..."
              }
              rows={5}
              className="w-full bg-black/40 border border-gray-700 rounded text-xs font-mono text-white p-2 resize-none focus:outline-none focus:border-gray-600"
            />
            <Input
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              placeholder="Commit message (e.g. 'Fixed revenue calc')"
              className="bg-black/40 border-gray-700 text-white"
            />
            <Button
              onClick={handleSave}
              disabled={saving || !commitMsg.trim() || !saveCode.trim()}
              className="w-full bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
