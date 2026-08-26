<<<<<<< HEAD
# AuditX — Dark Store Warehouse Operations (Demo)

Two connected apps built with Next.js + Firebase, deployable free on Vercel:

1. **`warehouse-app`** — internal app for your 4-5 team members: OTP login,
   role-based task list (Picker, Packer, Mover, Putaway, FNV, Audit, Exp Audit,
   Inventory Audit), camera barcode scanning, and a real-time manager dashboard.
2. **`ordering-app`** — public app for your friends (~60 users) to place mock
   orders and watch them move through the warehouse pipeline live.

Both apps share **one Firebase project** (Firestore as the real-time database).
When an order is placed in `ordering-app`, it becomes visible and assignable
inside `warehouse-app` in real time.

---

## 1. Create your Firebase project (free Spark plan — no billing needed)

1. Go to https://console.firebase.google.com → **Add project** → name it
   `auditx-darkstore` (or anything) → disable Google Analytics (not needed) → Create.
2. In the project, go to **Build → Firestore Database → Create database** →
   start in **production mode** → pick a nearby region (e.g. `asia-south1`) → Enable.
3. Go to **Project settings (gear icon) → General → Your apps → Web (</>)** →
   register an app (nickname: `auditx-web`) → copy the `firebaseConfig` values.
   These go into `NEXT_PUBLIC_FIREBASE_*` in both apps' env vars.
4. Go to **Project settings → Service accounts → Generate new private key** →
   this downloads a JSON file. From it you need:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep the `\n` characters as-is,
     wrap the whole value in quotes when pasting into Vercel)
5. Go to **Firestore Database → Rules** and paste the contents of
   `firestore.rules` (in this repo root) → Publish.

---

## 2. Configure staff (edit before deploying)

Open `warehouse-app/lib/roles.js` and edit the `STAFF` array with your real
team members, their phone numbers (used for OTP login), and role codes:

```js
export const STAFF = [
  { id: "bhaskar", name: "Bhaskar N S", phone: "9000000001", roles: [ROLES.MANAGER] },
  { id: "deepu", name: "Deepu B", phone: "9000000002", roles: [ROLES.PICKER, ROLES.AUDIT, ROLES.INVENTORY_AUDIT] },
  // ...
];
```

**Note on OTP:** this demo generates a 6-digit OTP and shows it directly on
the login screen (no SMS gateway is wired up, since that needs a paid
service). For your live demo, that's fine — just tell your team "the OTP
shows on screen instead of SMS." If you want real SMS later, swap the logic
in `warehouse-app/app/api/auth/send-otp/route.js` for a provider like
Fast2SMS or Twilio.

---

## 3. Edit the product catalog / barcodes (optional)

Open `ordering-app/lib/items.js` to change the mock items, prices, or zones.
The `barcode` field for each item **must exactly match** the barcode you
print and stick on that item — see `barcode-assets/` for ready-made,
scannable Code128 barcode images for the default catalog
(`item_barcode_sheet.png` is a single printable sheet with all 10).

If you change the catalog, regenerate barcodes:
```bash
cd barcode-assets
pip install python-barcode[images] --break-system-packages
python3 generate_item_barcodes.py
```

---

## 4. Run locally to test

```bash
cd warehouse-app
cp .env.example .env.local   # fill in your Firebase values
npm install
npm run dev                  # runs on http://localhost:3000

cd ../ordering-app
cp .env.example .env.local   # same Firebase values
npm install
npm run dev -- -p 3001       # runs on http://localhost:3001
```

Place a test order on `localhost:3001`, then log in as a staff member on
`localhost:3000/login` (use a phone number from `roles.js`) to see it appear
as a task.

---

## 5. Deploy both apps to Vercel (free)

1. Push this whole folder to a GitHub repo (or two separate repos — one per app).
2. Go to https://vercel.com → **Add New Project** → import the repo.
   - **Root Directory:** set to `warehouse-app` for the first import.
   - Add all env vars from `.env.example` under **Settings → Environment Variables**
     (paste the real values from your Firebase project).
   - Deploy.
3. Repeat: **Add New Project** again, same repo, but set **Root Directory** to
   `ordering-app`, add the same env vars, deploy.
4. You'll now have two live URLs:
   - `https://auditx-warehouse.vercel.app` → share with your 4-5 team members.
   - `https://auditx-store.vercel.app` → share with your 60 friends.

Both free-tier Vercel + Firebase Spark plan comfortably handle a college demo
with dozens of concurrent users — no payment needed anywhere in this stack.

---

## How the flow works (matches your operations plan)

```
Friend places order (ordering-app)
        ↓
Order saved in Firestore: stage = Putaway, status = PENDING_ASSIGN
        ↓
warehouse-app polls /api/assign-task every 5s → randomly assigns
a staff member whose role matches the current stage
        ↓
Assigned staff sees the task on their /tasks page (real-time)
        ↓
Staff scans the item's barcode with their phone camera
        ↓
/api/scan validates the code → marks item scanned
        ↓
Once all items in the order are scanned → stage advances
(Putaway → Picking → Item Audit → Packing → Dispatch)
and a NEW random staff member matching the next stage is assigned
        ↓
Manager dashboard (warehouse-app /dashboard) shows all of this live:
order counts, current stage per order, who's assigned, who's online
        ↓
Friend's tracking page (ordering-app /track/[id]) shows the same
progress in real time from their side
```

---

## Project structure

```
auditx-project/
├── warehouse-app/          # internal team app (Vercel project #1)
│   ├── app/
│   │   ├── login/          # OTP login
│   │   ├── dashboard/      # manager real-time view
│   │   ├── tasks/          # staff task list + barcode scan
│   │   └── api/            # send-otp, verify-otp, assign-task, scan
│   └── lib/                # firebase config + roles.js (EDIT THIS)
├── ordering-app/           # public friends-facing app (Vercel project #2)
│   ├── app/
│   │   ├── page.js         # catalog + place order
│   │   ├── track/[id]/     # live order tracking
│   │   └── api/place-order/
│   └── lib/                # firebase config + items.js (EDIT THIS)
├── barcode-assets/         # printable static barcodes for your mock items
├── firestore.rules
└── README.md               # you are here
```
=======
# Dark-Store-Operations-Warehouse-Blinkit-
>>>>>>> 4ff5b90bbb01d3ccad53b39ae70bbc5c9e937e5a
