"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Database,
  Code,
  BarChart3,
  MessageSquare,
  Terminal,
} from "lucide-react";
import { WebGLShader } from "@/components/ui/webgl-shader";

import { ScrollingText } from "@/components/ui/scrolling-text";

export default function LandingPage() {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (cursorRef.current) {
        cursorRef.current.style.background = `radial-gradient(600px circle at ${e.clientX}px ${e.clientY}px, rgba(74,222,128,0.15), transparent 40%)`;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-neon-green/20 selection:text-neon-green overflow-hidden relative">
      <WebGLShader />
      <div className="absolute inset-0 bg-black/40" />
      <div
        ref={cursorRef}
        className="pointer-events-none fixed inset-0 z-50 transition-colors duration-300"
      />
      {/* Hero Section */}
      <section className="relative pt-32 pb-16 md:pt-48 md:pb-32">
        {/* Background Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-neon-green/10 rounded-[100%] blur-[120px] -z-10 pointer-events-none opacity-50" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-neon-green/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-neon-green/20 bg-neon-green/5 px-3 py-1 text-xs font-medium text-neon-green mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-green opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-green"></span>
            </span>
            XBase is now in public beta
          </div>

          <h1 className="text-5xl md:text-8xl font-bold tracking-tight mb-6 text-white animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 relative">
            Build queries fast.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-green to-emerald-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.3)]">
              Collaborate even faster.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-neutral-300 max-w-2xl mx-auto mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            Welcome to XBase, where AI writes and runs your Python and SQL.
          </p>
          <p className="text-sm text-neutral-400 max-w-xl mx-auto mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-400">
            Start with a Neon connection string, execute safely in Docker, and
            share access with roles in minutes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500 mb-16">
            <Link href="/auth/sign-up">
              <Button
                size="lg"
                className="h-14 px-8 text-lg bg-neon-green text-black hover:bg-neon-green/90 shadow-[0_0_20px_rgba(74,222,128,0.4)] hover:shadow-[0_0_30px_rgba(74,222,128,0.6)] transition-all font-bold rounded-xl border border-neon-green/50"
              >
                Start Building Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="#features">
              <Button
                variant="outline"
                size="lg"
                className="h-14 px-8 text-lg border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20 hover:text-white rounded-xl backdrop-blur-sm"
              >
                Explore Features
              </Button>
            </Link>
          </div>

          <ScrollingText />
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">
              Core Capabilities
            </h2>
            <p className="text-neutral-400">
              Everything you need to master your data.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="group rounded-2xl border border-white/5 bg-white/[0.02] p-8 transition-all hover:bg-white/[0.05] hover:border-neon-green/30 hover:shadow-[0_0_30px_rgba(74,222,128,0.1)] relative overflow-hidden backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-neon-green/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="h-12 w-12 rounded-xl bg-neon-green/10 flex items-center justify-center mb-6 text-neon-green border border-neon-green/20 group-hover:scale-110 transition-transform duration-300">
                <Database className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white group-hover:text-neon-green transition-colors">
                SQL Runner + Table View
              </h3>
              <p className="text-neutral-400 mb-4 z-10 relative">
                Run SQL directly against your Neon database and inspect the
                results instantly in a clean table view.
              </p>
              <ul className="space-y-2 text-sm text-neutral-500 relative z-10">
                <li className="flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-green mr-2 shadow-[0_0_5px_var(--color-neon-green)]" />
                  Query history logged
                </li>
                <li className="flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-green mr-2 shadow-[0_0_5px_var(--color-neon-green)]" />
                  CSV output ready
                </li>
              </ul>
            </div>

            {/* Feature 2 */}
            <div className="group rounded-2xl border border-white/5 bg-white/[0.02] p-8 transition-all hover:bg-white/[0.05] hover:border-neon-green/30 hover:shadow-[0_0_30px_rgba(74,222,128,0.1)] relative overflow-hidden backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-neon-green/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="h-12 w-12 rounded-xl bg-neon-green/10 flex items-center justify-center mb-6 text-neon-green border border-neon-green/20 group-hover:scale-110 transition-transform duration-300">
                <Code className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white group-hover:text-neon-green transition-colors">
                Python Runner in Docker
              </h3>
              <p className="text-neutral-400 mb-4 relative z-10">
                Run Python with real database credentials in a containerized
                runtime and capture stdout, plots, and data.
              </p>
              <ul className="space-y-2 text-sm text-neutral-500 relative z-10">
                <li className="flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-2" />
                  DataFrame input supported
                </li>
                <li className="flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-2" />
                  Timeout enforced
                </li>
              </ul>
            </div>

            {/* Feature 3 */}
            <div className="group rounded-2xl border border-white/5 bg-white/[0.02] p-8 transition-all hover:bg-white/[0.05] hover:border-neon-green/30 hover:shadow-[0_0_30px_rgba(74,222,128,0.1)] relative overflow-hidden backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-neon-green/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="h-12 w-12 rounded-xl bg-neon-green/10 flex items-center justify-center mb-6 text-neon-green border border-neon-green/20 group-hover:scale-110 transition-transform duration-300">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white group-hover:text-neon-green transition-colors">
                Execution Results
              </h3>
              <p className="text-neutral-400 mb-4 relative z-10">
                Store SQL and Python outputs with status, errors, and visual
                payloads for repeatable insight sharing.
              </p>
              <div className="flex gap-2 mt-4 relative z-10">
                <span className="px-2 py-1 rounded-md bg-white/5 text-xs font-mono border border-white/10 text-neutral-300">
                  History
                </span>
                <span className="px-2 py-1 rounded-md bg-white/5 text-xs font-mono border border-white/10 text-neutral-300">
                  Errors
                </span>
                <span className="px-2 py-1 rounded-md bg-white/5 text-xs font-mono border border-white/10 text-neutral-300">
                  Images
                </span>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="group rounded-2xl border border-white/5 bg-white/[0.02] p-8 transition-all hover:bg-white/[0.05] hover:border-neon-green/30 hover:shadow-[0_0_30px_rgba(74,222,128,0.1)] relative overflow-hidden backdrop-blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-neon-green/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="h-12 w-12 rounded-xl bg-neon-green/10 flex items-center justify-center mb-6 text-neon-green border border-neon-green/20 group-hover:scale-110 transition-transform duration-300">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white group-hover:text-neon-green transition-colors">
                Team Collaboration
              </h3>
              <p className="text-neutral-400 mb-4 relative z-10">
                Invite teammates by email and keep access controlled with owner,
                editor, and viewer roles.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="group rounded-2xl border border-white/5 bg-white/[0.02] p-8 transition-all hover:bg-white/[0.05] hover:border-neon-green/30 hover:shadow-[0_0_30px_rgba(74,222,128,0.1)] relative overflow-hidden backdrop-blur-sm md:col-span-2">
              <div className="absolute inset-0 bg-gradient-to-br from-neon-green/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="h-12 w-12 rounded-xl bg-neon-green/10 flex items-center justify-center mb-6 text-neon-green border border-neon-green/20 group-hover:scale-110 transition-transform duration-300">
                <Terminal className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white group-hover:text-neon-green transition-colors">
                External Connect API
              </h3>
              <p className="text-neutral-400 mb-4 opacity-100 relative z-10">
                Generate API keys and run SQL or Python from outside XBase with
                rate limits, logging, and the same project permissions.
              </p>
              <div className="w-full rounded-lg bg-black border border-white/10 p-4 font-mono text-sm text-neutral-400 relative z-10 shadow-inner">
                <span className="text-purple-400">POST</span> /api/external/run{" "}
                <br />
                <span className="text-yellow-400">{"{"}</span> <br />
                &nbsp;&nbsp;"type": "sql", <br />
                &nbsp;&nbsp;"query": "SELECT * FROM users LIMIT 10" <br />
                <span className="text-yellow-400">{"}"}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 bg-black relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-neon-green/20 to-transparent"></div>
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-neon-green text-black font-bold text-xs shadow-[0_0_10px_rgba(74,222,128,0.4)]">
              X
            </div>
            <span className="text-sm font-semibold text-white">XBase</span>
          </div>
          <p className="text-sm text-neutral-600">
            © 2026 XBase. AI Control Plane for Databases.
          </p>
        </div>
      </footer>
    </div>
  );
}
