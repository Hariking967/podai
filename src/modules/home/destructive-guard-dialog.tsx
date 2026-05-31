"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShieldAlert } from "lucide-react";

interface DestructiveGuardDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  detectedPattern: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DestructiveGuardDialog({
  open,
  onOpenChange,
  detectedPattern,
  message,
  onConfirm,
  onCancel,
}: DestructiveGuardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0b0b0b] border-red-900/60 text-white sm:max-w-md shadow-2xl p-0 overflow-hidden rounded-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-60 absolute top-0 left-0" />
        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-400" />
              Destructive Command Detected
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                <span className="text-xs text-red-400 font-medium">
                  Matched: {detectedPattern}
                </span>
              </div>
              <p className="text-sm text-zinc-300">
                Your message may cause the AI to execute irreversible database
                operations.
              </p>
            </div>

            <div className="bg-black/30 border border-white/10 rounded-lg p-3">
              <p className="text-xs text-zinc-400 mb-1">Your message:</p>
              <p className="text-sm text-zinc-200 line-clamp-4">{message}</p>
            </div>

            <p className="text-xs text-zinc-500">
              The AI will be instructed to preview the command and ask for
              your confirmation before executing any destructive operations.
            </p>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  onCancel();
                  onOpenChange(false);
                }}
                className="flex-1 bg-black/40 border border-gray-700 text-zinc-300 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  onConfirm();
                  onOpenChange(false);
                }}
                className="flex-1 bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 hover:border-red-400/60"
              >
                Proceed Anyway
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
