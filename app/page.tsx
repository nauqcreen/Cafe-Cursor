"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CursorLogo } from "@/components/cursor-logo";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const RECENT_STORAGE_KEY = "cursor-context-recent-repos";
const RECENT_MAX = 5;

const QUICK_PRESETS = [
  { label: "Next.js 14 + Tailwind + Supabase", value: "Next.js 14, Tailwind CSS, Supabase (PostgreSQL + Auth), TypeScript, App Router, Shadcn UI" },
  { label: "React Native + Expo + Zustand", value: "React Native, Expo SDK, Zustand, TypeScript, React Navigation, NativeWind" },
  { label: "Python FastAPI + PostgreSQL + React", value: "Python, FastAPI, PostgreSQL, SQLAlchemy, Alembic, React, TypeScript, Vite, Tailwind CSS" },
  { label: "Vue 3 + Nuxt + Pinia", value: "Vue 3, Nuxt 3, Pinia, TypeScript, Tailwind CSS, VueUse" },
  { label: "T3 Stack", value: "Next.js, TypeScript, tRPC, Prisma, NextAuth.js, Tailwind CSS" },
  { label: "Laravel + Inertia + React", value: "PHP, Laravel 11, Inertia.js, React, TypeScript, Tailwind CSS, Vite" },
] as const;

function getRecentRepos(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((u) => typeof u === "string") : [];
  } catch {
    return [];
  }
}

function addRecentRepo(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return;
  let list = getRecentRepos().filter((u) => u !== trimmed);
  list = [trimmed, ...list].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function repoLabel(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
    if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
  } catch {
    // ignore
  }
  return url;
}

