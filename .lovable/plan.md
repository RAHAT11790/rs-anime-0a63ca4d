
লক্ষ্য: push token registration stable করা, duplicate/old token কমানো, আর send করার সময় random fail যতটা সম্ভব কমিয়ে আনা—যাতে “token হচ্ছে না / extra token হচ্ছে / ৫টা fail” সমস্যা practically বন্ধ হয়।

1) Root cause summary (কোড দেখে)
- token প্রতি বার `fcmTokens/{userId}/{tokenKey}` এ save হচ্ছে; token rotate হলে পুরনো token পড়ে থাকে।
- পুরনো/invalid token গুলো সবসময় সাথে সাথে clean হচ্ছে না; send সময় fail count বাড়ে।
- server-side send ফাংশনে অনেক high concurrency (120) দিয়ে per-token call হচ্ছে; transient FCM error এ retry নেই, তাই কিছু fail থেকে যায়।
- UI-তে failure reason detail কম, তাই বোঝা যায় না fail invalid token নাকি temporary network/quota।

2) Implementation plan (no DB schema change)
- `src/lib/fcm.ts` এ token registration harden করব:
  - stable `deviceId` (localStorage) introduce করে token entry-তে `deviceId`, `origin`, `updatedAt` রাখব।
  - same device-এর old token auto-replace/cleanup করব।
  - per-user max token cap (যেমন 3) রাখব; oldest token prune করব।
  - permission granted থাকলে silent refresh; denied হলে state sync করব (already আছে, আরও consistent করব)।
- `supabase/functions/send-fcm/index.ts` এ delivery reliability উন্নত করব:
  - concurrency 120 → safer level (যেমন 25-40)।
  - transient errors (`UNAVAILABLE`, `INTERNAL`, `RESOURCE_EXHAUSTED`) এ per-token retry + backoff।
  - invalid token detect logic JSON error থেকে robust parse করব।
  - response-এ `failReasons` summary দেব (invalid/transient/other)।
- `src/pages/Admin.tsx` এ better progress/result messaging:
  - total target users, resolved tokens, success/fail reason breakdown দেখাব।
  - invalid removed হলে clearly দেখাব যাতে একই invalid token বারবার fail না দেখায়।
- `src/components/ProfilePage.tsx` এর Push Debug Info আরও useful করব:
  - current user token count, last token time, current origin token status দেখাব।
  - “force re-register” শেষে cleanup result দেখাব।

3) Expected behavior after fix
- এক ইউজারের জন্য অপ্রয়োজনীয় token duplication কমে যাবে।
- পুরনো token clean হওয়ায় fail count দ্রুত নেমে আসবে।
- temporary FCM-side ব্যর্থতাও retry হওয়ার কারণে success ratio বাড়বে।
- admin panel-এ clear বোঝা যাবে fail কেন হয়েছে (invalid বনাম transient)।

4) Validation checklist (end-to-end)
- main site-এ 2–3টি আলাদা user/device দিয়ে Push ON → token save verify।
- admin থেকে notification send → success/fail + reason breakdown verify।
- same user-এ re-register করলে token count uncontrolled বাড়ছে কিনা verify।
- repeat send-এ invalid cleanup কাজ করে fail কমছে কিনা verify।
- preview + published origin mixed অবস্থায় duplicate/old token cleanup ঠিক আছে কিনা verify।

5) Technical notes
- কোনো table migration লাগবে না (Realtime DB data shape compatible থাকবে)।
- existing Firebase paths (`users`, `fcmTokens`, `notifications`) unchanged রাখব।
- backward compatibility: old token entries থাকলেও নতুন cleanup logic safe ভাবে কাজ করবে।
