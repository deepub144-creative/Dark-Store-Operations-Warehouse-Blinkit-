import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
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

  return NextResponse.json(
    {
      status: "ok",
      service: "auditx-hub",
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local-build",
      persistenceMode,
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
