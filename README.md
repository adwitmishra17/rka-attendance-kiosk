# RKA Attendance Kiosk

The kiosk PWA that runs on the wall-mounted Galaxy Tab A7. Teachers tap, look at the camera, and attendance is recorded automatically via face recognition.

## Build status

This is **Phase 1 — Foundation**. Currently:
- ✅ Idle screen with live clock
- ✅ Tap to mark attendance → opens camera
- ✅ Camera permission flow with error handling
- ✅ Live camera preview (front camera, mirrored)
- ⏳ Face detection (Phase 2)
- ⏳ Face recognition + matching (Phase 4)
- ⏳ Punch recording to Supabase (Phase 4)
- ⏳ Offline queue (Phase 5)
- ⏳ PIN fallback (Phase 5)

## Local development

```bash
npm install
npm run dev
```

Then open http://localhost:5174 (uses port 5174 so the admin app on 5173 can run alongside).

## Testing on the tablet

The dev server runs with `--host` so other devices on the same WiFi can access it:

```bash
npm run dev
```

Look for the "Network:" URL in the output (e.g. `http://192.168.1.20:5174`). Open that URL on the tablet's Chrome.

For camera access on the tablet, you'll need HTTPS (browsers block camera over plain HTTP except on localhost). Use the deployed Vercel URL instead for tablet testing.

## Deployment

Auto-deploys to Vercel on every push to `main`.

## Env variables

See `.env.example`.

## Database

Connects to the same Supabase project as the admin app — `rka-attendance` at `yegxwxutdalmdubrozrm.supabase.co`. Reads employees and embeddings, writes attendance events. All writes use the public anon key with RLS-restricted policies.
