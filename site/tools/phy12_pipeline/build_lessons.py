import json,re,sys
sys.path.insert(0,'.')
from manual import L as M, UNITS
A=json.load(open('auto.json'))
def tidy(t):
    lines=[]
    for ln in t.split('\n'):
        if 'يعتمد' in ln: continue
        ln=re.sub(r'^[\.\)\s]+(?=[\(\d])','',ln).strip()
        ln=ln.replace('☹','(').replace('ك-ط','كتاب الطالب').replace('ك-ن','كتاب النشاط').replace('ك_ط','كتاب الطالب')
        if ln: lines.append(ln)
    return '\n'.join(lines)
out=[]; no={}
for i,(a,m) in enumerate(zip(A,M)):
    u=m['unit']; no[u]=no.get(u,0)+1
    ai=['concepts','misconceptions','hw_q1','hw_a1','hw_q2','hw_a2']
    l={'grade':'الثاني عشر','unit':u,'unit_name':UNITS[u],'title':m['title'],'id':2400+i,'ai_filled':None,'subject':'الفيزياء','term':1,
       'lesson_no':no[u],'src':'phy12','code':m['code'],'review':False}
    for k in ('concepts','pre_learning','outcomes','strategies','activities_teach','resources','formative','enrich','closing','homework','misconceptions','hw_q1','hw_a1','hw_q2','hw_a2'):
        v=m.get(k) if k in m else tidy(a.get(k,''))
        if k in ('closing','homework') and k in m: ai.append(k)
        l[k]=v
    l['ai_filled']=ai
    out.append(l)
json.dump(out,open('phy12_lessons.json','w'),ensure_ascii=False,indent=1)
for l in out: print(l['id'],l['code'],l['lesson_no'],l['title'],'| HW:',l['homework'][:60].replace('\n',' / '))
