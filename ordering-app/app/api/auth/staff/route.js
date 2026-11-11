import crypto from "crypto";
import { NextResponse } from "next/server";
import { attachSessionCookies, createSessionTokens } from "@/lib/edgeSession";
import { checkAuthRateLimit, extractClientIp } from "@/lib/serverRateLimit";
import { STAFF } from "@/lib/roles";
import { getTodayISTDateKey } from "@/lib/hubState";

export const dynamic = "force-dynamic";

// Authoritative Dark Store Warehouse Credentials (SHA-256 of "NAME|digitsOfDOB")
const SERVER_WAREHOUSE_USERS = [
  {
    h: "56f05a5c821c205cebb9afd2ac6e52d556d0bbffa2159ac389a296468b3ea8ce",
    name: "Deepu B",
    id: "deepu",
    roleCode: "ASM",
    storeId: "TIPTUR-HUB-KA44",
    areaId: "SOUTH-TUMKUR-AREA",
    allowedStoreIds: ["TIPTUR-HUB-KA44"],
  },
  {
    h: "3990c5fa93e1f413feee4f73014d338f86880bc8f6edcdf0243756383cfde492",
    name: "Bhaskar N S",
    id: "bhaskar",
    roleCode: "SM",
    storeId: "TIPTUR-HUB-KA44",
    areaId: "SOUTH-TUMKUR-AREA",
    allowedStoreIds: ["TIPTUR-HUB-KA44"],
  },
  {
    h: "5c01d7914c0a302e1c98a1f79d8292abc42fa7f00ed7bb37342aca39f93fb952",
    name: "A B Harshitha",
    id: "harshitha",
    roleCode: "MD",
    storeId: "TIPTUR-HUB-KA44",
    areaId: "SOUTH-TUMKUR-AREA",
    allowedStoreIds: ["TIPTUR-HUB-KA44"],
  },
];

const REGISTERED_STAFF_PHONES = {
  "8431453058": { id: "bhaskar", name: "Bhaskar N S", roleCode: "SM" },
  "6364150847": { id: "deepu", name: "Deepu B", roleCode: "ASM" },
  "8971720997": { id: "harshitha", name: "A B Harshitha", roleCode: "MD" },
  "6362435746": { id: "thrupthi", name: "Thrupthi K S", roleCode: "PICKER" },
  "8088553237": { id: "sinchana", name: "Sinchana B R", roleCode: "DELIVERY" },
};

export async function POST(req) {
  let body = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const clientIp = extractClientIp(req);
  const mode = String(body?.mode || "warehouse").trim().toLowerCase();

  const rl = await checkAuthRateLimit({
    scope: "staff_login",
    key: `${clientIp}:${mode}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: rl.message }, { status: 429 });
  }

  let matchedUser = null;

  if (mode === "warehouse") {
    const username = String(body?.username || "").trim().toUpperCase();
    const digitsPassword = String(body?.password || "").replace(/\D/g, "");
    const credHashInput = String(body?.credHash || "").trim().toLowerCase();

    let computedHash = credHashInput;
    if (username && digitsPassword) {
      computedHash = crypto
        .createHash("sha256")
        .update(`${username}|${digitsPassword}`)
        .digest("hex");
    }

    matchedUser = SERVER_WAREHOUSE_USERS.find((u) => u.h === computedHash) || null;
    if (!matchedUser) {
      return NextResponse.json(
        { error: "Invalid warehouse username or password." },
        { status: 401 }
      );
    }
  } else if (mode === "staff_otp" || mode === "phone_otp") {
    const phone = String(body?.phone || "").replace(/\D/g, "");
    const otp = String(body?.otp || "").trim();
    const reg = REGISTERED_STAFF_PHONES[phone];
    if (!reg) {
      return NextResponse.json(
        { error: "Mobile number is not registered for dark store staff." },
        { status: 403 }
      );
    }
    if (!otp || otp.length < 4) {
      return NextResponse.json({ error: "Valid verification OTP required." }, { status: 400 });
    }
    const requestedRole = String(body?.overrideRoleCode || "").trim().toUpperCase();
    const roleCode =
      phone === "6364150847" && ["SM", "ASM", "MD", "PICKER", "DELIVERY"].includes(requestedRole)
        ? requestedRole
        : reg.roleCode;

    matchedUser = {
      id: reg.id,
      name: reg.name,
      phone,
      roleCode,
      storeId: "TIPTUR-HUB-KA44",
      areaId: "SOUTH-TUMKUR-AREA",
      allowedStoreIds: ["TIPTUR-HUB-KA44"],
    };
  } else if (mode === "terminal_session") {
    // Allows Picker / Rider handhelds already signed into terminal UI to bind server HttpOnly session cleanly
    const staffId = String(body?.staffId || "").trim().toLowerCase();
    const foundStaff = STAFF.find(
      (s) => s.id === staffId && ["PICKER", "DELIVERY"].includes(s.roleCode)
    );
    if (!foundStaff) {
      return NextResponse.json({ error: "Invalid terminal staff identity." }, { status: 400 });
    }
    matchedUser = {
      id: foundStaff.id,
      name: foundStaff.name,
      phone: foundStaff.phone || "",
      roleCode: foundStaff.roleCode,
      storeId: "TIPTUR-HUB-KA44",
      areaId: "SOUTH-TUMKUR-AREA",
      allowedStoreIds: ["TIPTUR-HUB-KA44"],
    };
  } else {
    return NextResponse.json({ error: "Unsupported auth mode." }, { status: 400 });
  }

  const { accessToken, refreshToken } = await createSessionTokens({
    userId: `staff_${matchedUser.id}`,
    name: matchedUser.name,
    phone: matchedUser.phone || "",
    roleCode: matchedUser.roleCode,
    storeId: matchedUser.storeId,
    areaId: matchedUser.areaId,
    allowedStoreIds: matchedUser.allowedStoreIds,
  });

  const sessionObj = {
    id: matchedUser.id,
    name: matchedUser.name,
    roleCode: matchedUser.roleCode,
    storeId: matchedUser.storeId,
    areaId: matchedUser.areaId,
    allowedStoreIds: matchedUser.allowedStoreIds,
    authDate: getTodayISTDateKey(),
    loggedInAt: new Date().toISOString(),
  };

  const res = NextResponse.json({
    success: true,
    session: sessionObj,
  });
  attachSessionCookies(res, accessToken, refreshToken, req);
  return res;
}
