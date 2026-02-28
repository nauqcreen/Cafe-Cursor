import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

export const revalidate = 60;

export async function GET() {
  try {
    const redis = getRedis();
    if (!redis) return NextResponse.json({ trending: [] });

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
