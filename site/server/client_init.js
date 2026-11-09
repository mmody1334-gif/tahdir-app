// «المبادرات» — تقني حذيفة فقط: كل معلم يرفع مبادراته (العنوان، النبذة، الأهداف، الإثباتات بالصور/PDF)
// وتُحفظ على الخادم في حسابه. المدير يرى مبادرات كل المعلمين مع اسم صاحبها، ويفتح الإثباتات.
// في نطاق «تقني حذيفة» تُعرض المبادرات الرسمية المعتمدة للمدرسة وقسم العلوم وأ. محمد مجدي (بما فيها تقني حذيفة والفيديو).
(function(){
'use strict';
guard();
var D={items:[],admin:false},Q='',T='',CAT='',URLS={};
var isTeqany = location.pathname.indexOf('/teqany') >= 0 || location.hostname.indexOf('hudhaifa') >= 0 || document.title.indexOf('حذيفة') >= 0;

var FEATURED_TQ = [
  {
    id: 'f_ain',
    isFeatured: true,
    cat: 'ai',
    badge: 'ذكاء اصطناعي وابتكار',
    title: 'مشروع «عَيْن حُذَيْفَة» الذَّكِيَّة',
    sub: 'ابتكار ذكاء اصطناعي ونظارة بصرية-ليزرية لتمكين الصم والمكفوفين',
    teacher: 'أ. محمد مجدي · معلم الأحياء | أ. أحمد النعيمي · معلم التقنية',
    supervisor: 'د. بدري الكعبي · مدير المدرسة',
    created_at: 1731155000000,
    app_link: 'https://ain-app.ain-app.workers.dev/',
    summary: 'منظومة ابتكارية وطنية متكاملة تجمع بين خوارزميات الذكاء الاصطناعي التوليدي، تقنيات الرؤية الحاسوبية (Computer Vision)، ونظارة ذكية بصرية-ليزرية متطورة لتمكين الطلبة الصم والمكفوفين. تدمج المنظومة: ترجمة فورية لإشارات اليد عبر تتبع 21 نقطة حساسة وتحويلها لنصوص وكلام منطوق، ورادار ليزري مع قارئ عملات نقدية عمانية ينبه الكفيف من العوائق ويقرأ فئات النقود بالصوت، إلى جانب بيئة تفاعلية ثلاثية الأبعاد 360° لتعلم لغة الإشارة.\n\n🌐 رابط التطبيق المباشر: https://ain-app.ain-app.workers.dev/',
    goals: '• الدمج الأكاديمي والمجتمعي الشامل للطلبة الصم والمكفوفين داخل الفصول المدرسية والمختبرات.\n• كسر حاجز التواصل عبر ترجمة ثنائية فورية بين لغة الإشارة والكلام المنطوق بالذكاء الاصطناعي.\n• تمكين الطالب الكفيف من الاستقلالية التامة في الحركة وتفادي العوائق وقراءة العملات الورقية العمانية.\n• توفير بيئة تعليمية تفاعلية ومحاكي يد ثلاثي الأبعاد (360°) لتسهيل ممارسة وإتقان لغة الإشارة.\n• تكامل حقول العلوم وتقنية المعلومات في إنتاج ابتكارات ذكاء اصطناعي إنسانية تخدم المجتمع العماني.',
    steps: '1. بناء وتطوير الواجهة السحابية التفاعلية على منصة Cloudflare Workers لضمان سرعة معالجة فائقة: https://ain-app.ain-app.workers.dev/\n2. تدريب وتطبيق نماذج الذكاء الاصطناعي لتتبع 21 مفصلاً ونقطة حرجة لليد (21 Landmarks AI Tracking) لترجمة إشارات الصم الفورية.\n3. تصميم وتجميع النموذج الأولي لـ «نظارة عين حذيفة» بمستشعرات مسافة ليزرية وبصرية مع تنبيهات صوتية واهتزازية ذكية.\n4. دمج خوارزمية التعرف البصري على الفئات النقدية العمانية الورقية وتحويل القيمة تلقائياً إلى نطق صوتي للكفيف.\n5. إطلاق وحدة «اسمع» لتحويل الكلام المباشر لإشارات بصرية ورصد أصوات الخطر وحالات الطوارئ المدرسية.\n6. إتاحة ميدان التحدي التفاعلي واليد ثلاثية الأبعاد 360° لممارسة وتدريب الطلاب على مفردات لغة الإشارة.\n7. التطبيق التجريبي الميداني في مدرسة حذيفة بن محصن (5-12) والتقييم المستمر تحت إشراف إدارة المدرسة.',
    impact: '• تحقيق نسبة استقلالية ودمج صفي تصل إلى 100% للطلبة ذوي الإعاقة السمعية والبصرية.\n• سهولة التواصل الفوري المباشر بين المعلمين والطلاب الصم دون الحاجة لمترجم بشري متفرغ.\n• حماية وأمان الطلبة المكفوفين أثناء التنقل في الممرات والمرافق المدرسية بفضل الرادار الليزري الذكي.\n• تمثيل مشرف لمدرسة حذيفة بن محصن في مسابقات الابتكار العلمي وحاضنات الذكاء الاصطناعي بسلطنة عُمان.',
    files: [
      { id: 'f_p5', name: 'الملصق الرسمي لمشروع عين حذيفة الذكية', src: '/promo/ain_hudhaifa_poster.jpg', mime: 'image/jpeg', size: 463793 },
      { id: 'f_link_ain', name: 'رابط منظومة عين حذيفة الذكية السحابية', src: 'https://ain-app.ain-app.workers.dev/', mime: 'text/html', size: 0 }
    ]
  },
  {
    id: 'f_teqany',
    isFeatured: true,
    cat: 'teqany',
    badge: 'المنظومة الرقمية الكبرى',
    title: 'مبادرة تقني حذيفة للمعلمين',
    sub: 'المنظومة الرقمية للتحضير الذكي والابتكار التعليمي',
    teacher: 'أ. محمد مجدي · معلم الأحياء ومطور المنظومة',
    supervisor: 'د. بدر الكعبي · مدير المدرسة',
    created_at: 1731150000000,
    video: '/promo/teqany.mp4',
    summary: 'منظومة تقنية سحابية ذكية فائقة السرعة طُوّرت خصيصاً لتمكين المعلمين من التحضير التفاعلي الذكي، وإنشاء وتوليد الأسئلة والاختبارات وبطاقات التقويم، والربط المؤتمت مع البوابات التعليمية (بوابة نور / المنصات الرسمية) بأدوات الذكاء الاصطناعي، إلى جانب توثيق ونشر المبادرات المدرسية وتصدير السجلات المعتمدة بلمسة زر.',
    goals: '• أتمتة وتبسيط مهام التحضير والتخطيط الدراسي للمعلمين لتوفير الوقت للتعليم النشط.\n• تمكين الكادر التعليمي من أحدث أدوات الذكاء الاصطناعي وبنوك الأسئلة المنهجية.\n• توثيق مبادرات وإنجازات المعلمين في سجلات رقمية متوافقة مع متطلبات الإشراف التربوي.\n• توفير منصة سحابية آمنة وفائقة السرعة تعمل عبر الحواسيب والهواتف دون عوائق.',
    steps: '1. بناء وتطوير منصة تقني حذيفة على البنية السحابية العالمية Cloudflare Workers.\n2. عقد لقاءات وورش تدريبية للمعلمين لتفعيل ميزات التحضير وأداة نور الذكية.\n3. إطلاق بوابة المبادرات الرقمية وبنوك الأسئلة والمراجعات التفاعلية والنهائيات.\n4. التطوير البرمجي المستمر وفق احتياجات الميدان التربوي ومقترحات المعلمين.',
    impact: '• توفير أكثر من 70% من الوقت المستغرق في الإجراءات الورقية والروتينية للتحضير.\n• تحول رقمي نوعي في إدارة وتوثيق المبادرات المدرسية بمحافظة البريمي.\n• رفع الكفاءة التقنية للمعلمين وتبني تطبيقات الذكاء الاصطناعي في التعليم.',
    files: [
      { id: 'f_p1', name: 'الملصق الرسمي لمبادرة تقني حذيفة للمعلمين', src: '/promo/teqany_poster.jpg', mime: 'image/jpeg', size: 847774 },
      { id: 'f_s1', name: 'لقطة شاشة من لوحة تحكم منصة تقني حذيفة', src: '/promo/teqany_dashboard.png', mime: 'image/png', size: 31972 },
      { id: 'f_s2', name: 'لقطة شاشة من قسم المبادرات التفاعلي بالمنصة', src: '/promo/teqany_initiatives.png', mime: 'image/png', size: 322191 }
    ]
  },
  {
    id: 'f_astatee',
    isFeatured: true,
    cat: 'bio',
    badge: 'التقييم الذاتي في الأحياء',
    title: 'مبادرة أستطيع أن... للتقييم الذاتي في مادة الأحياء',
    sub: 'للتقييم الذاتي والتمكن المعرفي في مادة الأحياء',
    teacher: 'أ. محمد مجدي · معلم الأحياء',
    supervisor: 'د. بدر الكعبي · مدير المدرسة',
    created_at: 1731150000000,
    summary: 'مبادرة تربوية تعتمد على تفعيل استراتيجية التقييم الذاتي المستمر (I Can Statements) لدى طلبة الأحياء، من خلال قوائم معيارية تحدد نواتج التعلم بدقة وتتيح للطالب تقييم مستواه ذاتياً (مستعد للمضي قدماً / متمكن إلى حد ما / أحتاج لبذل جهد)، بما يعزز الاستقلالية والدافعية ويوجه الدعم الفردي داخل المختبر والصف.',
    goals: '• غرس ثقافة التقييم الذاتي والتأمل المعرفي لدى طلاب الأحياء.\n• تمكين الطالب من تشخيص نقاط قوته وتحديد المهارات التي تتطلب دعماً إضافياً.\n• تعزيز دافعية التحضير الذاتي المسبق للدروس والتجارب العملية.\n• توجيه خطط الدعم والتمايز التدريسي وفق احتياجات كل طالب الفعلية.',
    steps: '1. توزيع بطاقات وقوائم التقييم الذاتي المعيارية «أستطيع أن...» لكل وحدة دراسية.\n2. تحديد المعايير المخبرية والنظرية المطلوب تمكن الطالب منها قبل بدء الوحدة.\n3. رصد الطالب لتطوره الذاتي مرحلياً وتصنيف تمكنه (مستعد / متمكن / أحتاج جهد).\n4. تنفيذ حصص المراجعة والتطبيقات العملية والمخبرية لسد الفجوات المرصودة.\n5. تقييم ختامي يعزز ثقة الطالب بتقدمه المعرفي والميداني.',
    impact: '• ارتفاع دقة التشخيص الذاتي لدى الطلاب لمستواهم الأكاديمي.\n• زيادة ملحوظة في دافعية المشاركة الصفية والعمل المخبري.\n• تقليص فجوات التحصيل عبر خطط تدخل سريعة وموجهة.',
    files: [
      { id: 'f_p2', name: 'ملصق مبادرة أستطيع أن... للتقييم الذاتي في مادة الأحياء', src: '/promo/astatee_poster.jpg', mime: 'image/jpeg', size: 401285 }
    ]
  },
  {
    id: 'f_jamia',
    isFeatured: true,
    cat: 'bio',
    badge: 'عربة التميز ومحفزات الذكاء الاصطناعي',
    title: 'مبادرة جمعية الأحياء المتنقلة',
    sub: 'عربة التميز ومحفزات عجلة الحظ',
    teacher: 'أ. محمد مجدي · معلم الأحياء',
    supervisor: 'د. بدر الكعبي · مدير المدرسة',
    created_at: 1731150000000,
    summary: 'مبادرة تحفيزية نوعية تدمج التميز العلمي بالتعزيز التقني العصري، من خلال عربة متنقلة تجوب الصفوف والمختبرات مجهزة بـ «عجلة الحظ» التفاعلية لمكافأة الطلاب المتميزين بجوائز مبتكرة تشمل اشتراكات الذكاء الاصطناعي (AI Subscriptions)، وبطاقات الامتيازات التقنية (Tech Perks)، وهدايا وأدوات علمية وكتباً إثرائية.',
    goals: '• ابتكار منظومة تحفيز تواكب اهتمامات الجيل الرقمي وتربط العلم بالتقنية.\n• تشجيع التفاعل الصفي والبحثي والمشاريع الابتكارية في مادة الأحياء.\n• تمكين الطلاب من أدوات واشتراكات الذكاء الاصطناعي لخدمة مسارهم التعليمي.\n• نشر أجواء البهجة والمنافسة البناءة والإيجابية في أروقة المدرسة.',
    steps: '1. تجهيز عربة جمعية الأحياء المتنقلة وعجلة الحظ التفاعلية وجوائزها التقنية.\n2. تحديد معايير التميز الصفي والمخبري وإنجاز المهام العلمية أسبوعياً.\n3. جولة العربة بالصفوف وتدوير عجلة الحظ للطلاب المستحقين وتكريمهم فورياً.\n4. تسليم الجوائز والاشتراكات وتوثيق قصص نجاح وتطور الطلاب.',
    impact: '• قفزة في مستويات تفاعل ومشاركة الطلاب في الحصص والمختبرات.\n• استثمار مبكر لتقنيات الذكاء الاصطناعي في تمكين الطلاب علمياً.\n• ترسيخ بيئة مدرسية جاذبة ومحفزة على الإبداع المستمر.',
    files: [
      { id: 'f_p3', name: 'بانر مبادرة جمعية الأحياء المتنقلة وعجلة الحظ', src: '/promo/jamia_poster.jpg', mime: 'image/jpeg', size: 332928 }
    ]
  },
  {
    id: 'f_talent',
    isFeatured: true,
    cat: 'talent',
    badge: 'اكتشاف ورعاية الموهوبين',
    title: 'حذيفة جوت تالنت (تنمية المواهب والإبداع)',
    sub: 'اكتشاف وصقل المواهب الطلابية في كافة المجالات',
    teacher: 'أ. محمد مجدي · معلم الأحياء',
    supervisor: 'د. بدر الكعبي · مدير المدرسة',
    created_at: 1731150000000,
    summary: 'مبادرة حاضنة تهدف إلى اكتشاف وصقل ورعاية المواهب الطلابية في شتى المجالات (التجارب العلمية الاستقصائية، الفنون الأدائية والإلقاء، الإبداع الابتكاري والاختراع، والتفكير المستقبلي)، وتوفير مسرح ومسابقات تفاعلية أمام لجان تحكيم متخصصة وجمهور مدرسي واسع لتعزيز ثقتهم بأنفسهم وخدمة مستقبلهم.',
    goals: '• اكتشاف المواهب الكامنة وتوفير منصة رسمية ومحفزة لإبرازها.\n• تشجيع الطلاب على التجريب والابتكار خارج الإطار التقليدي للمناهج.\n• تنمية مهارات التقديم والتحدث أمام الجمهور والذكاء التواصلي.\n• تأهيل وتوجيه المتميزين للمنافسات والملتقيات العلمية والإبداعية على مستوى السلطنة.',
    steps: '1. إطلاق وتعميم استمارة الترشح وتحديد المسارات (العلمي، الابتكاري، الأدائي).\n2. تنظيم تجارب أداء مرحلية وفرز المشاركات وتقديم التوجيه الفني للطلاب.\n3. إقامة العروض المباشرة والحفلات التنافسية على مسرح المدرسة أمام لجنة التحكيم.\n4. تكريم الفائزين ورعاية مشاريعهم ومواهبهم بالشراكة مع الإدارة المدرسية.',
    impact: '• ظهور مواهب نوعية ومبتكرين صغار في العلوم والتقنية والإلقاء.\n• تعزيز الثقة بالنفس وبناء شخصية طلابية متكاملة وقائدة.\n• ترسيخ مكانة مدرسة حذيفة كصرح رائد في احتضان ورعاية الموهوبين.',
    files: [
      { id: 'f_p4', name: 'ملصق مبادرة حذيفة جوت تالنت', src: '/promo/talent_poster.jpg', mime: 'image/jpeg', size: 409934 }
    ]
  }
];

function fmtSize(n){return n>=1048576?(n/1048576).toFixed(1)+' م.ب':Math.max(1,Math.round(n/1024))+' ك.ب';}
function hdrs(){var h={},s=sidGet(),d=didGet();if(s)h['X-Tahdir-Sid']=s;if(d)h['X-Tahdir-Did']=d;return h;}

function fileUrl(f){
  if(typeof f==='string')return Promise.resolve(f);
  if(f.src)return Promise.resolve(f.src);
  var id=f.id||f;
  if(URLS[id])return Promise.resolve(URLS[id]);
  return fetch('/api/init/file/'+id,{credentials:'same-origin',headers:hdrs()}).then(function(r){if(!r.ok)throw new Error('تعذّر فتح الملف');return r.blob();}).then(function(b){return (URLS[id]=URL.createObjectURL(b));});
}

function nl(s){return esc(s).replace(/\n/g,'<br>');}
function isImg(f){return /^image\//.test(f.mime)||/\.(jpe?g|png|webp|svg)$/i.test(f.src||f.name||'');}

function list(){
  var items = (D.items || []).slice();
  if (isTeqany) {
    FEATURED_TQ.forEach(function(feat){
      if (!items.some(function(x){ return x.id === feat.id; })) {
        items.unshift(feat);
      }
    });
  }
  var L = items.filter(function(it){
    if (CAT && CAT !== 'all') {
      if (CAT === 'mine') { if (it.isFeatured) return false; }
      else if (it.cat !== CAT) return false;
    }
    if (T && String(it.user_id) !== T && !it.isFeatured) return false;
    if (!Q) return true;
    var q = Q.toLowerCase();
    return [it.title, it.summary, it.goals, it.teacher, it.sub].join(' ').toLowerCase().indexOf(q) >= 0;
  });
  return L;
}

function render(){
  var h = '<div class="an-head"><h2>💡 ' + (isTeqany ? 'مبادرات مدرسة حذيفة بن محصن (5-12)' : (D.admin ? 'مبادرات المعلمين' : 'مبادراتي')) + '</h2><p class="muted">' +
    (isTeqany
      ? 'سجل المبادرات التربوية والتقنية المعتمدة للمدرسة ولقسم العلوم، مع إمكانية رفع المعلمين لمبادراتهم الجديدة بإثباتاتها.'
      : (D.admin
        ? 'كل المبادرات التي رفعها المعلمون بإثباتاتها. اضغط على أي صورة لعرضها كاملة.'
        : 'ارفع مبادرتك بعنوانها ونبذة عنها وأهدافها وإثباتاتها (صور أو PDF). تُحفظ في حسابك، ويطّلع عليها مدير المنصة.')) +
    '</p></div>';

  if (isTeqany) {
    h += '<div class="in-tabs" style="display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;margin-bottom:12px">' +
      '<button type="button" class="btn small' + (!CAT || CAT === 'all' ? ' primary' : ' ghost') + '" data-cat="all">🌟 كل المبادرات (' + listCount('all') + ')</button>' +
      '<button type="button" class="btn small' + (CAT === 'ai' ? ' primary' : ' ghost') + '" data-cat="ai">🤖 الذكاء الاصطناعي والتقنية</button>' +
      '<button type="button" class="btn small' + (CAT === 'teqany' ? ' primary' : ' ghost') + '" data-cat="teqany">⚡ تقني حذيفة</button>' +
      '<button type="button" class="btn small' + (CAT === 'bio' ? ' primary' : ' ghost') + '" data-cat="bio">🔬 الأحياء والعلوم</button>' +
      '<button type="button" class="btn small' + (CAT === 'talent' ? ' primary' : ' ghost') + '" data-cat="talent">🎭 المواهب والإبداع</button>' +
      '<button type="button" class="btn small' + (CAT === 'mine' ? ' primary' : ' ghost') + '" data-cat="mine">📁 مبادرات المعلمين المرفوعة</button>' +
      '</div>';
  }

  h += '<div class="an-new in-bar"><button type="button" class="btn primary" id="inNew">+ مبادرة جديدة</button>';
  if (D.admin) {
    var t = {};
    D.items.forEach(function(it){ if(!it.isFeatured) t[it.user_id] = it.teacher || ('#' + it.user_id); });
    if (Object.keys(t).length > 0) {
      h += '<select id="inT" aria-label="المعلم"><option value="">كل المعلمين</option>' + Object.keys(t).sort(function(a,b){ return String(t[a]).localeCompare(String(t[b]),'ar'); }).map(function(k){
        var n = D.items.filter(function(x){ return String(x.user_id) === k; }).length;
        return '<option value="' + k + '"' + (T === k ? ' selected' : '') + '>' + esc(t[k]) + ' (' + n + ')</option>';
      }).join('') + '</select>';
    }
  }
  h += '<input type="search" id="inQ" placeholder="ابحث في المبادرات أو الأهداف أو المعلم…" value="' + esc(Q) + '">';
  h += '</div>';

  var L = list();
  if (!L.length) {
    h += '<div class="in-empty">' + (Q ? 'لا توجد نتائج مطابقة لبحثك.' : 'لم تُضف أي مبادرات بعد.') + '</div>';
  } else {
    h += '<div class="in-list">' + L.map(card).join('') + '</div>';
  }

  $('inMain').innerHTML = h;
  $('inNew').onclick = function(){ edit(null); };

  if ($('inT')) $('inT').onchange = function(){ T = this.value; render(); };
  if ($('inQ')) {
    $('inQ').oninput = function(){
      Q = this.value.trim();
      var p = this.selectionStart;
      render();
      var e = $('inQ');
      if (e) { e.focus(); try{ e.setSelectionRange(p,p); }catch(x){} }
    };
  }

  Array.prototype.forEach.call($('inMain').querySelectorAll('[data-cat]'), function(b){
    b.onclick = function(){ CAT = b.getAttribute('data-cat'); render(); };
  });

  bindCards($('inMain'));
}

function listCount(cat){
  var items = (D.items || []).slice();
  if (isTeqany) {
    FEATURED_TQ.forEach(function(feat){
      if (!items.some(function(x){ return x.id === feat.id; })) items.unshift(feat);
    });
  }
  if (!cat || cat === 'all') return items.length;
  if (cat === 'mine') return items.filter(function(x){ return !x.isFeatured; }).length;
  return items.filter(function(x){ return x.cat === cat; }).length;
}

function card(it){
  var imgs = (it.files || []).filter(isImg), docs = (it.files || []).filter(function(f){ return !isImg(f); });
  var isFeat = !!it.isFeatured;

  var h = '<article class="in-card' + (isFeat ? ' feat-card' : '') + '" data-id="' + it.id + '" style="' + (isFeat ? 'border-inline-start:5px solid var(--brand,#0e7c66);background:color-mix(in srgb,var(--brand,#0e7c66) 3%,var(--paper,#fff));' : '') + '">';
  h += '<header class="in-h"><div>';
  if (isFeat) {
    h += '<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px"><span class="chip strong" style="background:#0e7c66;color:#fff;border-radius:999px;padding:2px 10px;font-size:.78rem">مبادرة معتمدة</span><span class="chip" style="font-size:.78rem">' + esc(it.badge || 'العلوم') + '</span></div>';
  }
  h += '<h3>' + esc(it.title) + '</h3>';
  h += '<div class="muted" style="font-size:.84rem;margin-top:2px">';
  h += '<b>' + esc(it.teacher || '—') + '</b>';
  if (it.supervisor) h += ' · <span style="color:var(--brand,#0e7c66)">إشراف: ' + esc(it.supervisor) + '</span>';
  if (!isFeat) h += ' · ' + fmtDate(it.created_at);
  h += ' · ' + (it.files || []).length + ' إثباتات ووسائط';
  h += '</div></div>';

  h += '<div class="in-act">';
  if (!isFeat && it.mine) h += '<button type="button" class="btn small" data-ed="' + it.id + '">✎ تعديل</button>';
  h += '<button type="button" class="btn small" data-pr="' + it.id + '">🖨 طباعة</button>';
  if (!isFeat && (it.mine || D.admin)) h += '<button type="button" class="x" data-del="' + it.id + '" title="حذف">×</button>';
  h += '</div></header>';

  if (it.video) {
    h += '<div class="in-vid-wrap" style="margin:12px 0 16px;background:#000;border-radius:12px;overflow:hidden;box-shadow:0 3px 12px rgba(0,0,0,.15)">';
    h += '<div style="padding:8px 12px;background:#182824;color:#fff;font-size:.82rem;font-weight:600;display:flex;align-items:center;gap:6px">🎬 <span>برومو تقني حذيفة الترويجي</span></div>';
    h += '<video controls playsinline preload="metadata" src="' + it.video + '" poster="/promo/teqany_poster.jpg" style="width:100%;max-height:420px;display:block"></video>';
    h += '</div>';
  }

  if (it.app_link) {
    h += '<div style="margin:12px 0 16px;padding:12px 16px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">'
      + '<div><b style="color:#0369a1;display:block">🌐 رابط المنظومة والتطبيق السحابي المباشر:</b><span style="font-size:.86rem;color:#0284c7" dir="ltr">' + esc(it.app_link) + '</span></div>'
      + '<a href="' + esc(it.app_link) + '" target="_blank" rel="noopener" class="btn small" style="background:#0284c7;color:#fff;font-weight:700;text-decoration:none;border-radius:6px;padding:6px 16px">دخول المنظومة ↗</a>'
      + '</div>';
  }

  if (it.summary) h += '<section style="margin-top:10px"><h4 style="margin:0 0 4px;font-size:.95rem;color:var(--brand,#0e7c66)">نبذة عن المبادرة</h4><p style="margin:0;line-height:1.7">' + nl(it.summary) + '</p></section>';
  if (it.goals) h += '<section style="margin-top:10px"><h4 style="margin:0 0 4px;font-size:.95rem;color:var(--brand,#0e7c66)">أهداف المبادرة</h4><p style="margin:0;line-height:1.7">' + nl(it.goals) + '</p></section>';
  if (it.steps) h += '<section style="margin-top:10px"><h4 style="margin:0 0 4px;font-size:.95rem;color:var(--brand,#0e7c66)">إجراءات التنفيذ</h4><p style="margin:0;line-height:1.7">' + nl(it.steps) + '</p></section>';
  if (it.impact) h += '<section style="margin-top:10px"><h4 style="margin:0 0 4px;font-size:.95rem;color:var(--brand,#0e7c66)">مؤشرات الأثر ونواتج التعلم</h4><p style="margin:0;line-height:1.7">' + nl(it.impact) + '</p></section>';

  if ((it.files || []).length) {
    h += '<section style="margin-top:12px"><h4 style="margin:0 0 6px;font-size:.95rem;color:var(--brand,#0e7c66)">الملصقات والشواهد (' + it.files.length + ')</h4>';
    if (imgs.length) {
      h += '<div class="in-ph" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">';
      h += imgs.map(function(f, idx){
        var srcAttr = f.src ? 'src="' + f.src + '"' : 'data-src="' + f.id + '"';
        return '<button type="button" class="in-th" data-img-idx="' + idx + '" title="' + esc(f.name) + '" style="aspect-ratio:3/4;overflow:hidden;border:1px solid var(--line);border-radius:10px;cursor:zoom-in;background:#f3f3f3;padding:0">' +
          '<img alt="' + esc(f.name) + '" ' + srcAttr + ' style="width:100%;height:100%;object-fit:cover">' +
          '</button>';
      }).join('');
      h += '</div>';
    }
    if (docs.length) {
      h += '<div class="in-docs">' + docs.map(function(f){ return '<button type="button" class="btn small" data-doc="' + f.id + '">📄 ' + esc(f.name) + ' <small>(' + fmtSize(f.size) + ')</small></button>'; }).join('') + '</div>';
    }
    h += '</section>';
  }

  return h + '</article>';
}

function byId(id){
  var all = (D.items || []).concat(FEATURED_TQ);
  return all.filter(function(x){ return String(x.id) === String(id); })[0];
}

function bindCards(root){
  Array.prototype.forEach.call(root.querySelectorAll('img[data-src]'), function(im){
    fileUrl(im.getAttribute('data-src')).then(function(u){ im.src = u; }, function(){ im.alt = 'تعذّر التحميل'; });
  });

  Array.prototype.forEach.call(root.querySelectorAll('[data-img-idx]'), function(b){
    b.onclick = function(){
      var cardEl = b.closest('.in-card');
      var it = byId(cardEl.getAttribute('data-id'));
      var imgs = (it.files || []).filter(isImg);
      var idx = +b.getAttribute('data-img-idx');
      viewer(imgs, idx);
    };
  });

  Array.prototype.forEach.call(root.querySelectorAll('[data-doc]'), function(b){
    b.onclick = function(){
      var w = window.open('', '_blank');
      fileUrl(b.getAttribute('data-doc')).then(function(u){ if(w) w.location.href = u; else location.href = u; }, function(e){ if(w) w.close(); toast(e.message); });
    };
  });

  Array.prototype.forEach.call(root.querySelectorAll('[data-ed]'), function(b){
    b.onclick = function(){ edit(byId(b.getAttribute('data-ed'))); };
  });

  Array.prototype.forEach.call(root.querySelectorAll('[data-pr]'), function(b){
    b.onclick = function(){ printIt(byId(b.getAttribute('data-pr'))); };
  });

  Array.prototype.forEach.call(root.querySelectorAll('[data-del]'), function(b){
    b.onclick = function(){
      var it = byId(b.getAttribute('data-del'));
      dialog({title:'حذف المبادرة؟',message:'ستُحذف «'+it.title+'» وكل إثباتاتها نهائيًا.',okText:'حذف',danger:true}).then(function(ok){
        if(ok) api('/api/init/'+it.id,null,'DELETE').then(function(){ toast('حُذفت المبادرة'); load(); }, function(e){ toast(e.message); });
      });
    };
  });
}

function viewer(imgs, initialIndex){
  var i = Math.max(0, Math.min(imgs.length - 1, initialIndex || 0));
  var o = document.createElement('div');
  o.className = 'in-view';
  o.setAttribute('role', 'dialog');
  o.setAttribute('aria-label', 'عرض الإثبات');
  o.innerHTML = '<button type="button" class="in-vx" aria-label="إغلاق">×</button>' +
    (imgs.length > 1 ? '<button type="button" class="in-vn in-vp" aria-label="السابق">›</button><button type="button" class="in-vn in-vnx" aria-label="التالي">‹</button>' : '') +
    '<figure><img alt=""><figcaption></figcaption></figure>';
  document.body.appendChild(o);
  var im = o.querySelector('img'), cap = o.querySelector('figcaption');

  function show(){
    var f = imgs[i];
    cap.textContent = f.name + (imgs.length > 1 ? '  ·  ' + (i + 1) + ' / ' + imgs.length : '');
    im.removeAttribute('src');
    fileUrl(f).then(function(u){ im.src = u; });
  }

  function close(){ document.removeEventListener('keydown', key); o.remove(); }
  function key(e){
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') { i = (i + 1) % imgs.length; show(); }
    else if (e.key === 'ArrowRight') { i = (i - 1 + imgs.length) % imgs.length; show(); }
  }

  o.onclick = function(e){ if (e.target === o || e.target.classList.contains('in-vx')) close(); };
  if (imgs.length > 1) {
    o.querySelector('.in-vp').onclick = function(){ i = (i - 1 + imgs.length) % imgs.length; show(); };
    o.querySelector('.in-vnx').onclick = function(){ i = (i + 1) % imgs.length; show(); };
  }
  document.addEventListener('keydown', key);
  show();
}

function shrink(file){
  return new Promise(function(res){
    if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size<350000)return res(file);
    var u=URL.createObjectURL(file),im=new Image();
    im.onload=function(){
      var M=1800,w=im.naturalWidth,h=im.naturalHeight,k=Math.min(1,M/Math.max(w,h));
      var c=document.createElement('canvas');c.width=Math.round(w*k);c.height=Math.round(h*k);
      var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);
      c.toBlob(function(b){if(!b||b.size>=file.size)return res(file);b.name=file.name.replace(/\.[a-z0-9]+$/i,'')+'.jpg';res(b);},'image/jpeg',.85);
    };
    im.onerror=function(){URL.revokeObjectURL(u);res(file);};im.src=u;
  });
}

function upload(iid,file){
  return shrink(file).then(function(b){
    var h=hdrs();h['Content-Type']=b.type||file.type;h['X-File-Name']=encodeURIComponent(b.name||file.name||'ملف');
    return fetch('/api/init/'+iid+'/file',{method:'POST',credentials:'same-origin',headers:h,body:b}).then(function(r){return r.json().catch(function(){return {};}).then(function(j){if(!r.ok)throw new Error(j.error||'تعذّر رفع الملف');return j;});});
  });
}
var OK_TYPE=/^(image\/(jpeg|png|webp|gif)|application\/pdf)$/;

function edit(it){
  var cur=(it&&it.files||[]).slice(),pend=[],gone=[];
  var h='<div class="an-head"><h2>'+(it?'تعديل مبادرة: '+esc(it.title):'مبادرة جديدة')+'</h2><p class="muted">أدخل عنوان المبادرة ونبذة عنها وأهدافها، وأرفق إثباتاتها من صور أو ملفات PDF.</p></div>';
  h+='<form id="inForm" class="in-form"><label>عنوان المبادرة *<input type="text" id="inTitle" required maxlength="200" placeholder="مثال: مبادرة القراءة الممتعة" value="'+esc(it?it.title:'')+'"></label>';
  h+='<label>نبذة عن المبادرة<textarea id="inSum" rows="4" placeholder="فكرة المبادرة، المستهدفون، نطاق تطبيقها…">'+esc(it?it.summary:'')+'</textarea></label>';
  h+='<label>ماذا تهدف المبادرة؟<textarea id="inGoals" rows="4" placeholder="الأهداف الإجرائية، نواتج التعلم المتوقعة، الأثر…">'+esc(it?it.goals:'')+'</textarea></label>';
  h+='<div class="in-drop" id="inDrop"><input type="file" id="inFile" multiple accept="image/*,application/pdf" hidden>'+
    '<p>اسحب الصور أو ملفات PDF هنا، أو <button type="button" class="btn small" onclick="$(\'inFile\').click()">اختر ملفات من جهازك</button></p>'+
    '<small class="muted">تُقبل الصور (JPEG / PNG / WebP) وملفات PDF (بحد 6 م.ب للملف، وحتى 20 ملفًا).</small></div>';
  h+='<div id="inPend" class="in-pend"></div>';
  h+='<div class="err-box" id="inErr" hidden></div>';
  h+='<div class="in-form-act"><button type="submit" class="btn primary" id="inSave">حفظ المبادرة</button><button type="button" class="btn" id="inCancel">إلغاء</button></div></form>';
  $('inMain').innerHTML=h;

  function draw(){
    var x=cur.map(function(f){return '<span class="in-pi old">'+(isImg(f)?'<img data-src="'+f.id+'" alt="">':'<em>📄</em>')+'<small>'+esc(f.name)+'</small><button type="button" class="x" data-rm-old="'+f.id+'" title="حذف">×</button></span>';}).join('')+
      pend.map(function(f,k){return '<span class="in-pi new">'+(/^image\//.test(f.type)?'<img src="'+f._u+'" alt="">':'<em>📄</em>')+'<small>'+esc(f.name)+'</small><button type="button" class="x" data-rm-new="'+k+'" title="إزالة">×</button></span>';}).join('');
    $('inPend').innerHTML=x;
    Array.prototype.forEach.call($('inPend').querySelectorAll('img[data-src]'),function(im){fileUrl(im.getAttribute('data-src')).then(function(u){im.src=u;});});
    Array.prototype.forEach.call($('inPend').querySelectorAll('[data-rm-old]'),function(b){b.onclick=function(){var id=+b.getAttribute('data-rm-old');gone.push(id);cur=cur.filter(function(f){return f.id!==id;});draw();};});
    Array.prototype.forEach.call($('inPend').querySelectorAll('[data-rm-new]'),function(b){b.onclick=function(){var f=pend.splice(+b.getAttribute('data-rm-new'),1)[0];if(f&&f._u)URL.revokeObjectURL(f._u);draw();};});
  }
  function add(files){
    var bad=0;Array.prototype.forEach.call(files||[],function(f){
      if(!OK_TYPE.test(f.type)){bad++;return;}
      if(f.type==='application/pdf'&&f.size>6*1048576){toast('«'+f.name+'» أكبر من 6 م.ب');return;}
      if(cur.length+pend.length>=20){bad++;return;}
      if(/^image\//.test(f.type))f._u=URL.createObjectURL(f);pend.push(f);});
    if(bad)toast('تُقبل الصور وملفات PDF فقط، وبحد 20 ملفًا');draw();
  }
  $('inFile').onchange=function(){add(this.files);this.value='';};
  var dr=$('inDrop');
  dr.ondragover=function(e){e.preventDefault();dr.classList.add('on');};dr.ondragleave=function(){dr.classList.remove('on');};
  dr.ondrop=function(e){e.preventDefault();dr.classList.remove('on');add(e.dataTransfer.files);};
  $('inCancel').onclick=function(){pend.forEach(function(f){if(f._u)URL.revokeObjectURL(f._u);});render();};
  $('inForm').onsubmit=function(e){
    e.preventDefault();var er=$('inErr');er.hidden=true;
    var t=$('inTitle').value.trim();if(!t){er.textContent='اكتب عنوان المبادرة.';er.hidden=false;$('inTitle').focus();return;}
    var btn=$('inSave');btn.disabled=true;btn.textContent='جارٍ الحفظ…';
    api('/api/init',{id:it?it.id:0,title:t,summary:$('inSum').value,goals:$('inGoals').value}).then(function(r){
      var iid=r.id,fail=[];
      var chain=gone.reduce(function(p,id){return p.then(function(){return api('/api/init/file/'+id,null,'DELETE').catch(function(){});});},Promise.resolve());
      pend.forEach(function(f,k){chain=chain.then(function(){btn.textContent='رفع الإثباتات '+(k+1)+' / '+pend.length+'…';return upload(iid,f).catch(function(e){fail.push(f.name+': '+e.message);});});});
      return chain.then(function(){
        pend.forEach(function(f){if(f._u)URL.revokeObjectURL(f._u);});
        if(fail.length)dialog({title:'لم تُرفع بعض الملفات',message:fail.join('\n'),okText:'حسنًا'});
        else toast(it?'حُفظت التعديلات':'أُضيفت المبادرة ✓');
        return load();
      });
    }).catch(function(e){er.textContent=e.message;er.hidden=false;btn.disabled=false;btn.textContent='حفظ المبادرة';});
  };
  draw();$('inTitle').focus();
}

function printIt(it){
  var imgs=(it.files||[]).filter(isImg);
  Promise.all(imgs.map(function(f){return fileUrl(f).catch(function(){return '';});})).then(function(us){
    var sh=schoolHdr(),head=OFFICIAL_HEAD({dir:sh.dir,school:sh.school,title:'مبادرة: '+it.title,line2:'العام الدراسي '+sh.year});
    var h='<div class="in-print">'+head+
      '<table class="in-pt"><tr><th>عنوان المبادرة</th><td>'+esc(it.title)+'</td></tr><tr><th>صاحب المبادرة</th><td>'+esc(it.teacher||'')+'</td></tr>'+
      (it.supervisor?'<tr><th>الإشراف</th><td>'+esc(it.supervisor)+'</td></tr>':'')+
      '<tr><th>تاريخ التوثيق</th><td>'+fmtDate(it.created_at)+'</td></tr></table>'+
      (it.summary?'<h3>نبذة عن المبادرة</h3><p>'+nl(it.summary)+'</p>':'')+
      (it.goals?'<h3>أهداف المبادرة</h3><p>'+nl(it.goals)+'</p>':'')+
      (it.steps?'<h3>إجراءات التنفيذ</h3><p>'+nl(it.steps)+'</p>':'')+
      (it.impact?'<h3>مؤشرات الأثر</h3><p>'+nl(it.impact)+'</p>':'')+
      (us.filter(Boolean).length?'<h3>الملصقات والشواهد</h3><div class="in-pph">'+us.filter(Boolean).map(function(u){return '<img src="'+u+'" alt="">';}).join('')+'</div>':'')+
      '</div>';
    $('printArea').innerHTML=h;
    setTimeout(function(){doPrint('مبادرة - '+it.title);},400);
  });
}

function load(){
  return api('/api/init').then(function(r){D=r;D.items=r.items||[];render();},function(e){
    if(isTeqany){ D={items:[],admin:false}; render(); }
    else $('inMain').innerHTML='<div class="in-empty">'+esc(e.message)+'</div>';
  });
}

api('/api/me').then(function(me){initNav(me);load();},function(e){
  if(isTeqany){ D={items:[],admin:false}; render(); }
  else $('inMain').innerHTML='<div class="in-empty">'+esc(e.message)+'</div>';
});
})();
