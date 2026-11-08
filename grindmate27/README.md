# GrindMate 27 ⚽

رفيقك اليومي في EA FC 27 — صفحة ويب + بوت تليجرام + تحديث تلقائي.

## إيه فيه؟

| القسم | بيعمل إيه |
|---|---|
| **الأوبجكتيف** | كل الحملات الحية (زي RTTK: Group Stage) بالمهام والمود المطلوب والصعوبة والموعد — عدّاد حي + إشعار لما ينزل جديد أو قرب ينتهي |
| **التطويرات** | كل Evolutions الحية بالشروط والترقيات — واكتب تقييم لاعبك ومركزه يقترحلك أحسن تطويرة ليها |
| **السوق** | قائمة مراقبة للاعبين: يلم السعر يوميًا ويقولك "اشتري / بيع / تمسك" |
| **التسريبات** | آخر التسريبات من حسابات تويتر المشهورة |

## المعمارية (كله مجاني)

```
GitHub Actions (cron كل 4 ساعات)
  └─ scripts/futgg.mjs ── سحب من FUT.GG (SSR payload داخل sandbox vm بلا شبكة)
  ├─ يحدّث data/*.json ─── commit تلقائي
  ├─ يبعث تنبيهات تليجرام (أوبجكتيف جديد / قرب ينتهي / تسريبات)
Pages workflow ── ينشر grindmate27/ على GitHub Pages
```

## التشغيل أول مرة

1. **التليجرام:** افتح [@fc27rindMatebot](https://t.me/fc27rindMatebot) → Start.
2. **Chat ID:** شغّل محليًا:
   ```
   cd grindmate27/scripts
   TELEGRAM_BOT_TOKEN=<توكن البوت> node link-telegram.mjs
   ```
   هيطبع Chat ID. حطّه في:
   - `grindmate27/data/config.json` → `telegram.chatId`
   - GitHub → Settings → Secrets و variables → Actions:
     - Secret: `GRINDMATE_TG_TOKEN` = توكن البوت
     - Variable: `GRINDMATE_TG_CHAT` = ملف الـ Chat ID
3. **Pages:** Settings → Pages → Source = **GitHub Actions**.
4. شغّل من Actions يدوي: `grindmate-update` (workflow_dispatch) ثم `grindmate-pages`.

## ملفات البيانات

| الملف | محتواه |
|---|---|
| `data/objectives.json` | الأوبجكتيف + المهام + المود + الصعوبة + الموعد |
| `data/evolutions.json` | التطويرات + الشروط + مستويات الترقيات |
| `data/prices.json` | لقطات يومية لأسعار قائمة المراقبة |
| `data/leaks.json` | آخر التسريبات |
| `data/config.json` | إعدادات: chatId، حسابات التسريبات، قائمة مراقبة الأسعار |

## الأسعار في السوق

أضف رابط صفحة اللاعب على FUT.GG في `config.json`:
```json
"market": { "watchlist": [ { "name": "Ronaldo", "url": "https://www.fut.gg/players/37576-ronaldo/27-37576/" } ] }
```
السكريبت يلم السعر SSR اليومي ويبني للسعر صعود/هبوط.

## حدود معروفة

- أسعار بعض اللاعبين تظهر lazily على fut.gg — لو طلعت `null` هيتم تخطيها وجرّب تاني.
- تسريبات تويتر عبر Nitter — النسخ المتاحة بتكون مشغولة أحيانًا؛ السكرابر بيسلسل بين نسخ متعددة.
