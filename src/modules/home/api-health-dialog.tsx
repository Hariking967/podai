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
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface EndpointStatus {
  name: string;
  url: string;
  method: "GET" | "POST";
  body?: string;
  status: "idle" | "checking" | "ok" | "error";
  latencyMs?: number;
  httpStatus?: number;
  message?: string;
}

interface ApiHealthDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  apiKeyCount: number;
}

export function ApiHealthDialog({
  open,
  onOpenChange,
  projectId,
  apiKeyCount,
}: ApiHealthDialogProps) {
  const backendUrl =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_BACKEND_URL ?? "")
      : "";

  const [endpoints, setEndpoints] = useState<EndpointStatus[]>([
    {
      name: "XBase API — Hello",
      url: "/api/hello",
      method: "GET",
      status: "idle",
    },
    {
      name: "XBase API — List Tables",
      url: `/api/neon/list-tables?projectId=${encodeURIComponent(projectId)}`,
      method: "GET",
      status: "idle",
    },
    {
      name: "XBase API — Execution History",
      url: `/api/execution/history?projectId=${encodeURIComponent(projectId)}`,
      method: "GET",
      status: "idle",
    },
    {
      name: "Python Backend — Health",
      url: backendUrl ? `${backendUrl}/health` : "",
      method: "GET",
      status: backendUrl ? "idle" : "error",
      message: backendUrl ? undefined : "NEXT_PUBLIC_BACKEND_URL not set",
    },
  ]);

  const checkEndpoint = async (index: number) => {
    const ep = endpoints[index];
    if (!ep.url) return;

    setEndpoints((prev) =>
      prev.map((e, i) => (i === index ? { ...e, status: "checking" } : e)),
    );

    const start = Date.now();
    try {
      const res = await fetch(ep.url, {
        method: ep.method,
        headers:
          ep.method === "POST"
            ? { "Content-Type": "application/json" }
            : undefined,
        body: ep.body,
        signal: AbortSignal.timeout(10000),
      });

      const latencyMs = Date.now() - start;
      setEndpoints((prev) =>
        prev.map((e, i) =>
          i === index
            ? {
                ...e,
                status: res.ok ? "ok" : "error",
                latencyMs,
                httpStatus: res.status,
                message: res.ok ? undefined : `HTTP ${res.status}`,
              }
            : e,
        ),
      );
    } catch (err) {
      const latencyMs = Date.now() - start;
      const message =
        err instanceof Error
          ? err.name === "TimeoutError"
            ? "Timeout (10s)"
            : err.message
          : "Failed";
      setEndpoints((prev) =>
        prev.map((e, i) =>
          i === index
            ? { ...e, status: "error", latencyMs, message }
            : e,
        ),
      );
    }
  };

  const checkAll = async () => {
    for (let i = 0; i < endpoints.length; i++) {
      if (endpoints[i].url) {
        await checkEndpoint(i);
      }
    }
    toast.success("Health check complete");
  };

  const StatusIcon = ({
    status,
  }: {
    status: EndpointStatus["status"];
  }) => {
    if (status === "idle") return <Clock className="h-4 w-4 text-zinc-500" />;
    if (status === "checking")
      return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
    if (status === "ok")
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    return <XCircle className="h-4 w-4 text-red-400" />;
  };

  const latencyColor = (ms: number) => {
    if (ms < 300) return "text-emerald-400";
    if (ms < 1000) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0b0b0b] border-gray-800 text-white sm:max-w-xl shadow-2xl p-0 overflow-hidden rounded-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50 absolute top-0 left-0" />
        <div className="p-6">
          <DialogHeader className="mb-5">
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-cyan-400" />
              API Health Check
            </DialogTitle>
            <p className="text-sm text-zinc-400 mt-1">
              Verify all service endpoints are responding correctly.
            </p>
          </DialogHeader>

          <div className="space-y-2 mb-4">
            {endpoints.map((ep, i) => (
              <motion.div
                key={ep.name}
                className="flex items-center gap-3 bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 hover:border-white/20 transition-colors"
              >
                <StatusIcon status={ep.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-200 font-medium truncate">
                    {ep.name}
                  </p>
                  <p className="text-xs text-zinc-600 truncate font-mono">
                    {ep.method} {ep.url || "(not configured)"}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {ep.latencyMs !== undefined && ep.status !== "checking" && (
                    <span
                      className={`text-xs font-mono ${latencyColor(ep.latencyMs)}`}
                    >
                      {ep.latencyMs}ms
                    </span>
                  )}
                  {ep.httpStatus && ep.status === "ok" && (
                    <span className="text-xs text-zinc-500 font-mono">
                      {ep.httpStatus}
                    </span>
                  )}
                  {ep.message && ep.status === "error" && (
                    <span className="text-xs text-red-400 max-w-28 truncate">
                      {ep.message}
                    </span>
                  )}
                  {ep.url && (
                    <button
                      onClick={() => checkEndpoint(i)}
                      disabled={ep.status === "checking"}
                      className="text-zinc-500 hover:text-white transition-colors disabled:opacity-40"
                      title="Re-check"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {apiKeyCount > 0 && (
            <div className="mb-4 bg-black/20 border border-white/10 rounded-lg p-3">
              <p className="text-xs text-zinc-400 mb-1">
                External API Keys ({apiKeyCount} total)
              </p>
              <p className="text-xs text-zinc-600 font-mono">
                Usage:{" "}
                <span className="text-cyan-400">
                  POST /api/external/run
                </span>{" "}
                with header{" "}
                <span className="text-zinc-300">x-api-key: YOUR_KEY</span>
              </p>
            </div>
          )}

          <Button
            onClick={checkAll}
            className="w-full bg-cyan-500/10 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400/60"
          >
            <Activity className="h-3.5 w-3.5 mr-2" />
            Check All Endpoints
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
