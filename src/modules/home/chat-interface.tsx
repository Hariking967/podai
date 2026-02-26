"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles, User, Bot } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
} from "recharts";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  data_location?: {
    fileName?: string;
    output?: {
      prints?: string;
      result?: {
        plot?: {
          type?: "line" | "bar";
          data?: Record<string, unknown>[];
          xKey?: string;
          yKey?: string;
        };
      };
      error?: { message: string; traceback: string } | null;
    };
  };
}

interface ChatInterfaceProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isPending?: boolean;
}

export function ChatInterface({ 
  messages = [], 
  onSendMessage,
  isPending
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const emptyStateHints = ["Listening for prompts", "Neural context warming", "Ready for first message"];

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, isPending]);

  const renderPlot = (message: ChatMessage) => {
    const plot = message.data_location?.output?.result?.plot;
    if (!plot?.data?.length || !plot.xKey || !plot.yKey) return null;

    if (plot.type === "bar") {
      return (
        <div className="h-64 w-full rounded-2xl bg-black/40 border border-white/10 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={plot.data}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
              <XAxis dataKey={plot.xKey} stroke="#9ca3af" fontSize={11} />
              <YAxis stroke="#9ca3af" fontSize={11} />
              <Tooltip contentStyle={{ background: "#0b0d10", border: "1px solid rgba(255,255,255,0.1)" }} />
              <Bar dataKey={plot.yKey} fill="#4ade80" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    return (
      <div className="h-64 w-full rounded-2xl bg-black/40 border border-white/10 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={plot.data}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
            <XAxis dataKey={plot.xKey} stroke="#9ca3af" fontSize={11} />
            <YAxis stroke="#9ca3af" fontSize={11} />
            <Tooltip contentStyle={{ background: "#0b0d10", border: "1px solid rgba(255,255,255,0.1)" }} />
            <Line type="monotone" dataKey={plot.yKey} stroke="#4ade80" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input);
    setInput("");
  };

  return (
    <div className="flex h-full flex-col glass-panel relative rounded-2xl overflow-hidden m-4">
      <div className="pointer-events-none absolute inset-x-1 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <div className="pointer-events-none absolute -top-32 right-10 h-64 w-64 rounded-full bg-neon-green/10 blur-[90px]" />
      <div className="pointer-events-none absolute -bottom-32 left-10 h-64 w-64 rounded-full bg-emerald-300/5 blur-[90px]" />

      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/10 bg-zinc-950/35 backdrop-blur-xl relative z-20">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-neon-green/10 border border-neon-green/20 flex items-center justify-center shadow-[0_0_15px_rgba(74,222,128,0.15)] animate-float-slow">
                <Sparkles className="h-5 w-5 text-neon-green" />
            </div>
            <div>
                <h3 className="font-bold text-zinc-100 tracking-tight">AI Assistant</h3>
                <p className="text-xs text-neon-green/70 font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse shadow-[0_0_5px_rgba(74,222,128,1)]"></span>
                    Active Session
                </p>
            </div>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 p-6 relative z-10 bg-gradient-to-b from-transparent via-zinc-500/[0.04] to-zinc-500/[0.08] overflow-y-auto neon-scrollbar"
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
              Start the chat and the assistant will switch from ambient mode to live responses.
            </p>

            <div className="mt-8 flex gap-2">
              {[0, 1, 2, 3].map((bar) => (
                <motion.span
                  key={bar}
                  animate={{ scaleY: [0.45, 1, 0.45], opacity: [0.45, 1, 0.45] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: bar * 0.12, ease: "easeInOut" }}
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
                  transition={{ duration: 2.6, repeat: Infinity, delay: idx * 0.35, ease: "easeInOut" }}
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
                            {msg.data_location.output?.prints && (
                              <pre className="text-xs text-zinc-300 bg-black/40 border border-white/10 rounded-xl p-3 whitespace-pre-wrap">
                                {msg.data_location.output?.prints}
                              </pre>
                            )}
                            {renderPlot(msg)}
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
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
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
                                transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                                className="w-2 h-2 bg-neon-green rounded-full shadow-[0_0_5px_rgba(74,222,128,0.8)] opacity-70" 
                            />
                             <motion.div 
                                animate={{ y: [0, -5, 0] }}
                                transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
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
      <div className="p-4 relative z-20 bg-transparent">
        <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto group">
          <div className="relative rounded-3xl glass-panel-soft transition-all duration-300 focus-within:border-neon-green/50 focus-within:ring-1 focus-within:ring-neon-green/35 focus-within:shadow-[0_0_28px_rgba(74,222,128,0.16)] overflow-hidden">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Send a message to xBase..."
                disabled={isPending}
                className="w-full pl-6 pr-16 py-4 h-[64px] bg-transparent border-none focus-visible:ring-0 text-zinc-100 placeholder:text-zinc-500 text-base shadow-none rounded-3xl"
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
    </div>
  );
}
