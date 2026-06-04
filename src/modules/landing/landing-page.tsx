"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Database,
  Zap,
  BarChart3,
  Shield,
  GitBranch,
  CheckCircle2,
  MessageSquare,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Hero Section - Bold & Direct */}
      <section className="relative pt-20 pb-20 md:pt-32 md:pb-32 border-b border-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* Badge */}
            <div className="mb-8 inline-block">
              <div className="relative">
                <div className="absolute inset-0 bg-neon-green/10 blur-xl rounded-full" />
                <div className="relative px-4 py-2 rounded-full border border-neon-green/30 bg-black">
                  <p className="text-sm text-neon-green font-mono">
                    Stop writing SQL. Start analyzing data.
                  </p>
                </div>
              </div>
            </div>

            {/* Main Headline - Asymmetrical, Bold */}
            <div className="mb-8">
              <h1 className="text-5xl md:text-7xl font-black leading-tight mb-6 tracking-tight">
                <span className="text-white">Your database</span>
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-green via-neon-green to-emerald-300">
                  talks back.
                </span>
              </h1>
              <p className="text-lg md:text-xl text-gray-400 max-w-2xl font-light leading-relaxed">
                Chat with an AI agent. It writes SQL. Executes queries. Visualizes results.
                All without touching a terminal. For teams that want insight, not headaches.
              </p>
            </div>

            {/* CTA Buttons - Asymmetrical layout */}
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <Link href="/auth/sign-up">
                <Button className="h-12 px-8 bg-neon-green text-black font-semibold hover:bg-neon-green/90 text-base">
                  Try Free <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#demo">
                <Button variant="outline" className="h-12 px-8 border-gray-700 hover:border-neon-green/50 text-base">
                  See It In Action
                </Button>
              </a>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-col sm:flex-row gap-6 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-neon-green" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-neon-green" />
                <span>Free tier includes 10 projects</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-neon-green" />
                <span>Enterprise support available</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section - Real problems, real solutions */}
      <section className="py-20 md:py-32 border-b border-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-black mb-16 tracking-tight">
              The pain you know too well
            </h2>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Pain Point 1 */}
              <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-lg hover:border-gray-700 transition-colors">
                <div className="h-12 w-12 bg-red-500/10 rounded-lg flex items-center justify-center mb-4">
                  <Database className="h-6 w-6 text-red-400" />
                </div>
                <h3 className="text-xl font-bold mb-3">SQL fatigue is real</h3>
                <p className="text-gray-400">
                  You write the same JOIN patterns 100 times. Debugging queries takes longer than analysis. Your team spends 40% of time writing, 10% analyzing.
                </p>
              </div>

              {/* Pain Point 2 */}
              <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-lg hover:border-gray-700 transition-colors">
                <div className="h-12 w-12 bg-yellow-500/10 rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-yellow-400" />
                </div>
                <h3 className="text-xl font-bold mb-3">Insights buried in CSV</h3>
                <p className="text-gray-400">
                  Export to Excel. Paste into Slack. Send PDFs around. No shared context. No history. Results lost in email threads.
                </p>
              </div>

              {/* Pain Point 3 */}
              <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-lg hover:border-gray-700 transition-colors">
                <div className="h-12 w-12 bg-orange-500/10 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-orange-400" />
                </div>
                <h3 className="text-xl font-bold mb-3">Governance = complexity</h3>
                <p className="text-gray-400">
                  Who accessed what? When? Why? Row-level security. Audit trails. Access control. Manual + error-prone.
                </p>
              </div>

              {/* Pain Point 4 */}
              <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-lg hover:border-gray-700 transition-colors">
                <div className="h-12 w-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold mb-3">Tools that slow you down</h3>
                <p className="text-gray-400">
                  DBeaver. Adminer. SQL Workbench. Good tools, but they're built for 2005. Not for teams. Not for speed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section - How XBase solves it */}
      <section id="demo" className="py-20 md:py-32 border-b border-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
              Meet XBase
            </h2>
            <p className="text-xl text-gray-400 mb-16 max-w-2xl">
              Chat with your database. No SQL required. No copy-paste. Real insights in seconds.
            </p>

            <div className="space-y-12">
              {/* Feature 1 - Chat Interface */}
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <h3 className="text-3xl font-bold mb-4">
                    Chat, not click
                  </h3>
                  <p className="text-gray-400 text-lg mb-6 leading-relaxed">
                    "Show me revenue by region last quarter" → Done.
                    No schema hunting. No manual joins. Just natural language.
                  </p>
                  <ul className="space-y-3 text-sm">
                    <li className="flex gap-3">
                      <CheckCircle2 className="h-5 w-5 text-neon-green flex-shrink-0 mt-0.5" />
                      <span>AI learns your schema instantly</span>
                    </li>
                    <li className="flex gap-3">
                      <CheckCircle2 className="h-5 w-5 text-neon-green flex-shrink-0 mt-0.5" />
                      <span>Suggest indexes & optimizations automatically</span>
                    </li>
                    <li className="flex gap-3">
                      <CheckCircle2 className="h-5 w-5 text-neon-green flex-shrink-0 mt-0.5" />
                      <span>Multi-step queries in one prompt</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-lg aspect-square flex items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 text-neon-green mx-auto mb-4" />
                    <p className="text-gray-500 text-sm">
                      Chat interface demo
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 2 - Smart Fill & ML */}
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-lg aspect-square flex items-center justify-center order-2 md:order-1">
                  <div className="text-center">
                    <Zap className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
                    <p className="text-gray-500 text-sm">
                      Smart Fill demo
                    </p>
                  </div>
                </div>
                <div className="order-1 md:order-2">
                  <h3 className="text-3xl font-bold mb-4">
                    Data that fixes itself
                  </h3>
                  <p className="text-gray-400 text-lg mb-6 leading-relaxed">
                    Missing values? XBase predicts them. 100K row backfill? Done in milliseconds. Association mining finds hidden patterns.
                  </p>
                  <ul className="space-y-3 text-sm">
                    <li className="flex gap-3">
                      <CheckCircle2 className="h-5 w-5 text-neon-green flex-shrink-0 mt-0.5" />
                      <span>RandomForest-powered predictions</span>
                    </li>
                    <li className="flex gap-3">
                      <CheckCircle2 className="h-5 w-5 text-neon-green flex-shrink-0 mt-0.5" />
                      <span>Apriori association mining</span>
                    </li>
                    <li className="flex gap-3">
                      <CheckCircle2 className="h-5 w-5 text-neon-green flex-shrink-0 mt-0.5" />
                      <span>Data quality scoring (freshness, completeness)</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Feature 3 - Collaboration */}
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <h3 className="text-3xl font-bold mb-4">
                    Collaboration built-in
                  </h3>
                  <p className="text-gray-400 text-lg mb-6 leading-relaxed">
                    Share projects. Invite teams. Set roles (owner, editor, viewer). Every query tracked. Every change logged.
                  </p>
                  <ul className="space-y-3 text-sm">
                    <li className="flex gap-3">
                      <CheckCircle2 className="h-5 w-5 text-neon-green flex-shrink-0 mt-0.5" />
                      <span>Role-based access control</span>
                    </li>
                    <li className="flex gap-3">
                      <CheckCircle2 className="h-5 w-5 text-neon-green flex-shrink-0 mt-0.5" />
                      <span>Query history with diffs</span>
                    </li>
                    <li className="flex gap-3">
                      <CheckCircle2 className="h-5 w-5 text-neon-green flex-shrink-0 mt-0.5" />
                      <span>Notifications for schema changes</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-lg aspect-square flex items-center justify-center">
                  <div className="text-center">
                    <GitBranch className="h-12 w-12 text-purple-400 mx-auto mb-4" />
                    <p className="text-gray-500 text-sm">
                      Collaboration demo
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 md:py-32 border-b border-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-black mb-4 tracking-tight text-center">
              Pricing that doesn't suck
            </h2>
            <p className="text-xl text-gray-400 text-center mb-16 max-w-2xl mx-auto">
              Pay for what you use. No surprises. No mandatory enterprise plans for features you don't need.
            </p>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Starter */}
              <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-lg">
                <h3 className="text-xl font-bold mb-2">Starter</h3>
                <p className="text-gray-500 text-sm mb-6">Free forever</p>
                <div className="text-4xl font-black mb-8">$0</div>
                <ul className="space-y-3 mb-8 text-sm">
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-neon-green flex-shrink-0 mt-0.5" />
                    <span>10 projects</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-neon-green flex-shrink-0 mt-0.5" />
                    <span>100k AI queries/month</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-neon-green flex-shrink-0 mt-0.5" />
                    <span>Community support</span>
                  </li>
                </ul>
                <Button variant="outline" className="w-full border-gray-700">
                  Get Started
                </Button>
              </div>

              {/* Pro - Highlighted */}
              <div className="bg-gradient-to-br from-neon-green/5 to-transparent border border-neon-green/30 p-8 rounded-lg md:scale-105 md:shadow-2xl md:shadow-neon-green/10">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-neon-green text-black text-xs font-bold rounded-full">
                  POPULAR
                </div>
                <h3 className="text-xl font-bold mb-2">Pro</h3>
                <p className="text-gray-500 text-sm mb-6">Scale with your team</p>
                <div className="text-4xl font-black mb-2">$99</div>
                <p className="text-sm text-gray-500 mb-8">/month, billed annually</p>
                <ul className="space-y-3 mb-8 text-sm">
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-neon-green flex-shrink-0 mt-0.5" />
                    <span>Unlimited projects</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-neon-green flex-shrink-0 mt-0.5" />
                    <span>10M AI queries/month</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-neon-green flex-shrink-0 mt-0.5" />
                    <span>Team collaboration</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-neon-green flex-shrink-0 mt-0.5" />
                    <span>Email support (24h)</span>
                  </li>
                </ul>
                <Button className="w-full bg-neon-green text-black hover:bg-neon-green/90 font-semibold">
                  Start Free Trial
                </Button>
              </div>

              {/* Enterprise */}
              <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-lg">
                <h3 className="text-xl font-bold mb-2">Enterprise</h3>
                <p className="text-gray-500 text-sm mb-6">For power users</p>
                <div className="text-4xl font-black mb-8">Custom</div>
                <ul className="space-y-3 mb-8 text-sm">
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-neon-green flex-shrink-0 mt-0.5" />
                    <span>Everything in Pro</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-neon-green flex-shrink-0 mt-0.5" />
                    <span>SSO & advanced security</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-neon-green flex-shrink-0 mt-0.5" />
                    <span>Dedicated support</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="h-4 w-4 text-neon-green flex-shrink-0 mt-0.5" />
                    <span>Custom integrations</span>
                  </li>
                </ul>
                <Button variant="outline" className="w-full border-gray-700">
                  Contact Us
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Minimal & Bold */}
      <section className="py-20 md:py-32 border-b border-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-5xl md:text-6xl font-black mb-6 tracking-tight">
              Ready to talk to your data?
            </h2>
            <p className="text-lg text-gray-400 mb-8">
              Stop writing queries. Start asking questions. XBase does the rest.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/sign-up">
                <Button className="h-12 px-8 bg-neon-green text-black font-semibold hover:bg-neon-green/90 text-base">
                  Try Free Today <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="https://github.com/Hariking967/xbase-app" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="h-12 px-8 border-gray-700 hover:border-neon-green/50 text-base">
                  View on GitHub
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Simple */}
      <footer className="py-12 border-t border-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
              <div>
                <h4 className="font-bold mb-4">XBase</h4>
                <p className="text-sm text-gray-500">
                  Chat with your database. Get answers instantly.
                </p>
              </div>
              <div>
                <h4 className="font-bold mb-4 text-sm">Product</h4>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li><a href="#" className="hover:text-neon-green">Features</a></li>
                  <li><a href="#" className="hover:text-neon-green">Pricing</a></li>
                  <li><a href="#" className="hover:text-neon-green">Docs</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-4 text-sm">Company</h4>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li><a href="#" className="hover:text-neon-green">About</a></li>
                  <li><a href="#" className="hover:text-neon-green">Blog</a></li>
                  <li><a href="#" className="hover:text-neon-green">Status</a></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold mb-4 text-sm">Legal</h4>
                <ul className="space-y-2 text-sm text-gray-500">
                  <li><a href="#" className="hover:text-neon-green">Privacy</a></li>
                  <li><a href="#" className="hover:text-neon-green">Terms</a></li>
                  <li><a href="#" className="hover:text-neon-green">Contact</a></li>
                </ul>
              </div>
            </div>
            <div className="border-t border-gray-900 pt-8 flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500">
              <p>&copy; 2026 XBase. Built for developers who think differently.</p>
              <div className="flex gap-4 mt-4 sm:mt-0">
                <a href="#" className="hover:text-neon-green">Twitter</a>
                <a href="#" className="hover:text-neon-green">GitHub</a>
                <a href="#" className="hover:text-neon-green">Discord</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
