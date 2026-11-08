// GrindMate 27 — link your Telegram chat.
// 1) Press Start on @fc27rindMatebot first, 2) run:  node link-telegram.mjs
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const BASE = `https://api.telegram.org/bot${TOKEN}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function upd(offset = 0) {
  const res = await fetch(`${BASE}/getUpdates?offset=${offset}&timeout=25`);
  const json = await res.json();
  return json.result || [];
}

if (!TOKEN) {
  console.log('Usage: TELEGRAM_BOT_TOKEN=<token> node link-telegram.mjs');
  console.log('(On Actions/local it reads the env var; never hardcode the token.)');
  process.exit(1);
}

console.log('Awaiting a message from you on @fc27rindMatebot… (open Telegram, press Start / send any message)');
const before = new Set((await upd()).map(u => u.update_id));
let found = null;
const deadline = Date.now() + 120000;
while (Date.now() < deadline && !found) {
  for (const u of await upd(0)) {
    if (before.has(u.update_id)) continue;
    const chat = u.message?.chat || u.my_chat_member?.chat || u.edited_message?.chat;
    if (chat) { found = chat; break; }
  }
  if (!found) await sleep(2000);
}
if (!found) { console.log('لم تصل رسالة. افتح البوت واضغط Start ثم أعد المحاولة.'); process.exit(1); }
console.log('\n✅ Chat found!');
console.log('Chat ID :', found.id);
console.log('Name    :', found.first_name || found.title, found.username ? `(@${found.username})` : '');
console.log('\nضيف الرقم في grindmate27/data/config.json:');
console.log(`  "telegram": { "chatId": "${found.id}" }`);
console.log('وفي GitHub: repo → Settings → Secrets and variables → Actions');
console.log(`  secrets   : GRINDMATE_TG_TOKEN = <توكن البوت>`);
console.log(`  variables : GRINDMATE_TG_CHAT = ${found.id}`);
// Set bot commands so the menu is ready
await fetch(`${BASE}/setMyCommands`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    commands: [
      { command: 'start', description: 'تبدأ + لينك الصفحة' },
      { command: 'objectives', description: 'الأوبجكتيف الحي والقريبة الانتهاء' },
      { command: 'evos', description: 'التطويرات الواقفة قريب' },
      { command: 'leaks', description: 'آخر التسريبات' }
    ]
  })
});
console.log('\nBot menu commands set ✅');
