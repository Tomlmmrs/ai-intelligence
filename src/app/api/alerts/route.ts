import { NextRequest, NextResponse } from "next/server";
import { getAlerts, getUnreadAlertCount, markAlertRead } from "@/lib/db/queries";

export async function GET(request: NextRequest) {
  const unreadOnly = request.nextUrl.searchParams.get("unread") === "true";
  try {
    const [alertList, unreadCount] = await Promise.all([
      getAlerts(unreadOnly),
      getUnreadAlertCount(),
    ]);
    return NextResponse.json({ alerts: alertList, unreadCount });
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id } = await request.json();
    await markAlertRead(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating alert:", error);
    return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
  }
}
