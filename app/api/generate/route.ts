import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  parseGithubUrl,
  buildRepoPromptInput,
  buildAnthropicStream,
  probeAnthropic,
  trackRepo,
  SYSTEM_PROMPT,
  REFINE_SYSTEM_PROMPT,
} from "@/lib/repo-utils";

const STREAM_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
} as const;

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured." },
        { status: 500 }
      );
    }
    const anthropic = new Anthropic({ apiKey });

    // ── Refine mode ────────────────────────────────────────────────────────
    const existingRules =
      typeof body.existingRules === "string" ? body.existingRules.trim() : undefined;
    const refinementPrompt =
      typeof body.refinementPrompt === "string" ? body.refinementPrompt.trim() : undefined;

    if (existingRules && refinementPrompt) {
      const probe = await probeAnthropic(anthropic);
      if (probe) return NextResponse.json({ error: probe.message }, { status: probe.status });
      const userContent = `Here are the current .cursorrules:\n\n${existingRules}\n\nThe user requested this change: ${refinementPrompt}`;
      const stream = buildAnthropicStream(anthropic, REFINE_SYSTEM_PROMPT, userContent);
      return new Response(stream, { headers: STREAM_HEADERS });
    }

    // ── Generate mode ──────────────────────────────────────────────────────
    const githubUrl = typeof body.githubUrl === "string" ? body.githubUrl.trim() : undefined;
    const manualStack = typeof body.manualStack === "string" ? body.manualStack.trim() : undefined;

    if (!githubUrl && !manualStack) {
      return NextResponse.json(
        { error: "Either githubUrl or manualStack is required." },
        { status: 400 }
      );
    }

    let promptInput: string;

    if (manualStack) {
      promptInput = manualStack;
    } else if (githubUrl) {
      const parsed = parseGithubUrl(githubUrl);
      if (!parsed) {
        return NextResponse.json({ error: "Invalid GitHub URL." }, { status: 400 });
      }
      promptInput = await buildRepoPromptInput(parsed.owner, parsed.repo);
      trackRepo(`${parsed.owner}/${parsed.repo}`);
    } else {
      return NextResponse.json(
        { error: "Either githubUrl or manualStack is required." },
        { status: 400 }
      );
    }

    const probe = await probeAnthropic(anthropic);
    if (probe) return NextResponse.json({ error: probe.message }, { status: probe.status });
    const stream = buildAnthropicStream(anthropic, SYSTEM_PROMPT, promptInput);
    return new Response(stream, { headers: STREAM_HEADERS });
  } catch (err) {
    console.error("[api/generate]", err);
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
