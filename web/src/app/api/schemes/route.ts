import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

function trimOrNull(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const q = trimOrNull(searchParams.get("q"));
  const state = trimOrNull(searchParams.get("state"));
  const level = trimOrNull(searchParams.get("level"));
  const benefitType = trimOrNull(searchParams.get("benefit_type"));

  let limit = 40;
  const limitRaw = searchParams.get("limit");
  if (limitRaw !== null) {
    const parsed = Number(limitRaw);
    if (!/^\d+$/.test(limitRaw) || parsed < 1 || parsed > 100) {
      return NextResponse.json(
        { error: "limit must be an integer from 1 to 100" },
        { status: 400 }
      );
    }
    limit = parsed;
  }

  const { data, error } = await getSupabase().rpc("search_schemes", {
    p_query: q,
    p_state: state,
    p_level: level,
    p_benefit_type: benefitType,
    p_limit: limit,
  });

  if (error) {
    console.error("search_schemes rpc failed:", error);
    return NextResponse.json(
      { error: "Search is temporarily unavailable" },
      { status: 500 }
    );
  }

  return NextResponse.json({ schemes: data ?? [] });
}
