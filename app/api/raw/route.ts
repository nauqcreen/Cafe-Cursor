import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  parseRepoParam,
  buildRepoPromptInput,
  buildAnthropicStream,
  trackRepo,
  SYSTEM_PROMPT,
} from "@/lib/repo-utils";

/**
 * GET /api/raw?repo=owner/repo
 *
 * CLI usage:
 *   curl -sL "https://cafe-cursor-sepia.vercel.app/api/raw?repo=shadcn-ui/ui" > .cursorrules
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const repoParam = searchParams.get("repo") ?? "";

  const parsed = parseRepoParam(repoParam);
  if (!parsed) {
    return new Response(
      "Error: ?repo parameter is required (e.g. ?repo=owner/repo or a full GitHub URL)\n",
      { status: 400, headers: { "Content-Type": "text/plain" } }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response("Error: ANTHROPIC_API_KEY is not configured on the server.\n", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }

  try {
    const promptInput = await buildRepoPromptInput(parsed.owner, parsed.repo);
    trackRepo(`${parsed.owner}/${parsed.repo}`);
    const anthropic = new Anthropic({ apiKey });
    const stream = buildAnthropicStream(anthropic, SYSTEM_PROMPT, promptInput);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `inline; filename=".cursorrules"`,
      },
    });
  } catch (err) {
    console.error("[api/raw]", err);
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
