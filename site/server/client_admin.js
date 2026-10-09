(function(){
'use strict';
guard();
var data=null,act=null,tab='teachers',q='',rep=null,repDays=30,crs=null,lessonsAll=null,openCourse=null;
var GRADES=['الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر','الحادي عشر','الثاني عشر'];
function gn(g){var i=GRADES.indexOf(g);return i<0?99:i;}
var REASONS={wrong_password:'كلمة مرور خاطئة',device_limit:'جهاز إضافي مرفوض',disabled:'حساب موقوف',locked:'محاولات كثيرة'};
var TYPES={login:'دخول',view:'فتح درس',copy_all:'نسخ التحضير كاملًا',copy_json:'نسخ لأداة نور',copy_field:'نسخ خانة',copy_hw:'نسخ الواجب',send_prep:'إرسال تحضير إلى نور',send_hw:'إرسال واجب إلى نور',quiz_make:'تكوين اختبار قصير',review_make:'تكوين مراجعة وحدة',quiz_print:'طباعة اختبار',quiz_word:'تحميل اختبار Word',quiz_save:'حفظ اختبار'};
function load(){
  return Promise.all([api('/api/admin/stats'),api('/api/admin/activity'),api('/api/admin/courses'),api('/api/lessons'),api('/api/admin/report?days='+repDays)]).then(function(r){data=r[0];act=r[1];crs=r[2];lessonsAll=r[3].lessons;rep=r[4];render();},function(e){toast(e.message);});
}
function courseName(k){var p=String(k).split('|');return p[0]+' — الصف '+(p[1]||'');}
function sortedCourses(){return (crs.courses||[]).slice().sort(function(a,b){return (gn(a.grade)-gn(b.grade))||a.subject.localeCompare(b.subject,'ar');});}
// ---------- التقرير ----------
function reportView(){
  var t=rep.totals,rows=rep.rows.filter(function(r){return r.role!=='admin';});
  var h='<div class="toolbar"><div class="seg-r">'+[[7,'آخر 7 أيام'],[30,'آخر 30 يومًا'],[0,'كل المدة']].map(function(o){return '<button type="button" class="btn small'+(repDays===o[0]?' primary':'')+'" data-days="'+o[0]+'">'+o[1]+'</button>';}).join('')+'</div><button type="button" class="btn" id="csvBtn">⬇ تنزيل التقرير (Excel/CSV)</button></div>';
  h+='<div class="kpis">'+[['معلمون استخدموا الموقع',rows.filter(function(r){return r.last_active;}).length],['تحضيرات أُرسلت لنور',t.preps],['واجبات أُرسلت لنور',t.hws],['اختبارات ومراجعات',t.quizzes],['مرات الدخول',t.logins]].map(function(k){return '<div class="kpi"><span class="kpi-n">'+k[1]+'</span><span class="kpi-l">'+k[0]+'</span></div>';}).join('')+'</div>';
  h+='<div class="t-wrap"><table class="tbl"><thead><tr><th>المعلم</th><th>الصفوف</th><th>دخول</th><th>تحضيرات</th><th>واجبات</th><th>اختبارات</th><th>مراجعات</th><th>طباعة/Word</th><th>آخر دخول</th></tr></thead><tbody>'+
    rows.sort(function(a,b){return (b.preps+b.hws+b.quizzes)-(a.preps+a.hws+a.quizzes)||(b.last_active||0)-(a.last_active||0);}).map(function(r){
      var sc=[];try{sc=JSON.parse(r.scope||'[]')||[];}catch(e){}
      return '<tr><td><b>'+esc(r.name)+'</b><div class="sub ltr">'+esc(r.username)+'</div></td><td>'+(sc.length?sc.map(function(k){return '<span class="chip-s">'+esc(courseName(k))+'</span>';}).join(''):'<span class="muted">كل الصفوف</span>')+'</td>'+
        '<td class="num">'+r.logins+'</td><td class="num">'+r.preps+'<span class="sub"> · '+r.prep_lessons+' درس</span></td><td class="num">'+r.hws+'<span class="sub"> · '+r.hw_lessons+' درس</span></td><td class="num">'+r.quizzes+'</td><td class="num">'+r.reviews+'</td><td class="num">'+r.prints+'</td><td>'+esc(ago(r.last_login))+'</td></tr>';
    }).join('')+'</tbody></table></div>';
  if(rep.by_grade.length)h+='<section class="card"><h3>الاستخدام حسب الصف</h3><div class="t-wrap" style="box-shadow:none"><table class="tbl" style="min-width:420px"><thead><tr><th>الصف</th><th>تحضيرات</th><th>واجبات</th><th>اختبارات ومراجعات</th></tr></thead><tbody>'+rep.by_grade.sort(function(a,b){return gn(a.grade)-gn(b.grade);}).map(function(g){return '<tr><td>'+esc(g.grade)+'</td><td class="num">'+g.preps+'</td><td class="num">'+g.hws+'</td><td class="num">'+g.quizzes+'</td></tr>';}).join('')+'</tbody></table></div></section>';
  if(rep.daily.length){var byD={};rep.daily.forEach(function(d){byD[d.d]=d;});var today=Math.floor((Date.now()+14400000)/86400000),days=[];
    for(var di=today-29;di<=today;di++)days.push(byD[di]||{d:di,users:0,preps:0,hws:0,quizzes:0});
    var mx=Math.max.apply(null,days.map(function(d){return d.preps+d.hws+d.quizzes;}).concat([1]));
    h+='<section class="card"><h3>النشاط اليومي (آخر 30 يومًا)</h3><div class="bars" role="img" aria-label="رسم النشاط اليومي">'+days.map(function(d){var v=d.preps+d.hws+d.quizzes,dt=new Date(d.d*86400000);return '<div class="bar" title="'+esc(dt.toLocaleDateString('ar-OM',{day:'numeric',month:'short'}))+': '+d.preps+' تحضير، '+d.hws+' واجب، '+d.quizzes+' اختبار، '+d.users+' معلم"><span style="height:'+Math.max(3,Math.round(v/mx*100))+'%"></span></div>';}).join('')+'</div><p class="muted">كل عمود يوم: مجموع التحضيرات والواجبات والاختبارات. مرّر المؤشر على العمود للتفاصيل.</p></section>';}
  return h;
}
function downloadCsv(){
  var rows=[['المعلم','اسم المستخدم','الصفوف','مرات الدخول','تحضيرات','دروس محضّرة','واجبات','دروس بواجبات','اختبارات','مراجعات','طباعة/Word','آخر دخول']];
  rep.rows.filter(function(r){return r.role!=='admin';}).forEach(function(r){var sc=[];try{sc=JSON.parse(r.scope||'[]')||[];}catch(e){}
    rows.push([r.name,r.username,sc.map(courseName).join(' / ')||'كل الصفوف',r.logins,r.preps,r.prep_lessons,r.hws,r.hw_lessons,r.quizzes,r.reviews,r.prints,r.last_login?new Date(r.last_login).toLocaleString('ar-OM'):'']);});
  var csv=rows.map(function(r){return r.map(function(c){c=String(c==null?'':c);return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c;}).join(',');}).join('\r\n');
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download='تقرير-الاستخدام-'+(repDays?repDays+'-يوم':'كامل')+'.csv';document.body.appendChild(a);a.click();setTimeout(function(){a.remove();},1000);
}
// ---------- المواد والدروس ----------
function coursesView(){
  var list=sortedCourses();
  var h='<div class="toolbar"><p class="muted" style="flex:1;margin:0">كل صف ومادة يظهر هنا. الصفوف الأصلية (الأحياء 9–12 والعلوم 5) لها تحضير وبنك أسئلة جاهز. أضف مادة أو صفًا جديدًا ثم أضف دروسه، ويظهر للمعلمين المسموح لهم في صفحة الدروس مع الإرسال لنور.</p><button type="button" class="btn primary" id="addCourse">+ مادة / صف جديد</button></div>';
  h+='<div class="t-wrap"><table class="tbl" style="min-width:640px"><thead><tr><th>المادة والصف</th><th>الدروس</th><th>دروس أضفتها</th><th>بنك الأسئلة</th><th>المعلمون</th><th></th></tr></thead><tbody>'+list.map(function(c){
    var tn=data.users.filter(function(u){var sc=[];try{sc=JSON.parse(u.scope||'[]')||[];}catch(e){}return u.role!=='admin'&&(!sc.length||sc.indexOf(c.key)>=0);}).length;
    return '<tr><td><b>'+esc(c.subject)+'</b> — الصف '+esc(c.grade)+'</td><td class="num">'+c.lessons+'</td><td class="num">'+c.custom+'</td><td class="num">'+(c.quiz_items||'<span class="muted">—</span>')+'</td><td class="num">'+tn+'</td><td><button type="button" class="btn small" data-course="'+esc(c.key)+'">الدروس</button></td></tr>';}).join('')+'</tbody></table></div>';
  if(openCourse){
    var c=list.filter(function(x){return x.key===openCourse;})[0];
    var ls=lessonsAll.filter(function(l){return (l.subject||'')+'|'+l.grade===openCourse;});
    h+='<section class="card"><div class="toolbar" style="margin-bottom:8px"><h3 style="flex:1;margin:0">'+esc(courseName(openCourse))+' · '+ls.length+' درس</h3><button type="button" class="btn primary small" id="addLesson">+ درس جديد</button>'+(c&&!c.lessons?'<button type="button" class="btn small danger" id="delCourse">حذف هذا الصف</button>':'')+'</div>'+
      (ls.length?'<ul class="toplist">'+ls.map(function(l){return '<li style="display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line);padding:6px 0"><span class="u-num" style="flex:0 0 26px">'+esc(l.unit)+'</span><span style="flex:1">'+esc(l.title)+(l.custom?'':' <span class="muted">(أصلي)</span>')+'</span>'+(l.custom?'<button type="button" class="btn small" data-editl="'+l.id+'">تعديل</button><button type="button" class="btn small danger" data-dell="'+l.id+'">حذف</button>':'<a class="btn small" href="/app">فتح في صفحة الدروس</a>')+'</li>';}).join('')+'</ul>':'<p class="muted">لا توجد دروس بعد. اضغط «درس جديد».</p>')+'</section>';
  }
  return h;
}
var LFORM=[['concepts','المفاهيم'],['pre_learning','التهيئة / التمهيد / التعلم القبلي'],['activities_teach','إجراءات سير الدرس / الأنشطة التدريسية'],['formative','التقويم التكويني'],['closing','التقويم الختامي'],['homework','الأنشطة والمهام المنزلية'],['outcomes','المخرجات التعليمية'],['hw_q1','سؤال الواجب 1'],['hw_a1','إجابة/اختيارات السؤال 1'],['hw_q2','سؤال الواجب 2'],['hw_a2','إجابة/اختيارات السؤال 2']];
function lessonForm(key,l){
  l=l||{};var p=key.split('|');
  var h='<div class="ed"><div class="ed-row"><label>الوحدة (رقم)<input id="l_unit" type="number" min="1" value="'+esc(l.unit||1)+'"></label><label>رقم الدرس في الوحدة<input id="l_no" type="number" min="1" value="'+esc(l.lesson_no||'')+'"></label><label>الفصل الدراسي<select id="l_term"><option value="1">الأول</option><option value="2"'+(+l.term===2?' selected':'')+'>الثاني</option></select></label><label>نوع الواجب<select id="l_hwt"><option value="essay">مقالي</option><option value="mcq"'+(l.hw_type==='mcq'?' selected':'')+'>اختيار من متعدد</option></select></label></div>'+
    '<label>اسم الوحدة<input id="l_uname" value="'+esc(l.unit_name||'')+'"></label><label>عنوان الدرس (كما في نور)<input id="l_title" value="'+esc(l.title||'')+'"></label>'+
    LFORM.map(function(f){return '<label>'+f[1]+'<textarea id="l_'+f[0]+'" rows="'+(/hw_/.test(f[0])?2:3)+'">'+esc(l[f[0]]||'')+'</textarea></label>';}).join('')+
    '<p class="muted small">في واجب الاختيار من متعدد: اكتب الاختيارات كل واحد في سطر، والسطر الأول هو الصحيح.</p></div>';
  var ov=$('modal'),box=$('modalBox');
  box.innerHTML='<h3 id="mTitle">'+(l.id?'تعديل درس':'درس جديد')+' · '+esc(courseName(key))+'</h3>'+h+'<div class="m-actions"><button type="button" class="btn" id="mCancel">إلغاء</button><button type="button" class="btn primary" id="mOk">حفظ الدرس</button></div>';
  box.classList.add('wide');ov.hidden=false;
  var close=function(){ov.hidden=true;box.innerHTML='';box.classList.remove('wide');};
  $('mCancel').onclick=close;
  $('mOk').onclick=function(){
    var b={id:l.id||0,subject:p[0],grade:p[1],unit:$('l_unit').value,lesson_no:$('l_no').value,term:$('l_term').value,hw_type:$('l_hwt').value,unit_name:$('l_uname').value.trim(),title:$('l_title').value.trim()};
    LFORM.forEach(function(f){b[f[0]]=$('l_'+f[0]).value;});
    if(!b.title){toast('اكتب عنوان الدرس');return;}
    api('/api/admin/custom_lessons',b).then(function(){close();toast('حُفظ الدرس');load();},function(e){toast(e.message);});
  };
}
function addCourse(){
  var h='<div class="ed"><label>المادة<input id="c_subj" placeholder="مثال: الكيمياء، العلوم، الفيزياء" list="subjList"></label><datalist id="subjList"><option>الأحياء</option><option>العلوم</option><option>الكيمياء</option><option>الفيزياء</option><option>العلوم البيئية</option></datalist>'+
    '<label>الصف<select id="c_grade">'+GRADES.map(function(g){return '<option>'+g+'</option>';}).join('')+'</select></label><p class="muted small">اكتب اسم المادة كما يظهر في قائمة صفوفك في نور (مثل «الكيمياء / الحادي عشر») حتى تفتح أداة نور الصف الصحيح تلقائيًا.</p></div>';
  var ov=$('modal'),box=$('modalBox');
  box.innerHTML='<h3 id="mTitle">مادة أو صف جديد</h3>'+h+'<div class="m-actions"><button type="button" class="btn" id="mCancel">إلغاء</button><button type="button" class="btn primary" id="mOk">إضافة</button></div>';ov.hidden=false;
  var close=function(){ov.hidden=true;box.innerHTML='';};
  $('mCancel').onclick=close;
  $('mOk').onclick=function(){var s=$('c_subj').value.trim(),g=$('c_grade').value;if(!s){toast('اكتب اسم المادة');return;}
    api('/api/admin/courses',{subject:s,grade:g}).then(function(r){close();openCourse=r.key;toast('أُضيف. أضف الدروس الآن');load();},function(e){toast(e.message);});};
}
function scopeDialog(u){
  var sc=[];try{sc=JSON.parse(u.scope||'[]')||[];}catch(e){}
  var h='<p class="m-msg">اختر الصفوف التي تظهر لـ '+esc(u.name)+' في صفحة الدروس والتقويم. إذا لم تختر شيئًا تظهر كل الصفوف.</p><div class="parts">'+sortedCourses().map(function(c){return '<label><input type="checkbox" data-sc="'+esc(c.key)+'"'+(sc.indexOf(c.key)>=0?' checked':'')+'> '+esc(c.subject)+' — الصف '+esc(c.grade)+'</label>';}).join('')+'</div>';
  var ov=$('modal'),box=$('modalBox');
  box.innerHTML='<h3 id="mTitle">الصفوف المسموحة</h3>'+h+'<div class="m-actions"><button type="button" class="btn" id="mCancel">إلغاء</button><button type="button" class="btn primary" id="mOk">حفظ</button></div>';ov.hidden=false;
  var close=function(){ov.hidden=true;box.innerHTML='';};
  $('mCancel').onclick=close;
  $('mOk').onclick=function(){var v=[];Array.prototype.forEach.call(box.querySelectorAll('[data-sc]'),function(c){if(c.checked)v.push(c.getAttribute('data-sc'));});close();act1(u,{action:'scope',value:v},'حُفظت الصفوف');};
}
function kpis(){
  var t=data.totals,blocked=data.users.reduce(function(s,u){return s+(u.blocked?u.blocked.n:0);},0);
  var items=[['المعلمون',t.teachers,''],['نشطون هذا الأسبوع',t.active7,''],['مرات الدخول',t.logins,''],['دروس منسوخة',t.copies,''],['أجهزة مرفوضة',blocked,blocked?'warn':'']];
  return '<div class="kpis">'+items.map(function(k){return '<div class="kpi '+k[2]+'"><span class="kpi-n">'+k[1]+'</span><span class="kpi-l">'+k[0]+'</span></div>';}).join('')+'</div>';
}
function teacherRows(){
  var list=data.users.filter(function(u){return !q||(u.name+u.username).toLowerCase().indexOf(q)>=0;});
  if(!list.length)return '<div class="empty-state">لا يوجد معلمون بعد. أضف المعلمين من زر «إضافة معلمين».</div>';
  return '<div class="t-wrap"><table class="tbl"><thead><tr><th>المعلم</th><th>مرات الدخول</th><th>آخر دخول</th><th>الصفوف المسموحة</th><th>الصفوف المستخدمة</th><th>دروس منسوخة</th><th>الأجهزة</th><th></th></tr></thead><tbody>'+
    list.map(function(u){
      var st=!u.active?'<span class="pill off">موقوف</span>':u.role==='admin'?'<span class="pill adm">مدير</span>':'';
      var dv=u.devices.length,warn=u.blocked?'<span class="pill warn" title="آخر محاولة '+esc(fmtDate(u.blocked.last))+'">'+u.blocked.n+' محاولة من جهاز آخر</span>':'';
      return '<tr><td><button type="button" class="link-btn" data-open="'+u.id+'"><b>'+esc(u.name)+'</b></button> '+st+'<div class="sub ltr">'+esc(u.username)+'</div></td>'+
        '<td class="num">'+u.logins+'</td><td>'+esc(ago(u.last_login))+'</td>'+
        '<td>'+(u.role==='admin'?'<span class="muted">الكل</span>':(function(){var sc=[];try{sc=JSON.parse(u.scope||'[]')||[];}catch(e){}return sc.length?sc.map(function(k){return '<span class="chip-s">'+esc(courseName(k))+'</span>';}).join(''):'<span class="muted">كل الصفوف</span>';})())+'</td>'+
        '<td>'+(u.grades.length?u.grades.map(function(g){return '<span class="chip-s">'+esc(g.grade)+'</span>';}).join(''):'<span class="muted">—</span>')+'</td>'+
        '<td class="num">'+u.lessons_copied+'<span class="sub"> درس · '+u.copies+' نسخة</span></td>'+
        '<td><span class="num">'+dv+'/'+(u.role==='admin'?'∞':u.max_devices)+'</span> '+warn+'</td>'+
        '<td><button type="button" class="btn small" data-open="'+u.id+'">التفاصيل</button></td></tr>';
    }).join('')+'</tbody></table></div>';
}
function activityView(){
  var ev=act.events.map(function(e){return '<li><span class="ev-t">'+esc(fmtDate(e.at))+'</span><b>'+esc(e.name)+'</b> '+esc(TYPES[e.type]||e.type)+(e.lesson_title?' · <span class="muted">'+esc(e.grade)+' — '+esc(e.lesson_title)+'</span>':'')+(e.label?' <span class="dev">'+esc(e.label)+'</span>':'')+'</li>';}).join('');
  var fa=act.failed.map(function(a){return '<li class="'+(a.reason==='device_limit'?'bad':'')+'"><span class="ev-t">'+esc(fmtDate(a.at))+'</span><b>'+esc(a.name||a.username)+'</b> '+esc(REASONS[a.reason]||a.reason)+(a.label?' <span class="dev">'+esc(a.label)+'</span>':'')+(a.ip?' <span class="muted ltr">'+esc(a.ip)+'</span>':'')+'</li>';}).join('');
  return '<div class="two"><section class="card"><h3>آخر النشاطات</h3><ul class="feed">'+(ev||'<li class="muted">لا يوجد نشاط بعد.</li>')+'</ul></section>'+
    '<section class="card"><h3>محاولات دخول مرفوضة</h3><p class="muted">الصف الأحمر يعني أن أحدًا حاول الدخول بحساب معلم من جهاز ثالث.</p><ul class="feed">'+(fa||'<li class="muted">لا توجد محاولات مرفوضة.</li>')+'</ul></section></div>';
}
function render(){
  var T=[['teachers','المعلمون'],['report','تقرير الاستخدام'],['courses','المواد والدروس'],['activity','النشاط والتنبيهات']];
  var h=(tab==='report'?'':kpis())+'<div class="tabs" role="tablist">'+T.map(function(t){return '<button type="button" role="tab" class="tab'+(tab===t[0]?' on':'')+'" data-tab="'+t[0]+'">'+t[1]+'</button>';}).join('')+'</div>';
  if(tab==='teachers')h+='<div class="toolbar"><input id="search" placeholder="ابحث باسم المعلم" value="'+esc(q)+'"><button type="button" class="btn primary" id="addBtn">إضافة معلمين</button></div>'+teacherRows();
  else if(tab==='report')h+=reportView();
  else if(tab==='courses')h+=coursesView();
  else h+=activityView();
  $('dash').innerHTML=h;
  Array.prototype.forEach.call(document.querySelectorAll('[data-tab]'),function(b){b.onclick=function(){tab=b.getAttribute('data-tab');render();};});
  Array.prototype.forEach.call(document.querySelectorAll('[data-open]'),function(b){b.onclick=function(){openTeacher(+b.getAttribute('data-open'));};});
  if($('search'))$('search').oninput=function(){q=this.value.trim().toLowerCase();var pos=this.selectionStart;render();var s=$('search');s.focus();s.setSelectionRange(pos,pos);};
  if($('addBtn'))$('addBtn').onclick=addTeachers;
  Array.prototype.forEach.call(document.querySelectorAll('[data-days]'),function(b){b.onclick=function(){repDays=+b.getAttribute('data-days');api('/api/admin/report?days='+repDays).then(function(r){rep=r;render();});};});
  if($('csvBtn'))$('csvBtn').onclick=downloadCsv;
  if($('addCourse'))$('addCourse').onclick=addCourse;
  Array.prototype.forEach.call(document.querySelectorAll('[data-course]'),function(b){b.onclick=function(){openCourse=b.getAttribute('data-course');render();};});
  if($('addLesson'))$('addLesson').onclick=function(){lessonForm(openCourse,null);};
  if($('delCourse'))$('delCourse').onclick=function(){api('/api/admin/courses?key='+encodeURIComponent(openCourse),null,'DELETE').then(function(){openCourse=null;load();toast('حُذف');},function(e){toast(e.message);});};
  Array.prototype.forEach.call(document.querySelectorAll('[data-editl]'),function(b){b.onclick=function(){var l=lessonsAll.filter(function(x){return x.id===+b.getAttribute('data-editl');})[0];if(l)lessonForm(openCourse,l);};});
  Array.prototype.forEach.call(document.querySelectorAll('[data-dell]'),function(b){b.onclick=function(){dialog({title:'حذف هذا الدرس؟',message:'يُحذف من صفحة الدروس لكل المعلمين.',okText:'حذف',danger:true}).then(function(ok){if(ok)api('/api/admin/custom_lessons/'+b.getAttribute('data-dell'),null,'DELETE').then(function(){toast('حُذف الدرس');load();});});};});
}
function addTeachers(){
  var sc='<p class="m-msg">الصفوف التي تظهر لهم (اتركها كلها فارغة ليروا كل الصفوف، ويمكن تعديلها لاحقًا لكل معلم):</p><div class="parts" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">'+sortedCourses().map(function(c){return '<label><input type="checkbox" data-isc="'+esc(c.key)+'"> '+esc(c.subject)+' — '+esc(c.grade)+'</label>';}).join('')+'</div>';
  var chosen=[];
  setTimeout(function(){Array.prototype.forEach.call(document.querySelectorAll('[data-isc]'),function(c){c.onchange=function(){var k=c.getAttribute('data-isc');if(c.checked)chosen.push(k);else chosen=chosen.filter(function(x){return x!==k;});};});},50);
  dialog({title:'إضافة معلمين',message:'اكتب كل معلم في سطر: الاسم، اسم المستخدم، كلمة المرور. لو تركت كلمة المرور فاضية تُنشأ تلقائيًا.',html:sc,textarea:true,placeholder:'أحمد البلوشي، ahmed.b، 123456\nسالم الهنائي، salim.h',okText:'إضافة'}).then(function(v){
    if(!v)return;
    api('/api/admin/import',{text:v,scope:chosen}).then(function(r){
      var ok=r.done.map(function(d){return d.name+' | '+d.username+' | '+d.password;}).join('\n');
      var bad=r.errors.map(function(e){return '• '+e.line+': '+e.error;}).join('\n');
      dialog({title:'تمت إضافة '+r.done.length+' معلم',message:r.done.length?'احفظ بيانات الدخول التالية وأرسلها للمعلمين. لن تظهر كلمات المرور مرة أخرى.':'',textarea:true,readonly:true,ltr:false,value:ok+(bad?'\n\nلم تتم إضافة:\n'+bad:''),okText:'نسخ البيانات',cancelText:'إغلاق'}).then(function(c){if(c)copyText(ok);});
      load();
    },function(e){toast(e.message);});
  });
}
function openTeacher(id){
  var u=data.users.filter(function(x){return x.id===id;})[0];if(!u)return;
  var dev=u.devices.map(function(d){return '<li><div><b>'+esc(d.label||'جهاز')+'</b><div class="sub">أول دخول '+esc(fmtDate(d.first_seen))+' · آخر استخدام '+esc(ago(d.last_seen))+(d.ip?' · <span class="ltr">'+esc(d.ip)+'</span>':'')+'</div></div><button type="button" class="btn small danger" data-rmdev="'+d.id+'">إزالة</button></li>';}).join('')||'<li class="muted">لم يسجّل دخولًا من أي جهاز بعد.</li>';
  var top=u.top.map(function(t){return '<li>'+esc(t.grade)+' — '+esc(t.title)+' <span class="muted">('+t.n+')</span></li>';}).join('')||'<li class="muted">لم ينسخ أي درس بعد.</li>';
  var html='<div class="t-stats"><div><b>'+u.logins+'</b><span>مرة دخول</span></div><div><b>'+u.lessons_viewed+'</b><span>درس فتحه</span></div><div><b>'+u.lessons_copied+'</b><span>درس نسخه</span></div><div><b>'+u.copies+'</b><span>عملية نسخ</span></div></div>'+
    (u.blocked?'<div class="alert">تمت محاولة الدخول بهذا الحساب من جهاز إضافي '+u.blocked.n+' مرة، آخرها '+esc(fmtDate(u.blocked.last))+'.</div>':'')+
    '<h4>الأجهزة ('+u.devices.length+' من '+(u.role==='admin'?'غير محدود':u.max_devices)+')</h4><ul class="devs">'+dev+'</ul>'+
    '<h4>أكثر الدروس نسخًا</h4><ul class="toplist">'+top+'</ul>'+
    '<h4>إجراءات</h4><div class="acts">'+
      '<button type="button" class="btn small" data-act="password">كلمة مرور جديدة</button>'+
      '<button type="button" class="btn small" data-act="rename">تعديل الاسم</button>'+
      (u.role!=='admin'?'<button type="button" class="btn small primary" data-act="scope">الصفوف المسموحة</button><button type="button" class="btn small" data-act="reset_devices">مسح كل الأجهزة</button><button type="button" class="btn small" data-act="max_devices">عدد الأجهزة المسموح</button><button type="button" class="btn small" data-act="toggle">'+(u.active?'إيقاف الحساب':'تفعيل الحساب')+'</button><button type="button" class="btn small danger" data-act="delete">حذف المعلم</button>':'')+
    '</div>';
  dialog({title:u.name,message:u.username,html:html,okText:'إغلاق',cancelText:false});
  setTimeout(function(){
    Array.prototype.forEach.call(document.querySelectorAll('[data-rmdev]'),function(b){b.onclick=function(){act1(u,{action:'remove_device',device:+b.getAttribute('data-rmdev')},'أُزيل الجهاز');};});
    Array.prototype.forEach.call(document.querySelectorAll('[data-act]'),function(b){b.onclick=function(){doAct(u,b.getAttribute('data-act'));};});
  },0);
}
function closeModal(){$('modal').hidden=true;$('modalBox').innerHTML='';}
function act1(u,payload,msg){return api('/api/admin/teachers/'+u.id,payload).then(function(r){toast(msg);closeModal();return load().then(function(){return r;});},function(e){toast(e.message);});}
function doAct(u,a){
  closeModal();
  if(a==='password')return dialog({title:'كلمة مرور جديدة لـ '+u.name,input:true,placeholder:'اتركها فارغة لإنشاء كلمة مرور تلقائية',okText:'حفظ'}).then(function(v){if(v===null)return;api('/api/admin/teachers/'+u.id,{action:'password',password:v}).then(function(r){load();dialog({title:'كلمة المرور الجديدة',textarea:true,readonly:true,value:u.username+' | '+r.password,okText:'نسخ',cancelText:'إغلاق'}).then(function(c){if(c)copyText(u.username+' | '+r.password);});},function(e){toast(e.message);});});
  if(a==='rename')return dialog({title:'تعديل اسم المعلم',input:true,value:u.name,okText:'حفظ'}).then(function(v){if(v)act1(u,{action:'rename',name:v},'حُفظ الاسم');});
  if(a==='max_devices')return dialog({title:'عدد الأجهزة المسموح لـ '+u.name,input:true,value:String(u.max_devices),placeholder:'من 1 إلى 5',okText:'حفظ'}).then(function(v){if(v)act1(u,{action:'max_devices',value:+v},'تم التعديل');});
  if(a==='reset_devices')return dialog({title:'مسح أجهزة '+u.name,message:'سيُسجَّل خروجه من كل الأجهزة، ويستطيع الدخول من جهازين جديدين.',okText:'مسح الأجهزة',danger:true}).then(function(ok){if(ok)act1(u,{action:'reset_devices'},'مُسحت الأجهزة');});
  if(a==='scope')return scopeDialog(u);
  if(a==='toggle')return act1(u,{action:'toggle'},u.active?'أُوقف الحساب':'فُعّل الحساب');
  if(a==='delete')return dialog({title:'حذف '+u.name,message:'سيُحذف الحساب نهائيًا ولن يستطيع الدخول. تبقى إحصائياته القديمة محفوظة.',okText:'حذف',danger:true}).then(function(ok){if(ok)api('/api/admin/teachers/'+u.id,null,'DELETE').then(function(){toast('حُذف المعلم');load();},function(e){toast(e.message);});});
}
$('logoutBtn').onclick=logout;
$('refreshBtn').onclick=function(){load().then(function(){toast('تم التحديث');});};
api('/api/me').then(function(m){$('who').textContent=m.name;});
load();
})();
