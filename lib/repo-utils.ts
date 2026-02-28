import Anthropic from "@anthropic-ai/sdk";
import { getRedis } from "@/lib/redis";

/**
 * Increment the trending score for a repo slug (owner/repo).
 * Fire-and-forget — no-ops silently if REDIS_URL is not configured.
 */
export function trackRepo(slug: string): void {
  if (!slug) return;
  getRedis()
    ?.zincrby("trending_repos", 1, slug)
    .catch(() => {});
}

// ── Prompts ──────────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are a Senior Architect at Cursor.sh. Analyze the provided Tech Stack AND the README description to create a masterpiece .cursorrules file. Include: Project structure rules, specific naming conventions for the detected frameworks, and common pitfalls to avoid for this specific stack. Return ONLY the content of the .cursorrules file, nothing else, no markdown formatting blocks like \`\`\`text.`;

export const REFINE_SYSTEM_PROMPT = `You are an expert Architect. You will be given an existing .cursorrules file and a refinement request. Rewrite and stream the complete updated .cursorrules incorporating the requested change. Return ONLY the rules, nothing else, no markdown formatting blocks like \`\`\`text.`;

// ── Types ────────────────────────────────────────────────────────────────────

export type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  name?: string;
  [key: string]: unknown;
};

type GithubContentEntry = {
  name: string;
  type: "file" | "dir" | "symlink" | "submodule";
};

// ── Constants ────────────────────────────────────────────────────────────────

export const BRANCHES = ["main", "master"] as const;
export const README_MAX_LENGTH = 2000;

// ── URL parsing ──────────────────────────────────────────────────────────────

export function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url);
    if (!["github.com", "www.github.com"].includes(parsed.hostname)) return null;
    const parts = parsed.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const [owner, repo] = parts;
    return { owner, repo: repo.replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

/** Accepts "owner/repo" shorthand or a full GitHub URL. */
export function parseRepoParam(value: string): { owner: string; repo: string } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  // "owner/repo" shorthand
  if (!trimmed.includes("://")) {
    const parts = trimmed.split("/").filter(Boolean);
    if (parts.length >= 2) return { owner: parts[0], repo: parts[1].replace(/\.git$/, "") };
    return null;
  }
  return parseGithubUrl(trimmed);
}

// ── Fetchers ─────────────────────────────────────────────────────────────────

export async function fetchFromRepo(
  owner: string,
  repo: string,
  path: string
): Promise<string | null> {
  for (const branch of BRANCHES) {
    const url = `https://fastly.jsdelivr.net/gh/${owner}/${repo}@${branch}/${path}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) return await res.text();
    } catch {
      // try next branch
    }
  }
  return null;
}

export async function fetchPackageJson(owner: string, repo: string): Promise<PackageJson | null> {
  for (const branch of BRANCHES) {
    const url = `https://fastly.jsdelivr.net/gh/${owner}/${repo}@${branch}/package.json`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) return (await res.json()) as PackageJson;
    } catch {
      // try next branch
    }
  }
  return null;
}

export async function fetchRepoTree(owner: string, repo: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "CursorContext-Architect",
      },
    });
    if (res.status === 403 || res.status === 404 || !res.ok) return null;
    const entries = (await res.json()) as GithubContentEntry[];
    if (!Array.isArray(entries)) return null;
    return entries
      .sort((a, b) => {
        if (a.type === "dir" && b.type !== "dir") return -1;
        if (a.type !== "dir" && b.type === "dir") return 1;
        return a.name.localeCompare(b.name);
      })
      .map((e) => (e.type === "dir" ? `${e.name}/` : e.name))
      .join("\n");
  } catch {
    return null;
  }
}

// ── Prompt builder ───────────────────────────────────────────────────────────

export function truncateReadme(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength) + "\n\n[... truncated]";
}

