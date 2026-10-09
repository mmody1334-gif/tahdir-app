# موقع «التحضير الآلي» (Cloudflare Worker + D1)

- `server/` — مصدر الموقع: `worker_src.js` (السيرفر)، `client_*.js` (الصفحات)، `tahdir-noor.user.js` (أداة نور)، `build_worker.py` (يبني ملفًا واحدًا).
- `data/` — `lessons.json` (التحاضير والواجبات)، `quiz_bank.json` (بنك أسئلة الاختبارات القصيرة)، `theme.json` (التصميم).
- `tests/` — `devserver.mjs` يشغّل الموقع محليًا مع قاعدة SQLite، و`e2e.cjs` و`quiz.cjs` اختبارات Playwright.

البناء: `python3 site/server/build_worker.py` ← `site/dist/worker.js`.

النشر تلقائي: أي push على `main` يغيّر `site/` يشغّل `.github/workflows/deploy-site.yml`، فيبني الملف ويرفعه على Cloudflare (يحتاج السر `CLOUDFLARE_API_TOKEN`)، ثم يتأكد أن `/version` في الموقع الحي يطابق آخر commit.
بدون السر: يُبنى الملف ويُحفظ كـ artifact باسم `worker-js` لرفعه يدويًا.
