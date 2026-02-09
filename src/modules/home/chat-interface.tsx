"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight, ChevronLeft, Send, Sparkles } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface ChatInterfaceProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
}

export function ChatInterface({ 
  messages = [], 
  onSendMessage 
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input);
    setInput("");
  };

  return (
    <div className="flex h-full flex-col bg-transparent border-l border-white/5 relative">
      <div className="flex items-center justify-between p-8 md:p-12 border-b border-white/5 bg-black/20 backdrop-blur-sm">
        <h3 className="text-neon-green font-bold flex items-center gap-2 drop-shadow-sm">
            <Sparkles className="h-4 w-4 text-neon-green" />
            AI Assistant
        </h3>
      </div>

      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 mt-20">
            <div className="p-4 rounded-full bg-white/5 border border-white/10 mb-4 animate-pulse">
                <Sparkles className="h-8 w-8 text-neon-green opacity-50" />
            </div>
            <p className="text-sm font-medium">Ask anything...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm shadow-lg backdrop-blur-md ${
                    msg.role === "user"
                      ? "bg-neon-green/10 text-white border border-neon-green/30 shadow-[0_0_10px_rgba(74,222,128,0.1)] rounded-br-none"
                      : "bg-black/40 text-gray-200 border border-white/10 rounded-bl-none"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <form onSubmit={handleSubmit} className="p-4 border-t border-white/5 bg-black/20 backdrop-blur-md">
        <div className="relative group">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="pr-12 bg-white/5 border-white/10 focus:border-neon-green/50 focus:ring-neon-green/20 text-white placeholder:text-neutral-500 rounded-xl h-12 transition-all group-hover:bg-white/[0.07] group-hover:border-white/20"
          />
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            className="absolute right-2 top-2 h-8 w-8 text-neon-green hover:bg-neon-green/10 hover:text-neon-green transition-all"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
