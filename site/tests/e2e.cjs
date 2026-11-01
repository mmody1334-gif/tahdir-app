const { chromium } = require('playwright');
const B='http://localhost:8787';
(async()=>{
  const b=await chromium.launch(); const errs=[];
  const mk=async(o={})=>{const c=await b.newContext({viewport:{width:1280,height:900},permissions:['clipboard-read','clipboard-write'],...o});const p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/fonts\.g/.test(m.text()))errs.push(m.text())});return [c,p];};
  // 1 setup
  let [ac,ap]=await mk(); await ap.goto(B+'/'); console.log('first url', ap.url());
  await ap.fill('#username','mohamed'); await ap.fill('#password','Bio@2026x'); await ap.fill('#password2','Bio@2026x'); await ap.click('#setupForm button[type=submit]');
  await ap.waitForURL(B+'/'); await ap.screenshot({path:'s_login.png'});
  // 2 admin login
  await ap.fill('#username','mohamed'); await ap.fill('#password','Bio@2026x'); await ap.click('#loginBtn'); await ap.waitForURL(B+'/admin');
  await ap.waitForSelector('.kpis'); 
  await ap.click('#addBtn'); await ap.fill('#mText','أحمد البلوشي، ahmed.b، 123456\nسالم الهنائي، salim\nخطأ، a b'); await ap.click('#mOk');
  await ap.waitForSelector('#mText[readonly]'); console.log('import result:\n'+await ap.inputValue('#mText')); await ap.click('#mCancel');
  // 3 teacher device 1
  let [c1,p1]=await mk(); await p1.goto(B+'/'); await p1.fill('#username','ahmed.b'); await p1.fill('#password','123456'); await p1.click('#loginBtn'); await p1.waitForURL(B+'/app');
  await p1.waitForSelector('[data-home="prep"]'); await p1.click('[data-home="prep"]'); await p1.waitForSelector('.g-btn'); await p1.click('.g-btn'); await p1.click('.u-btn'); await p1.click('.l-item');
  await p1.click('#copyJsonBtn'); await p1.waitForTimeout(500);
  console.log('copy JSON action available:', await p1.$('#copyJsonBtn')!==null);
  await p1.click('#homeBackBtn'); await p1.click('[data-home="homework"]'); await p1.waitForSelector('#hwLesson');
  const emptyPickers=await p1.evaluate(()=>['#hwSubject','#hwGrade','#hwUnit','#hwLesson'].map(s=>document.querySelector(s).value));
  if(emptyPickers.some(Boolean)) throw new Error('homework selectors must not auto-select a course or first lesson');
  const subject=await p1.locator('#hwSubject option').nth(1).getAttribute('value'); await p1.selectOption('#hwSubject',subject);
  const grade=await p1.locator('#hwGrade option').nth(1).getAttribute('value'); await p1.selectOption('#hwGrade',grade);
  const unit=await p1.locator('#hwUnit option').nth(1).getAttribute('value'); await p1.selectOption('#hwUnit',unit);
  const lesson=await p1.locator('#hwLesson option').nth(1).getAttribute('value'); await p1.selectOption('#hwLesson',lesson);
  await p1.waitForSelector('#homeworkEditor [data-hw-item]'); await p1.screenshot({path:'s_hw.png',fullPage:true});
  console.log('homework section:', await p1.textContent('#hwScoreState'), 'selected lesson:', await p1.textContent('#homeworkEditor h2'));
  await p1.click('#hwCopyText'); await p1.waitForTimeout(300);
  console.log('homework copy action available:', await p1.$('#hwCopyText')!==null);
  // حفظ محلي للواجب مرتبط بالدرس المحدد واستعادته بعد إعادة التحميل
  const draftText='سؤال اختبار لحفظ واجب هذا الدرس';await p1.locator('[data-hw-text]').first().fill(draftText);await p1.locator('[data-hw-mark]').first().fill('1');await p1.click('#hwSave');await p1.waitForTimeout(300);await p1.reload();await p1.waitForSelector('[data-home="homework"]');await p1.click('[data-home="homework"]');await p1.waitForSelector('#hwSubject');await p1.selectOption('#hwSubject',subject);await p1.selectOption('#hwGrade',grade);await p1.selectOption('#hwUnit',unit);await p1.selectOption('#hwLesson',lesson);await p1.waitForSelector('#homeworkEditor [data-hw-item]');
  const savedDraft=await p1.locator('[data-hw-text]').first().inputValue();if(savedDraft!==draftText)throw new Error('homework draft was not restored for the selected lesson: '+savedDraft);console.log('homework draft persisted per selected lesson:',savedDraft);
  // security checks as teacher
  console.log('teacher->admin api:', (await p1.evaluate(()=>fetch('/api/admin/stats').then(r=>r.status))));
  console.log('teacher->/admin goes to:', (await (await c1.request.get(B+'/admin',{maxRedirects:0})).headers().location));
  // 4 device 2
  let [c2,p2]=await mk({userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36',viewport:{width:400,height:850}});
  await p2.goto(B+'/'); await p2.screenshot({path:'s_login_mobile.png',fullPage:true});
  await p2.fill('#username','ahmed.b'); await p2.fill('#password','123456'); await p2.click('#loginBtn'); await p2.waitForURL(B+'/app'); console.log('device 2 ok');
  // 5 device 3 blocked
  let [c3,p3]=await mk({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1',viewport:{width:390,height:844}});
  await p3.goto(B+'/'); await p3.fill('#username','ahmed.b'); await p3.fill('#password','123456'); await p3.click('#loginBtn'); await p3.waitForSelector('#loginErr:not([hidden])');
  console.log('device 3:', await p3.textContent('#loginErr'));
  // 6 admin view
  await ap.click('#menuBtn'); await ap.click('#refreshBtn'); await ap.waitForTimeout(400);
  const row=await ap.$$eval('.tbl tbody tr',rs=>rs.map(r=>r.innerText.replace(/\s+/g,' ')));
  console.log('rows:', row);
  await ap.screenshot({path:'s_admin.png',fullPage:true});
  await ap.click('[data-open]:not(.link-btn) >> nth=1'); await ap.waitForSelector('.devs'); await ap.screenshot({path:'s_teacher.png'});
  await ap.click('[data-act="reset_devices"]'); await ap.click('#mOk'); await ap.waitForTimeout(400);
  console.log('device1 after reset ->', await p1.evaluate(()=>fetch('/api/lessons').then(r=>r.status)));
  await p3.click('#loginBtn'); await p3.waitForURL(B+'/app'); console.log('device 3 ok after reset');
  await ap.click('.tab >> nth=1'); await ap.waitForTimeout(200); await ap.screenshot({path:'s_activity.png',fullPage:true});
  // 8 lockout
  let [c4,p4]=await mk(); await p4.goto(B+'/');
  for(let i=0;i<6;i++){await p4.fill('#username','salim'); await p4.fill('#password','wrong'+i); await p4.click('#loginBtn'); await p4.waitForSelector('#loginErr:not([hidden])'); }
  console.log('lockout:', await p4.textContent('#loginErr'));
  // 9 anonymous
  const anon=await (await b.newContext()).request;
  console.log('anon /api/lessons', (await anon.get(B+'/api/lessons')).status(), 'anon /app ->', (await anon.get(B+'/app',{maxRedirects:0})).headers().location);
  const src=await (await anon.get(B+'/')).text(); console.log('login source has lesson text?', src.includes('خصائص الكائنات الحية'), 'size', src.length);
  console.log('setup again', (await anon.post(B+'/api/setup',{data:{name:'x',username:'hacker',password:'12345678'}})).status());
  console.log('errors', errs);
  await b.close();
})();
