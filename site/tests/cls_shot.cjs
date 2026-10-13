const { chromium } = require('playwright');
async function pickC(p, sel, key) { const s = key.split('|')[0]; if (await p.isVisible(sel + 'Subj')) { if (await p.inputValue(sel + 'Subj') !== s) { await p.selectOption(sel + 'Subj', s); await p.waitForTimeout(700); } } if (await p.inputValue(sel) !== key) { await p.selectOption(sel, key); await p.waitForTimeout(700); } }
const B='http://localhost:8787';
(async()=>{const b=await chromium.launch();const c=await b.newContext({viewport:{width:1300,height:900}});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(B+'/');await p.fill('#username','mohamed');await p.fill('#password','Bio@2026x');await p.fill('#password2','Bio@2026x');await p.click('#setupForm button[type=submit]');
await p.waitForURL(B+'/');await p.fill('#username','mohamed');await p.fill('#password','Bio@2026x');await p.click('#loginBtn');await p.waitForURL(B+'/admin');
await p.goto(B+'/remedial');await p.waitForSelector('#courseSel');await pickC(p,'#courseSel','الأحياء|العاشر');await p.waitForSelector('[data-lid]');await p.check('[data-lid]:not([disabled]) >> nth=1');await p.click('#makeBtn');await p.waitForSelector('#stTbl');
await p.click('[data-part="cls"]');await p.waitForTimeout(800);await p.screenshot({path:'/tmp/claude-0/-home-claude-tahdir-app/0c317531-7d49-5838-9e9a-1ef869cbd305/scratchpad/brand/shots/cls.png'});
await p.click('[data-part="clskey"]');await p.waitForTimeout(500);await p.screenshot({path:'/tmp/claude-0/-home-claude-tahdir-app/0c317531-7d49-5838-9e9a-1ef869cbd305/scratchpad/brand/shots/clskey.png'});
console.log('errors',errs);await b.close();})();
