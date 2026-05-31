"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  History,
  Copy,
  Terminal,
  Database,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

interface HistoryEntry {
  id: string;
  query: string;
  type: "python" | "sql";
  createdAt: string;
}

interface HistoryPanelProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  onLoadQuery?: (query: string, type: "python" | "sql") => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function HistoryPanel({
  open,
  onOpenChange,
  projectId,
  onLoadQuery,
}: HistoryPanelProps) {
  const [filter, setFilter] = useState<"all" | "python" | "sql">("all");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["history", projectId],
    queryFn: async () => {
      const res = await fetch(
        `/api/execution/history?projectId=${encodeURIComponent(projectId)}&limit=100`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch history");
      return json.data as HistoryEntry[];
    },
    enabled: open && !!projectId,
  });

  const filtered = (data ?? []).filter(
    (e) => filter === "all" || e.type === filter,
  );

  const handleCopy = (query: string) => {
    navigator.clipboard.writeText(query);
    toast.success("Copied to clipboard");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0b0b0b] border-gray-800 text-white sm:max-w-2xl shadow-2xl p-0 overflow-hidden rounded-2xl max-h-[80vh] flex flex-col">
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-50 absolute top-0 left-0" />
        <div className="p-6 flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <History className="h-5 w-5 text-amber-400" />
              Query History
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 mt-4">
            {(["all", "python", "sql"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${
                  filter === t
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                    : "bg-black/20 border-white/10 text-zinc-400 hover:border-white/20"
                }`}
              >
                {t}
              </button>
            ))}
            <button
              onClick={() => refetch()}
              className="ml-auto text-zinc-500 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm">
              No history yet
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-black/20 border border-white/10 rounded-lg p-3 hover:border-white/20 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        variant="outline"
                        className={`text-xs border flex-shrink-0 ${
                          entry.type === "python"
                            ? "border-blue-500/40 text-blue-400"
                            : "border-orange-500/40 text-orange-400"
                        }`}
                      >
                        {entry.type === "python" ? (
                          <Terminal className="h-2.5 w-2.5 mr-1" />
                        ) : (
                          <Database className="h-2.5 w-2.5 mr-1" />
                        )}
                        {entry.type.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-zinc-500 flex-shrink-0">
                        {timeAgo(entry.createdAt)}
                      </span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <Button
                        size="icon"
                        className="h-6 w-6 bg-black/40 border border-gray-700 text-zinc-400 hover:text-white"
                        onClick={() => handleCopy(entry.query)}
                        title="Copy to clipboard"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      {onLoadQuery && (
                        <Button
                          size="sm"
                          className="h-6 text-xs bg-black/40 border border-gray-700 text-zinc-400 hover:text-neon-green hover:border-neon-green/40"
                          onClick={() => {
                            onLoadQuery(entry.query, entry.type);
                            onOpenChange(false);
                          }}
                        >
                          Load
                        </Button>
                      )}
                    </div>
                  </div>
                  <pre className="text-xs text-zinc-300 mt-2 whitespace-pre-wrap line-clamp-3 font-mono leading-relaxed">
                    {entry.query}
                  </pre>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
