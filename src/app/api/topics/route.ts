import { NextResponse } from "next/server";
import {
  getDashboardStats,
  getActiveSignals,
  getTrendingClusters,
  getTopEntities,
  getCompanies,
} from "@/lib/db/queries";

export async function GET() {
  try {
    const [stats, signals, trending, topEntities, companies] = await Promise.all([
      getDashboardStats(),
      getActiveSignals(),
      getTrendingClusters(),
      getTopEntities(undefined, 15),
      getCompanies(),
    ]);

    return NextResponse.json({
      stats,
      signals,
      trending,
      topEntities,
      companies,
    });
  } catch (error) {
    console.error("Error fetching topics:", error);
    return NextResponse.json({ error: "Failed to fetch topics" }, { status: 500 });
  }
}
