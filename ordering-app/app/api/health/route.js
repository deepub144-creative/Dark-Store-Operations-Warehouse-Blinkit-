import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { loadAndReapState } from "@/lib/serverStateEngine";

export const dynamic = "force-dynamic";

export async function GET() {
  const t0 = performance.now();
  const state = await loadAndReapState();
  const latencyMs = Math.round((performance.now() - t0) * 100) / 100;

  const hasRedis = Boolean(
    (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
      (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)
  );
  const hasRtdb = Boolean(
    (process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL) &&
      !String(process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL).includes("demo")
  );
  const hasFirestore = Boolean(adminDb);
  const persistenceMode = hasFirestore
    ? "firestore"
    : hasRedis
    ? "redis"
    : hasRtdb
    ? "firebase-rtdb"
    : "memory";

  const mem = process.memoryUsage();
  const activeOrders = (state?.orders || []).filter(
    (o) => !["delivered", "cancelled"].includes(String(o.status || "").toLowerCase())
  ).length;

  return NextResponse.json(
    {
      status: "ok",
      health: latencyMs < 500 ? "healthy" : "degraded",
      service: "auditx-hub",
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "production",
      persistenceMode,
      latencyMs,
      activeOrders,
      totalOrdersStored: (state?.orders || []).length,
      uptimeSec: Math.round(process.uptime()),
      memory: {
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        rssMb: Math.round(mem.rss / 1024 / 1024),
      },
      envConfigured: {
        firestore: hasFirestore,
        redis: hasRedis,
        rtdb: hasRtdb,
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