function HomeContent() {
  const searchParams = useSearchParams();
  const [repoUrl, setRepoUrl] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [generatedRules, setGeneratedRules] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  const [recentRepos, setRecentRepos] = useState<string[]>([]);
  const [refineInput, setRefineInput] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [curlCopyStatus, setCurlCopyStatus] = useState<"idle" | "copied">("idle");
  const [badgeCopyStatus, setBadgeCopyStatus] = useState<"idle" | "copied">("idle");
  const [isCreatingGist, setIsCreatingGist] = useState(false);
  const [trendingRepos, setTrendingRepos] = useState<{ repo: string; count: number }[]>([]);
  const codeContainerRef = useRef<HTMLDivElement>(null);

  const BASE_URL = "https://cafe-cursor-sepia.vercel.app";

  const curlRepoSlug = (() => {
    if (repoUrl.trim()) {
      try {
        const u = new URL(repoUrl.trim());
        const parts = u.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
        if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
      } catch { /* empty */ }
    }
    return "<owner>/<repo>";
  })();

  const curlCommand = `curl -sL "${BASE_URL}/api/raw?repo=${curlRepoSlug}" > .cursorrules`;

  const badgeAppUrl = `${BASE_URL}/?repo=${curlRepoSlug}`;
  const badgeImageUrl = `https://img.shields.io/badge/Cursor-Optimized-blue?logo=cursor&logoColor=white`;
  const badgeMarkdown =
    curlRepoSlug === "<owner>/<repo>"
      ? `[![Cursor Rules](${badgeImageUrl})](${BASE_URL})`
      : `[![Cursor Rules](${badgeImageUrl})](${badgeAppUrl})`;

  const handleBadgeCopy = async () => {
    try {
      await navigator.clipboard.writeText(badgeMarkdown);
      setBadgeCopyStatus("copied");
      window.setTimeout(() => setBadgeCopyStatus("idle"), 2000);
      toast.success("Badge Markdown copied!");
    } catch {
      toast.error("Failed to copy.");
    }
  };

  const handleCurlCopy = async () => {
    try {
      await navigator.clipboard.writeText(curlCommand);
      setCurlCopyStatus("copied");
      window.setTimeout(() => setCurlCopyStatus("idle"), 2000);
    } catch {
      toast.error("Failed to copy.");
    }
  };

  const fetchTrending = useCallback(async () => {
    try {
      const res = await fetch("/api/trending");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.trending)) setTrendingRepos(data.trending);
    } catch {
      // silently ignore — trending is non-critical
    }
  }, []);

  useEffect(() => {
    setRecentRepos(getRecentRepos());
    fetchTrending();
  }, [fetchTrending]);

  // Pre-fill GitHub URL when running locally (dev convenience)
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ) {
      setRepoUrl("https://github.com/shadcn-ui/ui");
    }
  }, []);

  // Auto-generate from ?repo= URL param on first mount
  useEffect(() => {
    const param = searchParams.get("repo");
    if (!param) return;
    // Normalise: "owner/repo" → full URL; already a URL → use as-is
    const githubUrl = param.startsWith("http")
      ? param
      : `https://github.com/${param}`;
    setRepoUrl(githubUrl);
    runGenerate(githubUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  // Auto-scroll to bottom as text streams in so the view follows the latest line
  useEffect(() => {
    if (!codeContainerRef.current) return;
    const el = codeContainerRef.current;
    el.scrollTop = el.scrollHeight;
  }, [generatedRules]);

  const runGenerate = useCallback(async (overrideGithubUrl?: string) => {
    const githubUrl = overrideGithubUrl ?? repoUrl.trim();
    const manual = manualInput.trim();
    if (!githubUrl && !manual) {
      toast.error("Enter a GitHub repo URL or paste package.json / describe your stack.");
      return;
    }
    setIsGenerating(true);
    setGeneratedRules("");
    try {
      const body: { githubUrl?: string; manualStack?: string } = {};
      if (githubUrl) body.githubUrl = githubUrl;
      if (manual) body.manualStack = manual;

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Something went wrong.");
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) {
        toast.error("Streaming not supported.");
        return;
      }

      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setGeneratedRules(accumulated);
      }
      setGeneratedRules((prev) => prev.trim());
      if (githubUrl) {
        addRecentRepo(githubUrl);
        setRecentRepos(getRecentRepos());
        fetchTrending();
      }
      toast.success("Rules generated.");
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setIsGenerating(false);
    }
  }, [repoUrl, manualInput, fetchTrending]);

  const handleGenerate = () => runGenerate();

  const handleCopy = async () => {
    if (!generatedRules) return;
    try {
      await navigator.clipboard.writeText(generatedRules);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      toast.error("Failed to copy.");
    }
  };

  const handleDownload = () => {
    if (!generatedRules) return;
    const blob = new Blob([generatedRules], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ".cursorrules";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded .cursorrules");
  };

  const handleCreateGist = async () => {
    if (!generatedRules) return;
    setIsCreatingGist(true);
    try {
      const repoName = curlRepoSlug !== "<owner>/<repo>" ? curlRepoSlug : "your project";
      const res = await fetch("/api/gist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: generatedRules, repoName }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create Gist.");
        return;
      }
      const gistUrl: string = data.url;
      toast.success("Gist created successfully!", {
        duration: 8000,
        action: {
          label: "Open Gist",
          onClick: () => window.open(gistUrl, "_blank", "noopener,noreferrer"),
        },
        description: (
          <button
            type="button"
            className="mt-1 text-xs underline underline-offset-2 opacity-70 hover:opacity-100"
            onClick={() => {
              navigator.clipboard.writeText(gistUrl).catch(() => {});
            }}
          >
            Copy link
          </button>
        ),
      });
    } catch {
      toast.error("Something went wrong creating the Gist.");
    } finally {
      setIsCreatingGist(false);
    }
  };

  const handleRefine = async () => {
    if (!refineInput.trim()) {
      toast.error("Describe what you want to change.");
      return;
    }
    if (!generatedRules) return;
    setIsRefining(true);
    setGeneratedRules("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          existingRules: generatedRules,
          refinementPrompt: refineInput.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Something went wrong.");
        return;
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) { toast.error("Streaming not supported."); return; }
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setGeneratedRules(accumulated);
      }
      setGeneratedRules((prev) => prev.trim());
      setRefineInput("");
      toast.success("Rules refined.");
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-[#0a0a0a]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3 sm:px-6">
          <CursorLogo />
          <a
            href="https://github.com/nauqcreen/Cafe-Cursor"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "group flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/50",
              "px-3 py-1.5 text-xs font-medium text-zinc-400 transition-all duration-150",
              "hover:border-zinc-500 hover:bg-zinc-700/60 hover:text-white"
            )}
          >
            <svg
              viewBox="0 0 16 16"
              className="size-3.5 fill-current transition-transform duration-150 group-hover:scale-110"
              aria-hidden="true"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <span>Star on GitHub</span>
            <svg
              viewBox="0 0 16 16"
              className="size-3 fill-current text-zinc-500 group-hover:text-yellow-400 transition-colors duration-150"
              aria-hidden="true"
            >
              <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25z" />
            </svg>
          </a>
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        {/* Hero */}
        <header className="mb-10 text-center">
          <p className="mb-2 text-sm font-medium uppercase tracking-wider text-zinc-500">
            CursorContext Architect
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Generate the Perfect .cursorrules for Your Project
          </h1>
          <p className="mt-3 text-zinc-400">
            Paste a GitHub repo or describe your stack to get tailored Cursor rules.
          </p>
        </header>

        {/* Global Trending + Recent — side by side when both exist */}
        {(trendingRepos.length > 0 || recentRepos.length > 0) && (
          <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:gap-10">
            {/* 🔥 Global Trending */}
            {trendingRepos.length > 0 && (
              <div className="flex-1">
                <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  <span>🔥</span>
                  <span>Global Trending</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {trendingRepos.map(({ repo, count }, i) => (
                    <button
                      key={repo}
                      type="button"
                      onClick={() => {
                        setRepoUrl(`https://github.com/${repo}`);
                        setManualInput("");
                        runGenerate(`https://github.com/${repo}`);
                      }}
                      className={cn(
                        "group flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-all",
                        i === 0
                          ? "border-orange-500/50 bg-orange-500/10 text-orange-300 hover:border-orange-400/70 hover:bg-orange-500/20"
                          : i === 1
                          ? "border-yellow-500/40 bg-yellow-500/8 text-yellow-300 hover:border-yellow-400/60 hover:bg-yellow-500/15"
                          : "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700/60 hover:text-white"
                      )}
                    >
                      <span className="font-medium">{repo}</span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                          i === 0
                            ? "bg-orange-500/30 text-orange-200"
                            : i === 1
                            ? "bg-yellow-500/25 text-yellow-200"
                            : "bg-zinc-700/80 text-zinc-400"
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Generations */}
            {recentRepos.length > 0 && (
              <div className="flex-1">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Recent
                </p>
                <div className="flex flex-wrap gap-2">
                  {recentRepos.map((url) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => {
                        setRepoUrl(url);
                        setManualInput("");
                      }}
                      className={cn(
                        "rounded-md border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-300",
                        "transition-colors hover:border-zinc-600 hover:bg-zinc-700/60 hover:text-white"
                      )}
                    >
                      {repoLabel(url)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input section */}
        <Card className="border-zinc-800 bg-zinc-900/50 shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg text-white">Source</CardTitle>
            <CardDescription className="text-zinc-400">
              GitHub repository URL or paste package.json / tech stack below.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500">
                GitHub Repository URL
              </label>
              <Input
                type="url"
                placeholder="https://github.com/user/repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className="border-zinc-700 bg-zinc-800/50 placeholder:text-zinc-500 focus-visible:ring-white/20"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-zinc-700" />
              <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Or
              </span>
              <span className="h-px flex-1 bg-zinc-700" />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-500">
                  Paste package.json or describe your tech stack
                </label>
                <span className="text-xs text-zinc-600">Quick Presets</span>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setManualInput(preset.value);
                      setRepoUrl("");
                    }}
                    className={cn(
                      "rounded-full border border-zinc-700 bg-zinc-800/40 px-2.5 py-1 text-xs text-zinc-400",
                      "transition-all duration-150 hover:border-zinc-500 hover:bg-zinc-700/60 hover:text-zinc-200 hover:scale-[1.03]",
                      manualInput === preset.value &&
                        "border-blue-500/50 bg-blue-500/10 text-blue-300"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <Textarea
                placeholder='{"name": "my-app", "dependencies": { ... }} or e.g. "Next.js, Tailwind, Prisma"'
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                rows={5}
                className="min-h-[120px] resize-y border-zinc-700 bg-zinc-800/50 font-mono text-sm placeholder:text-zinc-500 focus-visible:ring-white/20"
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="mt-2 h-11 bg-white text-black hover:bg-zinc-200"
            >
              {isGenerating ? "Generating…" : "Generate Rules"}
            </Button>
          </CardContent>
        </Card>

        {/* Terminal Integration */}
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="mb-2 flex items-center gap-2">
            <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 fill-current text-zinc-500" aria-hidden="true">
              <path d="M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 14.25 15H1.75A1.75 1.75 0 0 1 0 13.25Zm1.75-.25a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25ZM3.22 5.97a.75.75 0 0 1 1.06 0L6.53 8.22 4.28 10.47a.749.749 0 1 1-1.06-1.06l1.72-1.72-1.72-1.72a.75.75 0 0 1 0-1.06Zm3.53 4.28a.75.75 0 0 1 0-1.5h3a.75.75 0 0 1 0 1.5Z" />
            </svg>
            <span className="text-xs font-medium text-zinc-400">Terminal Integration</span>
          </div>
          <p className="mb-2 text-xs text-zinc-500">
            Generate and save <code className="font-mono text-zinc-400">.cursorrules</code> directly from your terminal — no browser needed.
          </p>
          <div className="group flex items-center justify-between gap-2 rounded-md border border-zinc-700/70 bg-black/40 px-3 py-2">
            <code className="flex-1 truncate font-mono text-xs text-zinc-300">
              <span className="select-none text-zinc-600">$ </span>
              {curlCommand}
            </code>
            <button
              type="button"
              onClick={handleCurlCopy}
              title="Copy command"
              className={cn(
                "shrink-0 rounded p-1 text-zinc-500 transition-colors",
                "hover:bg-zinc-700/60 hover:text-zinc-200",
                curlCopyStatus === "copied" && "text-green-400"
              )}
            >
              {curlCopyStatus === "copied" ? (
                <svg viewBox="0 0 16 16" className="size-3.5 fill-current" aria-hidden="true">
                  <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" className="size-3.5 fill-current" aria-hidden="true">
                  <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" /><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
                </svg>
              )}
            </button>
          </div>
          {curlRepoSlug === "<owner>/<repo>" && (
            <p className="mt-1.5 text-xs text-zinc-600">
              Type a GitHub URL above to get a personalised command.
            </p>
          )}
        </div>

        {/* Results: show when generation/refining has started or finished */}
        {(isGenerating || isRefining || generatedRules !== "") && (
          <Card
            className={cn(
              "mt-8 border-zinc-800 bg-zinc-900/50 shadow-none transition-shadow duration-300",
              "animate-in fade-in slide-in-from-bottom-4 duration-300",
              (isGenerating || isRefining) &&
                "border-blue-500/40 shadow-[0_0_20px_-5px_rgba(59,130,246,0.35)]"
            )}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-white">Generated .cursorrules</CardTitle>
              <CardDescription className="text-zinc-400">
                {isGenerating
                  ? "Streaming… Copy and download available when content is ready."
                  : isRefining
                  ? "Refining… applying your changes."
                  : "Copy or download to use in your project root."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div
                ref={codeContainerRef}
                className="relative max-h-[360px] overflow-auto rounded-lg border border-zinc-700 bg-[#1e1e1e]"
              >
                <SyntaxHighlighter
                  language="markdown"
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    padding: "1rem",
                    fontSize: "0.875rem",
                    lineHeight: 1.6,
                    background: "transparent",
                    minHeight: "4rem",
                  }}
                  codeTagProps={{ style: { fontFamily: "var(--font-geist-mono), monospace" } }}
                  showLineNumbers={false}
                  wrapLongLines
                >
                  {generatedRules || (isGenerating ? "…" : "")}
                </SyntaxHighlighter>
              </div>
              {generatedRules !== "" && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      className="border-zinc-600 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    >
                      {copyStatus === "copied" ? "Copied!" : "Copy to Clipboard"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownload}
                      className="border-zinc-600 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    >
                      Download .cursorrules
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCreateGist}
                      disabled={isCreatingGist}
                      className="border-zinc-600 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    >
                      {isCreatingGist ? (
                        <>
                          <svg
                            className="size-3.5 animate-spin"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                          >
                            <circle
                              className="opacity-25"
                              cx="12" cy="12" r="10"
                              stroke="currentColor" strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                            />
                          </svg>
                          Creating…
                        </>
                      ) : (
                        <>
                          <svg
                            viewBox="0 0 16 16"
                            className="size-3.5 fill-current"
                            aria-hidden="true"
                          >
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                          </svg>
                          Share via Gist
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Refine Rules */}
                  <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/30 p-4 space-y-3">
                    <p className="text-xs font-medium text-zinc-400">
                      Want to tweak these rules?
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder='e.g. "Add rule for using pnpm" or "Focus on performance"'
                        value={refineInput}
                        onChange={(e) => setRefineInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !isRefining) handleRefine();
                        }}
                        disabled={isRefining}
                        className="border-zinc-700 bg-zinc-800/50 placeholder:text-zinc-600 focus-visible:ring-white/20 text-sm"
                      />
                      <Button
                        onClick={handleRefine}
                        disabled={isRefining || !refineInput.trim()}
                        size="sm"
                        className="shrink-0 bg-white text-black hover:bg-zinc-200"
                      >
                        {isRefining ? "Refining…" : "Refine"}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Share badge — only after rules are generated */}
        {generatedRules !== "" && (
          <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 fill-current text-zinc-500" aria-hidden="true">
                  <path d="M2.678 11.894a1 1 0 0 1 .287.801 11 11 0 0 1-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 0 1 .71-.074A8 8 0 0 0 8 14c3.996 0 7-2.807 7-6s-3.004-6-7-6-7 2.808-7 6c0 1.468.617 2.83 1.678 3.894m-.493 3.905a22 22 0 0 1-.713.129c-.2.032-.352-.176-.273-.362a10 10 0 0 0 .244-.637l.003-.01c.248-.72.45-1.548.37-2.249a7 7 0 0 1-.232-.868C.054 10.48 0 9.76 0 9c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9 9 0 0 1-2.347-.306c-.52.263-1.639.742-3.468 1.105" />
                </svg>
                <span className="text-xs font-medium text-zinc-400">
                  Share / Add a badge to your README
                </span>
              </div>

              {/* Live badge preview */}
              <div className="flex items-center gap-3">
                <a
                  href={curlRepoSlug !== "<owner>/<repo>" ? badgeAppUrl : BASE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open CursorContext Architect"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={badgeImageUrl}
                    alt="Cursor Rules"
                    className="h-5"
                  />
                </a>
                <span className="text-xs text-zinc-600">← live preview</span>
              </div>

              {/* Markdown snippet + copy */}
              <div className="flex items-center justify-between gap-2 rounded-md border border-zinc-700/70 bg-black/40 px-3 py-2">
                <code className="flex-1 truncate font-mono text-xs text-zinc-300">
                  {badgeMarkdown}
                </code>
                <button
                  type="button"
                  onClick={handleBadgeCopy}
                  title="Copy Markdown"
                  className={cn(
                    "shrink-0 rounded p-1 text-zinc-500 transition-colors",
                    "hover:bg-zinc-700/60 hover:text-zinc-200",
                    badgeCopyStatus === "copied" && "text-green-400"
                  )}
                >
                  {badgeCopyStatus === "copied" ? (
                    <svg viewBox="0 0 16 16" className="size-3.5 fill-current" aria-hidden="true">
                      <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 16 16" className="size-3.5 fill-current" aria-hidden="true">
                      <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" /><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
                    </svg>
                  )}
                </button>
              </div>

              <p className="text-xs text-zinc-600">
                Paste this in your project&apos;s README so teammates can regenerate rules in one click.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
