import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

export const revalidate = 60;

export async function GET() {
  try {
    // zrevrange with WITHSCORES returns [member, score, member, score, ...]
    const raw = await redis.zrevrange("trending_repos", 0, 4, "WITHSCORES");

    const results: { repo: string; count: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      results.push({ repo: raw[i], count: Number(raw[i + 1]) });
    }

    return NextResponse.json({ trending: results });
  } catch (err) {
    console.error("[api/trending]", err);
    return NextResponse.json({ trending: [] });
  }
}
