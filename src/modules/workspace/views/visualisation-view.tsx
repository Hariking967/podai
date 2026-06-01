"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Download, Loader2, BarChart2 } from "lucide-react";
import { toast } from "sonner";

interface ChartEntry {
  id: string;
  prompt: string;
  imageBase64: string;
}

const getJson = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Failed");
  return data as T;
};

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

export default function VisualisationView() {
  const params = useParams();
  const projectName = decodeURIComponent((params?.project as string) || "");
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [gallery, setGallery] = useState<ChartEntry[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const { data: projects = [] } = useQuery<
    Array<{ id: string; name: string; neonApiKey?: string | null; role?: string }>
  >({
    queryKey: ["projects", userId],
    queryFn: () => getJson(`/api/project/get-all?userId=${encodeURIComponent(userId!)}`),
    enabled: !!userId,
  });

  const project = (
    projects as Array<{ id: string; name: string; neonApiKey?: string | null; role?: string }>
  ).find((p) => p.name === projectName);
  const projectId = project?.id;
  const isViewer = project?.role === "viewer";

  const { data: tableNames = [] } = useQuery<string[]>({
    queryKey: ["neon-tables", projectId],
    queryFn: () =>
      getJson(`/api/neon/list-tables?projectId=${encodeURIComponent(projectId!)}`),
    enabled: !!projectId,
  });

  const generate = async () => {
    if (!projectId || !prompt.trim() || !selectedTable) {
      toast.error("Select a table and describe your chart");
      return;
    }
    if (isViewer) {
      toast.error("Viewers cannot generate charts");
      return;
    }
    setGenerating(true);
    try {
      const aiRes = await postJson<{ code: string }>("/api/visualisation/generate", {
        projectId,
        prompt,
        tableName: selectedTable,
      });

      const execRes = await postJson<{
        prints: string;
        result: Record<string, unknown> | null;
        error: { message: string } | null;
      }>("/api/python/execute", { projectId, code: aiRes.code });

      if (execRes.error) {
        toast.error(execRes.error.message);
        return;
      }

      const imageBase64 = execRes.result?.image_base64 as string | undefined;
      if (!imageBase64) {
        toast.error("No image returned. Make sure the code uses matplotlib and calls fig_to_base64(fig).");
        return;
      }

      setGallery((prev) => [
        { id: crypto.randomUUID(), prompt, imageBase64 },
        ...prev,
      ]);
      setPrompt("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const downloadImage = (entry: ChartEntry) => {
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${entry.imageBase64}`;
    a.download = `chart-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-800/60 p-4 bg-[#0f0f0f] shrink-0">
        <div className="flex gap-2 max-w-3xl">
          <select
            value={selectedTable ?? ""}
            onChange={(e) => setSelectedTable(e.target.value || null)}
            className="bg-black/40 border border-gray-700 text-white text-sm rounded px-3 py-2 w-40 shrink-0"
          >
            <option value="">Table...</option>
            {(tableNames as string[]).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !generating && generate()}
            placeholder="Describe your chart, e.g. 'Bar chart of sales by region'"
            className="flex-1 bg-black/40 border-gray-700 text-white"
            disabled={generating || isViewer}
          />
          <Button
            onClick={generate}
            disabled={generating || !prompt.trim() || !selectedTable || isViewer}
            className="bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 shrink-0"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span className="ml-2">{generating ? "Generating..." : "Generate"}</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {gallery.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <BarChart2 className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-sm">No charts yet. Describe a chart above to generate one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gallery.map((entry) => (
              <div
                key={entry.id}
                className="bg-[#111] border border-gray-800 rounded-xl overflow-hidden"
              >
                <img
                  src={`data:image/png;base64,${entry.imageBase64}`}
                  alt={entry.prompt}
                  className="w-full"
                />
                <div className="p-3 flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-400 flex-1 truncate">{entry.prompt}</p>
                  <button
                    onClick={() => downloadImage(entry)}
                    className="text-gray-500 hover:text-white transition-colors shrink-0"
                    title="Download PNG"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
