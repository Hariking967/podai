"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Database,
  BarChart2,
  Brain,
  Sparkles,
  History,
  Key,
  Users,
  ChevronLeft,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface SidebarProps {
  projectName: string;
}

const sections = [
  { label: "Tables", icon: Database, path: "tables" },
  { label: "Visualisation", icon: BarChart2, path: "visualisation" },
  { label: "ML & SmartFill", icon: Brain, path: "ml" },
  { label: "XAI", icon: Sparkles, path: "xai" },
  { label: "History", icon: History, path: "history" },
  { label: "APIs", icon: Key, path: "apis" },
  { label: "Contributors", icon: Users, path: "contributors" },
];

export function Sidebar({ projectName }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const base = `/${encodeURIComponent(projectName)}`;

  return (
    <aside
      className={cn(
        "flex flex-col bg-[#0f0f0f] border-r border-gray-800/60 transition-all duration-200 shrink-0",
        collapsed ? "w-14" : "w-52"
      )}
    >
      {/* Logo / project name */}
      <div className="flex items-center gap-2 px-3 py-4 border-b border-gray-800/60 h-14">
        <Layers className="h-5 w-5 text-green-400 shrink-0" />
        {!collapsed && (
          <span className="text-sm font-semibold truncate text-white">
            {projectName}
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 space-y-0.5 px-2">
        {sections.map(({ label, icon: Icon, path }) => {
          const href = `${base}/${path}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={path}
              href={href}
              className={cn(
                "flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-all",
                active
                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 py-3 border-t border-gray-800/60">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 px-2 py-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 w-full text-sm transition-all"
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 shrink-0 transition-transform",
              collapsed && "rotate-180"
            )}
          />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