export function techStackFromPackageJson(pkg: PackageJson): string {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const names = Object.keys(deps).sort();
  const lines = names.map((name) => `- ${name}: ${deps[name]}`);
  const header = pkg.name ? `Project: ${pkg.name}\n` : "";
  return header + lines.join("\n");
}

export async function buildRepoPromptInput(owner: string, repo: string): Promise<string> {
  const [pkg, readmeRaw, treeRaw] = await Promise.all([
    fetchPackageJson(owner, repo),
    fetchFromRepo(owner, repo, "README.md"),
    fetchRepoTree(owner, repo),
  ]);

  const techStack = pkg
    ? techStackFromPackageJson(pkg)
    : `Repository: ${owner}/${repo} (no package.json found — infer stack from README and directory structure)`;

  const treeSection =
    treeRaw && treeRaw.trim().length > 0 ? `\n\nRoot directory structure:\n${treeRaw}` : "";
  const readmeSection =
    readmeRaw && readmeRaw.trim().length > 0
      ? `\n\nREADME description:\n${truncateReadme(readmeRaw, README_MAX_LENGTH)}`
      : "";
  return `Tech stack:\n${techStack}${treeSection}${readmeSection}`;
}

// ── Anthropic streaming ───────────────────────────────────────────────────────

const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";


export function buildAnthropicStream(
  anthropic: Anthropic,
  systemPrompt: string,
  userContent: string
): ReadableStream {
  const encoder = new TextEncoder();
  const ERROR_MESSAGES: Record<number | string, string> = {
    400: "Anthropic API báo lỗi 400 — có thể tài khoản hết credits. Kiểm tra tại console.anthropic.com/billing.",
    403: "Anthropic API không khả dụng từ khu vực của bạn (403). Thử VPN hoặc chạy từ vùng được hỗ trợ.",
    ENOTFOUND: "Không thể kết nối đến api.anthropic.com. Kiểm tra mạng hoặc DNS (thử đổi sang 8.8.8.8 / 1.1.1.1).",
    TIMEOUT: "Request đến Anthropic bị timeout (>15s). Kiểm tra kết nối mạng.",
  };

  return new ReadableStream({
    async start(controller) {
      let closed = false;
      const sendError = (msg: string) => {
        if (closed) return;
        closed = true;
        try {
          controller.enqueue(encoder.encode(JSON.stringify({ error: msg }) + "\n"));
          controller.close();
        } catch {
          controller.error(new Error(msg));
        }
      };
      const finish = (err?: Error) => {
        if (closed) return;
        if (!err) { closed = true; try { controller.close(); } catch { /* noop */ } return; }
        const status = typeof (err as { status?: number }).status === "number" ? (err as { status: number }).status : 0;
        const code = (err as { code?: string }).code ?? "";
        if (status === 400) return sendError(ERROR_MESSAGES[400]);
        if (status === 403) return sendError(ERROR_MESSAGES[403]);
        if (code === "ENOTFOUND") return sendError(ERROR_MESSAGES.ENOTFOUND);
        if (err.name === "AbortError") return sendError(ERROR_MESSAGES.TIMEOUT);
        closed = true;
        controller.error(err);
      };

      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 15_000);

      try {
        const messageStream = anthropic.messages.stream(
          {
            model: ANTHROPIC_MODEL,
            max_tokens: 8192,
            system: systemPrompt,
            messages: [{ role: "user", content: userContent }],
          },
          { signal: abort.signal }
        );
        messageStream.on("text", (delta) => {
          if (delta) controller.enqueue(encoder.encode(delta));
        });
        messageStream.once("end", () => { clearTimeout(timer); finish(); });
        messageStream.on("error", (err) => {
          clearTimeout(timer);
          console.error("[anthropic stream]", err);
          finish(err as Error & { status?: number });
        });
        await messageStream.done();
        clearTimeout(timer);
        finish();
      } catch (err) {
        clearTimeout(timer);
        console.error("[anthropic stream]", err);
        const e = err instanceof Error ? err : new Error(String(err));
        finish(e as Error & { status?: number });
      }
    },
  });
}
