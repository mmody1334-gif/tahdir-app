import json,re
R=json.load(open('raw.json'))[:27]
STRAT=['الحوار والمناقشة','الاستقصاء','العصف الذهني','المحاكاة الحاسوبية','التعلم التعاوني','شكل (7) المعرفي','تمثيل الأدوار','القصة','تنبأ، لاحظ، فسّر','الاستكشاف الاستقرائي','القياس','حل المشكلات','الخرائط الذهنية','التعلم باللعب','التعلم بالأقران']
def strategies(t):
    out=[]
    for ln in t.split('\n'):
        s=ln.strip()
        if not s: continue
        if s.startswith('أخرى') or s.startswith('....'):
            x=re.sub(r'أخرى:?','',s); x=re.sub(r'[\d\(\)\.\-_]+',' ',x)
            for part in re.split(r'\+|،|,',x):
                p=re.sub(r'\s+',' ',part).strip(' :')
                if len(p)>3: out.append(p)
            continue
        if re.search(r'\d',s.split(')')[0] if ')' in s else s[:12]) or re.match(r'^\(?\s*\d',s):
            name=re.sub(r'^[\(\s\d\-/\.\+]*\)?','',s); name=re.sub(r'[\(\)\d\-/]+',' ',name).strip(' .،,'); name=re.sub(r'\s+',' ',name)
            if name: out.append(name)
    fix={'تنبأ، فسر، لاحظ، فسر':'تنبأ، لاحظ، فسّر','تنبأ، فسر، لاحظ،':'تنبأ، لاحظ، فسّر','تنبأ، فسر، لاحظ':'تنبأ، لاحظ، فسّر'}
    res=[]
    for o in out:
        o=fix.get(o,o).replace('الذكاء الاصطناعي','المختبر الافتراضي')
        if o not in res: res.append(o)
    return '، '.join(res)
def clean(t):
    t=t.replace('‏','').replace('‎','')
    t=re.sub(r'\.{4,}',' ',t); t=re.sub(r'[ \t]+',' ',t)
    lines=[l.strip(' -*') for l in t.split('\n')]
    lines=[l for l in lines if l and l not in ('.','-','؟')]
    return '\n'.join(lines).strip()
out=[]
for i,l in enumerate(R):
    rows=l['rows']; k=next(j for j,r in enumerate(rows) if r[0].startswith('الأهداف/ المخرجات'))
    pre=rows[k-1][1] if len(rows[k-1])>1 else ''
    o=rows[k+1]+['']*4; ev=(rows[k+3] if len(rows)>k+3 and not rows[k+3][0].startswith('ملاحظات') else ['']*4)+['']*4
    out.append({'i':i,'pre_learning':clean(pre),'outcomes':clean(o[0]),'strategies':strategies(o[1]),'activities_teach':clean(o[2]),'resources':clean(o[3]),
                'formative':clean(ev[0]),'enrich':clean(ev[1]),'closing':clean(ev[2]),'homework':clean(ev[3])})
json.dump(out,open('auto.json','w'),ensure_ascii=False,indent=1)
for x in out: print(x['i'],'|',x['strategies'][:150],'| CLO:',x['closing'][:60].replace('\n',' / '),'| HW:',x['homework'][:70].replace('\n',' / '))
