import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const content =
      typeof body.content === "string" ? body.content.trim() : undefined;
    const repoName =
      typeof body.repoName === "string" ? body.repoName.trim() : "your project";

    if (!content) {
      return NextResponse.json(
        { error: "content is required." },
        { status: 400 }
      );
    }

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "GITHUB_TOKEN is not configured on the server." },
        { status: 500 }
      );
    }

    const gistRes = await fetch("https://api.github.com/gists", {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "CursorContext-Architect",
      },
      body: JSON.stringify({
        description: `Cursor rules for ${repoName}`,
        public: true,
        files: {
          ".cursorrules": { content },
        },
      }),
    });

    if (!gistRes.ok) {
      const errBody = await gistRes.json().catch(() => ({}));
      const message =
        (errBody as { message?: string }).message ??
        `GitHub API error: ${gistRes.status}`;
      return NextResponse.json({ error: message }, { status: gistRes.status });
    }

    const gist = (await gistRes.json()) as { html_url: string };
    return NextResponse.json({ url: gist.html_url });
  } catch (err) {
    console.error("[api/gist]", err);
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
