"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Sparkles,
  User,
  Bot,
  Plus,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  Legend,
} from "recharts";

interface ExecutionPayload {
  prints?: string;
  result?: unknown;
  error?: { message: string; traceback?: string } | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  data_location?: {
    fileName?: string;
    bucket?: string;
    path?: string;
    imageFileName?: string;
    imageBucket?: string;
    imagePath?: string;
    output?: unknown;
  };
}

interface ChatInterfaceProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  onDeleteHistory?: () => void;
  onCreateAgent?: (name: string) => void;
  onSelectAgent?: (chatId: string) => void;
  onRenameAgent?: (chatId: string, name: string) => void;
  agents?: Array<{ id: string; name: string }>;
  activeChatId?: string | null;
  agentName?: string;
  isDeleting?: boolean;
  isCreatingAgent?: boolean;
  isPending?: boolean;
}

export function ChatInterface({
  messages = [],
  onSendMessage,
  onDeleteHistory,
  onCreateAgent,
  onSelectAgent,
  onRenameAgent,
  agents = [],
  activeChatId,
  agentName,
  isDeleting,
  isCreatingAgent,
  isPending,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [agentNameInput, setAgentNameInput] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(agentName ?? "");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const emptyStateHints = [
    "Listening for prompts",
    "Neural context warming",
    "Ready for first message",
  ];
  const [supabasePayloads, setSupabasePayloads] = useState<
    Record<string, ExecutionPayload>
  >({});
  const [supabaseErrors, setSupabaseErrors] = useState<Record<string, string>>(
    {},
  );
  const [supabaseImageUrls, setSupabaseImageUrls] = useState<
    Record<string, string>
  >({});
  const [supabaseImageErrors, setSupabaseImageErrors] = useState<
    Record<string, string>
  >({});
  const [downloadBusy, setDownloadBusy] = useState<Record<string, boolean>>({});

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setNameDraft(agentName ?? "");
  }, [agentName]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, isPending]);

  useEffect(() => {
    const controller = new AbortController();
    const isAbortError = (error: unknown) =>
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && /aborted|abort/i.test(error.message || ""));

    const fetchSupabaseJson = async (bucket: string, path: string) => {
      const key = `${bucket}/${path}`;
      if (supabasePayloads[key] || supabaseErrors[key]) return;

      try {
        const url = `/api/supabase/get-download-url?bucket=${encodeURIComponent(
          bucket,
        )}&path=${encodeURIComponent(path)}`;
        const response = await fetch(url, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || "Failed to get download URL");
        }

        const signedUrl = data?.signedUrl as string;
        if (!signedUrl) {
          throw new Error("Missing signedUrl in response");
        }

        const fileResponse = await fetch(signedUrl, {
          signal: controller.signal,
        });
        if (!fileResponse.ok) {
          throw new Error("Failed to fetch results file");
        }

        const json = (await fileResponse.json()) as ExecutionPayload | unknown;
        setSupabasePayloads((prev) => ({
          ...prev,
          [key]: normalizeExecutionPayload(json),
        }));
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Unknown error";
        setSupabaseErrors((prev) => ({ ...prev, [key]: message }));
      }
    };

    const fetchSupabaseImage = async (bucket: string, path: string) => {
      const key = `${bucket}/${path}`;
      if (supabaseImageUrls[key] || supabaseImageErrors[key]) return;

      try {
        const url = `/api/supabase/get-download-url?bucket=${encodeURIComponent(
          bucket,
        )}&path=${encodeURIComponent(path)}`;
        const response = await fetch(url, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || "Failed to get download URL");
        }

        const signedUrl = data?.signedUrl as string;
        if (!signedUrl) {
          throw new Error("Missing signedUrl in response");
        }

        setSupabaseImageUrls((prev) => ({ ...prev, [key]: signedUrl }));
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Unknown error";
        setSupabaseImageErrors((prev) => ({ ...prev, [key]: message }));
      }
    };

    messages.forEach((msg) => {
      if (msg.role !== "assistant") return;
      const bucket = msg.data_location?.bucket;
      const path = msg.data_location?.path;
      if (bucket && path) {
        fetchSupabaseJson(bucket, path);
      }

      const imageBucket = msg.data_location?.imageBucket;
      const imagePath = msg.data_location?.imagePath;
      if (imageBucket && imagePath) {
        fetchSupabaseImage(imageBucket, imagePath);
      }
    });

    return () => controller.abort();
  }, [messages]);

  const normalizeExecutionPayload = (payload: unknown): ExecutionPayload => {
    if (!payload || typeof payload !== "object") {
      return { result: payload };
    }

    if ("result" in payload || "error" in payload || "prints" in payload) {
      return payload as ExecutionPayload;
    }

    return { result: payload };
  };

  const getSupabaseKey = (message: ChatMessage) => {
    const bucket = message.data_location?.bucket;
    const path = message.data_location?.path;
    return bucket && path ? `${bucket}/${path}` : null;
  };

  const getImageKey = (message: ChatMessage) => {
    const bucket = message.data_location?.imageBucket;
    const path = message.data_location?.imagePath;
    return bucket && path ? `${bucket}/${path}` : null;
  };

  const getImageUrl = (message: ChatMessage) => {
    const key = getImageKey(message);
    return key ? (supabaseImageUrls[key] ?? null) : null;
  };

  const getExecutionPayload = (
    message: ChatMessage,
  ): ExecutionPayload | null => {
    const key = getSupabaseKey(message);
    if (key) {
      if (supabasePayloads[key]) {
        return supabasePayloads[key] ?? null;
      }
      if (supabaseErrors[key] && message.data_location?.output) {
        return normalizeExecutionPayload(message.data_location.output);
      }
      if (message.data_location?.output) {
        return normalizeExecutionPayload(message.data_location.output);
      }
      return null;
    }

    if (message.data_location?.output) {
      return normalizeExecutionPayload(message.data_location.output);
    }

    return null;
  };

  const getPlotSpecs = (result: unknown) => {
    if (!result || typeof result !== "object") return [];
    const resultObj = result as Record<string, unknown>;
    const plot = resultObj.plot;
    const plots = resultObj.plots;

    if (Array.isArray(plots)) {
      return plots as Record<string, unknown>[];
    }

    if (plot && typeof plot === "object") {
      return [plot as Record<string, unknown>];
    }

    return [];
  };

  const renderTable = (
    rows: Record<string, unknown>[],
    fields?: string[],
  ): JSX.Element | null => {
    if (!rows.length) return null;
    const headers = fields?.length ? fields : Object.keys(rows[0] ?? {});
    const displayRows = rows.slice(0, 50);

    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10">
              {headers.map((header) => (
                <TableHead key={header} className="text-zinc-300">
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map((row, rowIndex) => (
              <TableRow key={rowIndex} className="border-white/5">
                {headers.map((header) => (
                  <TableCell key={header} className="text-zinc-200">
                    {row[header] === null || row[header] === undefined
                      ? "-"
                      : String(row[header])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const renderCorrelationMatrix = (
    labels: string[],
    matrix: number[][],
  ): JSX.Element => {
    const maxAbs = Math.max(
      1,
      ...matrix.flatMap((row) => row.map((value) => Math.abs(value))),
    );

    const getCellColor = (value: number) => {
      const strength = Math.min(1, Math.abs(value) / maxAbs);
      const hue = value >= 0 ? 145 : 320;
      return `hsla(${hue}, 90%, 55%, ${0.15 + 0.6 * strength})`;
    };

    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-3 overflow-auto">
        <div className="min-w-[420px]">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${labels.length + 1}, minmax(90px, 1fr))`,
            }}
          >
            <div className="text-xs text-zinc-400"></div>
            {labels.map((label) => (
              <div
                key={label}
                className="text-xs text-zinc-300 text-center pb-2"
              >
                {label}
              </div>
            ))}
            {matrix.map((row, rowIndex) => (
              <div key={labels[rowIndex]} className="contents">
                <div className="text-xs text-zinc-300 pr-2 pb-2">
                  {labels[rowIndex]}
                </div>
                {row.map((value, colIndex) => (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className="text-xs text-zinc-100 text-center rounded-lg mx-1 mb-2 py-2"
                    style={{ backgroundColor: getCellColor(value) }}
                  >
                    {value.toFixed(2)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderPlot = (
    plot: Record<string, unknown>,
    index: number,
  ): JSX.Element | null => {
    const type = plot.type as string | undefined;
    const data = Array.isArray(plot.data)
      ? (plot.data as Record<string, unknown>[])
      : [];
    const xKey = plot.xKey as string | undefined;
    const yKey = plot.yKey as string | undefined;
    const valueKey = (plot.valueKey as string | undefined) ?? yKey;
    const nameKey = (plot.nameKey as string | undefined) ?? xKey;

    const palette = [
      "#4ade80",
      "#22d3ee",
      "#f472b6",
      "#fbbf24",
      "#a78bfa",
      "#38bdf8",
    ];

    if (type === "pie" && data.length && nameKey && valueKey) {
      return (
        <div
          key={`pie-${index}`}
          className="h-72 w-full rounded-2xl bg-black/40 border border-white/10 p-3"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey={valueKey}
                nameKey={nameKey}
                outerRadius={90}
              >
                {data.map((_, sliceIndex) => (
                  <Cell
                    key={sliceIndex}
                    fill={palette[sliceIndex % palette.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#0b0d10",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (type === "scatter" && data.length && xKey && yKey) {
      return (
        <div
          key={`scatter-${index}`}
          className="h-72 w-full rounded-2xl bg-black/40 border border-white/10 p-3"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <CartesianGrid
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="3 3"
              />
              <XAxis dataKey={xKey} stroke="#9ca3af" fontSize={11} />
              <YAxis dataKey={yKey} stroke="#9ca3af" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "#0b0d10",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              />
              <Scatter data={data} fill="#22d3ee" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (type === "bar" && data.length && xKey && yKey) {
      return (
        <div
          key={`bar-${index}`}
          className="h-64 w-full rounded-2xl bg-black/40 border border-white/10 p-3"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="3 3"
              />
              <XAxis dataKey={xKey} stroke="#9ca3af" fontSize={11} />
              <YAxis stroke="#9ca3af" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "#0b0d10",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              />
              <Bar dataKey={yKey} fill="#4ade80" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (type === "line" && data.length && xKey && yKey) {
      return (
        <div
          key={`line-${index}`}
          className="h-64 w-full rounded-2xl bg-black/40 border border-white/10 p-3"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="3 3"
              />
              <XAxis dataKey={xKey} stroke="#9ca3af" fontSize={11} />
              <YAxis stroke="#9ca3af" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: "#0b0d10",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              />
              <Line
                type="monotone"
                dataKey={yKey}
                stroke="#4ade80"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (type === "correlation") {
      const labels = Array.isArray(plot.labels)
        ? (plot.labels as string[])
        : [];
      const matrix = Array.isArray(plot.matrix)
        ? (plot.matrix as number[][])
        : [];
      if (labels.length && matrix.length) {
        return (
          <div key={`corr-${index}`} className="w-full">
            {renderCorrelationMatrix(labels, matrix)}
          </div>
        );
      }
    }

    return null;
  };

  const handleDownload = async (message: ChatMessage) => {
    const bucket = message.data_location?.bucket;
    const path = message.data_location?.path;
    if (!bucket || !path) {
      if (message.data_location?.output) {
        const blob = new Blob(
          [JSON.stringify(message.data_location.output, null, 2)],
          { type: "application/json" },
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = message.data_location?.fileName || "results.json";
        link.rel = "noreferrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      return;
    }

    const key = `${bucket}/${path}`;
    setDownloadBusy((prev) => ({ ...prev, [key]: true }));

    try {
      const url = `/api/supabase/get-download-url?bucket=${encodeURIComponent(
        bucket,
      )}&path=${encodeURIComponent(path)}`;
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Failed to get download URL");
      }

      const signedUrl = data?.signedUrl as string;
      if (!signedUrl) {
        throw new Error("Missing signedUrl in response");
      }

      const link = document.createElement("a");
      link.href = signedUrl;
      link.download = message.data_location?.fileName || "results.json";
      link.rel = "noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : "Download failed";
      console.error(messageText);

      if (message.data_location?.output) {
        const blob = new Blob(
          [JSON.stringify(message.data_location.output, null, 2)],
          { type: "application/json" },
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = message.data_location?.fileName || "results.json";
        link.rel = "noreferrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } finally {
      setDownloadBusy((prev) => ({ ...prev, [key]: false }));
    }
  };

  const renderVisuals = (message: ChatMessage): JSX.Element | null => {
    const payload = getExecutionPayload(message);
    if (!payload) return null;

    if (payload.error) {
      return (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {payload.error.message}
        </div>
      );
    }

    const result = payload.result ?? null;
    if (!result) return null;

    const imageKey = getImageKey(message);
    const imageUrl = getImageUrl(message);
    const imageError = imageKey ? supabaseImageErrors[imageKey] : null;
    const isImageLoading = imageKey && !imageUrl && !imageError;

    const resultObj = result as Record<string, unknown>;
    const inlineImageBase64 =
      (resultObj.image_base64 as string | undefined) ??
      (resultObj.imageBase64 as string | undefined) ??
      (typeof resultObj.image === "string"
        ? (resultObj.image as string)
        : resultObj.image &&
            typeof resultObj.image === "object" &&
            "base64" in resultObj.image
          ? (resultObj.image as { base64?: string }).base64
          : undefined);
    const inlineImageMime =
      (resultObj.image_mime as string | undefined) ??
      (resultObj.imageMime as string | undefined) ??
      (resultObj.image &&
      typeof resultObj.image === "object" &&
      "mime" in resultObj.image
        ? (resultObj.image as { mime?: string }).mime
        : "image/png");
    const inlineImageUrl = inlineImageBase64
      ? `data:${inlineImageMime || "image/png"};base64,${inlineImageBase64}`
      : null;
    const sqlRows = Array.isArray(resultObj.rows)
      ? (resultObj.rows as Record<string, unknown>[])
      : null;
    const sqlFields = Array.isArray(resultObj.fields)
      ? (resultObj.fields as string[])
      : undefined;

    const plotSpecs = getPlotSpecs(result);
    const metrics =
      resultObj.metrics && typeof resultObj.metrics === "object"
        ? (resultObj.metrics as Record<string, number | string>)
        : null;

    const correlationLabels = Array.isArray(resultObj.correlationLabels)
      ? (resultObj.correlationLabels as string[])
      : null;
    const correlationMatrix = Array.isArray(resultObj.correlationMatrix)
      ? (resultObj.correlationMatrix as number[][])
      : null;

    const arrayTable = Array.isArray(result)
      ? (result as Record<string, unknown>[])
      : null;

    const fallbackTable = !arrayTable
      ? Object.values(resultObj).find(
          (value) =>
            Array.isArray(value) &&
            value.length &&
            typeof value[0] === "object",
        )
      : null;

    const summaryEntries =
      !sqlRows && !arrayTable && !fallbackTable
        ? Object.entries(resultObj)
        : [];

    return (
      <div className="mt-4 flex flex-col gap-3">
        {imageUrl && (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
            <img
              src={imageUrl}
              alt="Generated chart"
              className="w-full rounded-xl"
            />
          </div>
        )}

        {!imageUrl && inlineImageUrl && (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
            <img
              src={inlineImageUrl}
              alt="Generated chart"
              className="w-full rounded-xl"
            />
          </div>
        )}

        {isImageLoading && (
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-zinc-400">
            Loading chart image...
          </div>
        )}

        {imageError && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            Failed to load chart image.
          </div>
        )}

        {metrics && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {Object.entries(metrics).map(([key, value]) => (
              <div
                key={key}
                className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              >
                <div className="text-xs text-zinc-400 uppercase tracking-wide">
                  {key}
                </div>
                <div className="text-lg text-neon-green font-semibold">
                  {String(value)}
                </div>
              </div>
            ))}
          </div>
        )}

        {!imageUrl && plotSpecs.map((plot, index) => renderPlot(plot, index))}

        {!imageUrl &&
          correlationLabels &&
          correlationMatrix &&
          renderCorrelationMatrix(correlationLabels, correlationMatrix)}

        {sqlRows && renderTable(sqlRows, sqlFields)}

        {!sqlRows && arrayTable && renderTable(arrayTable)}

        {!sqlRows &&
          !arrayTable &&
          fallbackTable &&
          renderTable(fallbackTable as Record<string, unknown>[])}

        {!sqlRows &&
          !arrayTable &&
          !fallbackTable &&
          summaryEntries.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
              <div className="grid gap-2 md:grid-cols-2">
                {summaryEntries.map(([key, value]) => (
                  <div key={key} className="text-sm text-zinc-200">
                    <span className="text-zinc-400 mr-2">{key}:</span>
                    <span>
                      {typeof value === "string" || typeof value === "number"
                        ? value
                        : JSON.stringify(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input);
    setInput("");
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!input.trim() || isPending) return;
      onSendMessage(input);
      setInput("");
    }
  };

  const handleCreateAgent = () => {
    if (!onCreateAgent || !agentNameInput.trim()) return;
    onCreateAgent(agentNameInput.trim());
    setAgentNameInput("");
    setAgentDialogOpen(false);
  };

  const handleRenameCommit = () => {
    if (!onRenameAgent || !activeChatId) {
      setIsEditingName(false);
      return;
    }
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === (agentName ?? "")) {
      setIsEditingName(false);
      setNameDraft(agentName ?? "");
      return;
    }
    onRenameAgent(activeChatId, trimmed);
    setIsEditingName(false);
  };

  return (
    <div className="flex h-full flex-col glass-panel relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-1 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <div className="pointer-events-none absolute -top-32 right-10 h-64 w-64 rounded-full bg-neon-green/10 blur-[90px]" />
      <div className="pointer-events-none absolute -bottom-32 left-10 h-64 w-64 rounded-full bg-emerald-300/5 blur-[90px]" />

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-zinc-950/35 backdrop-blur-xl relative z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-neon-green/10 border border-neon-green/20 flex items-center justify-center shadow-[0_0_15px_rgba(74,222,128,0.15)] animate-float-slow">
            <Sparkles className="h-5 w-5 text-neon-green" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="h-7 w-7 rounded-full border border-white/10 bg-black/40 text-zinc-300 hover:text-white hover:border-neon-green/40"
                    aria-label="Switch agent"
                  >
                    <ChevronDown className="h-4 w-4 mx-auto" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="bg-[#0b0b0b] border-gray-800 text-white"
                >
                  {agents.length === 0 && (
                    <DropdownMenuItem disabled>No agents yet</DropdownMenuItem>
                  )}
                  {agents.map((agent) => (
                    <DropdownMenuItem
                      key={agent.id}
                      onClick={() => onSelectAgent?.(agent.id)}
                      className="cursor-pointer"
                    >
                      <span className="mr-2">
                        {agent.id === activeChatId ? "•" : ""}
                      </span>
                      {agent.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {isEditingName ? (
                <Input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={handleRenameCommit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleRenameCommit();
                    }
                    if (e.key === "Escape") {
                      setIsEditingName(false);
                      setNameDraft(agentName ?? "");
                    }
                  }}
                  className="h-8 w-44 bg-[#111111] border-gray-800 text-zinc-100"
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  onDoubleClick={() => setIsEditingName(true)}
                  className="font-bold text-zinc-100 tracking-tight"
                  title="Double click to rename"
                >
                  {agentName ?? "AI Assistant"}
                </button>
              )}
            </div>
            <p className="text-xs text-neon-green/70 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse shadow-[0_0_5px_rgba(74,222,128,1)]"></span>
              Active Session
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {agentName && (
            <span className="text-[11px] text-zinc-400 border border-white/10 rounded-full px-3 py-1">
              {agentName}
            </span>
          )}
          <button
            type="button"
            onClick={() => setAgentDialogOpen(true)}
            className="h-9 w-9 rounded-full border border-neon-green/40 bg-black/40 text-neon-green hover:bg-neon-green/10 hover:shadow-[0_0_12px_rgba(74,222,128,0.35)] transition"
            aria-label="Create new agent"
          >
            <Plus className="h-4 w-4 mx-auto" />
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="h-9 w-9 rounded-full border border-red-400/40 bg-black/40 text-red-300 hover:bg-red-500/10 hover:shadow-[0_0_12px_rgba(248,113,113,0.35)] transition"
                aria-label="Delete chat history"
              >
                <Trash2 className="h-4 w-4 mx-auto" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-[#0b0b0b] border-gray-800 text-white">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete chat history?</AlertDialogTitle>
                <AlertDialogDescription className="text-zinc-400">
                  This will remove all messages and results for this chat. You
                  cannot undo this action.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-transparent border border-white/10 text-zinc-300 hover:bg-white/5">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDeleteHistory?.()}
                  className="bg-red-500/90 text-white hover:bg-red-500"
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 p-3 relative z-10 bg-gradient-to-b from-transparent via-zinc-500/[0.04] to-zinc-500/[0.08] overflow-y-auto neon-scrollbar"
      >
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center h-full text-neutral-500 mt-10 relative"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-neon-green/10 blur-[100px] rounded-full pointer-events-none animate-soft-pulse" />

            <motion.div
              animate={{ y: [0, -8, 0], rotate: [0, 2, 0, -2, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="p-8 rounded-[2rem] glass-panel-soft mb-8 relative group shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            >
              <div className="absolute inset-0 bg-neon-green/10 blur-2xl rounded-[2rem] opacity-40" />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                className="absolute inset-2 rounded-[1.6rem] border border-neon-green/30 border-dashed"
              />
              <Sparkles className="h-12 w-12 text-neon-green drop-shadow-[0_0_15px_rgba(57,255,20,0.4)] relative z-10" />
            </motion.div>
            <p className="text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-b from-zinc-100 to-neon-green/55 tracking-wide text-center max-w-sm">
              Console waiting for your first prompt
            </p>
            <p className="mt-2 text-sm text-zinc-400 text-center max-w-sm">
              Start the chat and the assistant will switch from ambient mode to
              live responses.
            </p>

            <div className="mt-8 flex gap-2">
              {[0, 1, 2, 3].map((bar) => (
                <motion.span
                  key={bar}
                  animate={{
                    scaleY: [0.45, 1, 0.45],
                    opacity: [0.45, 1, 0.45],
                  }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: bar * 0.12,
                    ease: "easeInOut",
                  }}
                  className="h-8 w-1.5 rounded-full origin-bottom bg-gradient-to-t from-neon-green/30 to-neon-green shadow-[0_0_12px_rgba(74,222,128,0.55)]"
                />
              ))}
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-2 max-w-lg">
              {emptyStateHints.map((hint, idx) => (
                <motion.span
                  key={hint}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
                  transition={{
                    duration: 2.6,
                    repeat: Infinity,
                    delay: idx * 0.35,
                    ease: "easeInOut",
                  }}
                  className="glass-panel-soft rounded-full px-4 py-1.5 text-xs text-zinc-300"
                >
                  {hint}
                </motion.span>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="space-y-8 flex flex-col pb-4">
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.4, type: "spring", bounce: 0.4 }}
                  className={`flex gap-4 w-full ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 shrink-0 rounded-full bg-black/50 border border-white/10 flex items-center justify-center mt-1 shadow-lg">
                      <Bot className="h-4 w-4 text-neon-green" />
                    </div>
                  )}

                  <div
                    className={`max-w-[75%] rounded-3xl px-6 py-4 text-[15px] leading-relaxed shadow-xl backdrop-blur-md relative group ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-neon-green/14 to-zinc-700/10 text-zinc-100 border border-neon-green/35 shadow-[0_4px_30px_rgba(74,222,128,0.15)] rounded-tr-sm"
                        : "bg-zinc-700/15 text-zinc-200 border border-white/8 shadow-[0_4px_30px_rgba(0,0,0,0.5)] rounded-tl-sm"
                    }`}
                  >
                    {/* Subtle glow effect for user messages */}
                    {msg.role === "user" && (
                      <div className="absolute inset-0 bg-neon-green/5 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
                    )}
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    {msg.role === "assistant" && msg.data_location && (
                      <div className="mt-4 flex flex-col gap-3">
                        {(() => {
                          const key = getSupabaseKey(msg);
                          const hasSupabase = !!key;
                          const isLoading =
                            key &&
                            !supabasePayloads[key] &&
                            !supabaseErrors[key];
                          const hasError = key && supabaseErrors[key];
                          const errorText =
                            key && supabaseErrors[key]
                              ? supabaseErrors[key]
                              : null;
                          return (
                            <>
                              {hasSupabase && (
                                <div className="flex flex-wrap items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => handleDownload(msg)}
                                    disabled={key ? downloadBusy[key] : false}
                                    className="text-xs font-semibold uppercase tracking-wide text-neon-green border border-neon-green/40 rounded-full px-4 py-1.5 hover:bg-neon-green/10 transition disabled:opacity-50"
                                  >
                                    {key && downloadBusy[key]
                                      ? "Preparing..."
                                      : "Download Results"}
                                  </button>
                                  {isLoading && (
                                    <span className="text-xs text-zinc-400">
                                      Loading Supabase results...
                                    </span>
                                  )}
                                  {hasError && (
                                    <span className="text-xs text-red-300">
                                      Failed to load Supabase file.
                                      {errorText ? ` ${errorText}` : ""}
                                    </span>
                                  )}
                                </div>
                              )}
                              {renderVisuals(msg)}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {msg.role === "user" && (
                    <div className="w-8 h-8 shrink-0 rounded-full bg-neon-green/20 border border-neon-green/30 flex items-center justify-center mt-1 shadow-[0_0_10px_rgba(74,222,128,0.1)]">
                      <User className="h-4 w-4 text-neon-green" />
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Typing Indicator */}
              {isPending && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{
                    opacity: 0,
                    scale: 0.9,
                    transition: { duration: 0.2 },
                  }}
                  className="flex gap-4 w-full justify-start"
                >
                  <div className="w-8 h-8 shrink-0 rounded-full bg-black/50 border border-white/10 flex items-center justify-center mt-1 shadow-lg">
                    <Bot className="h-4 w-4 text-neon-green" />
                  </div>
                  <div className="bg-white/[0.04] border border-white/5 rounded-3xl rounded-tl-sm px-6 py-5 shadow-xl backdrop-blur-md flex items-center gap-2 h-[52px]">
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                      className="w-2 h-2 bg-neon-green rounded-full shadow-[0_0_5px_rgba(74,222,128,0.8)]"
                    />
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{
                        duration: 0.6,
                        repeat: Infinity,
                        delay: 0.2,
                      }}
                      className="w-2 h-2 bg-neon-green rounded-full shadow-[0_0_5px_rgba(74,222,128,0.8)] opacity-70"
                    />
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{
                        duration: 0.6,
                        repeat: Infinity,
                        delay: 0.4,
                      }}
                      className="w-2 h-2 bg-neon-green rounded-full shadow-[0_0_5px_rgba(74,222,128,0.8)] opacity-40"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Input Area (Floating Pill) */}
      <div className="p-2 relative z-20 bg-transparent">
        <form
          onSubmit={handleSubmit}
          className="relative max-w-4xl mx-auto group"
        >
          <div className="relative rounded-3xl glass-panel-soft transition-all duration-300 focus-within:border-neon-green/50 focus-within:ring-1 focus-within:ring-neon-green/35 focus-within:shadow-[0_0_28px_rgba(74,222,128,0.16)] overflow-hidden">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Send a message to xBase..."
              disabled={isPending}
              rows={1}
              className="w-full pl-6 pr-16 py-3 min-h-[56px] max-h-[120px] leading-6 bg-transparent border-none focus-visible:ring-0 text-zinc-100 placeholder:text-zinc-500 text-base shadow-none rounded-3xl resize-none overflow-y-auto neon-scrollbar"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isPending || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-12 w-12 neon-btn hover:scale-110 hover:-rotate-6 active:scale-95 transition-all duration-300 disabled:opacity-30 disabled:hover:scale-100 disabled:hover:rotate-0 rounded-2xl disabled:shadow-none"
            >
              <Send className="h-5 w-5 ml-1" />
            </Button>
          </div>
        </form>
      </div>

      <Dialog open={agentDialogOpen} onOpenChange={setAgentDialogOpen}>
        <DialogContent className="bg-[#0b0b0b] border-gray-800 text-white sm:max-w-md shadow-2xl p-0 overflow-hidden rounded-2xl">
          <div className="h-1 w-full bg-gradient-to-r from-transparent via-neon-green to-transparent opacity-50 absolute top-0 left-0" />
          <div className="p-6">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-neon-green" />
                New Agent
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              <div className="relative group">
                <Input
                  id="agent-name"
                  value={agentNameInput}
                  onChange={(e) => setAgentNameInput(e.target.value)}
                  placeholder="Agent name"
                  className="bg-[#111111] border-gray-800 focus:border-neon-green focus:ring-1 focus:ring-neon-green/50 text-white h-12 px-4 transition-all rounded-xl"
                />
              </div>
            </div>
          </div>

          <div className="p-6 pt-0 mt-2">
            <Button
              onClick={handleCreateAgent}
              disabled={isCreatingAgent || !agentNameInput.trim()}
              className="w-full h-12 neon-btn hover:bg-neon-green/95 font-bold text-base rounded-xl transition-all disabled:opacity-50 disabled:hover:shadow-none relative overflow-hidden group"
            >
              {isCreatingAgent ? "Creating..." : "Create Agent"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
