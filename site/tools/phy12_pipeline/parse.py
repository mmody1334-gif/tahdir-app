import docx,re,json
from docx.oxml.ns import qn
def ptext(p):
    out=[]
    for el in p.iter():
        if el.tag in (qn('w:t'),qn('m:t')): out.append(el.text or '')
        elif el.tag in (qn('w:br'),qn('w:cr')): out.append('\n')
        elif el.tag==qn('w:tab'): out.append(' ')
    return ''.join(out)
def ctext(c):
    ps=[ptext(p) for p in c._tc.iter(qn('w:p'))]
    t='\n'.join(x.strip() for x in ps)
    t=re.sub(r'[ \t ]+',' ',t); t=re.sub(r'\n\s*\n+','\n',t).strip()
    return t
def ucells(r):
    seen=[];out=[]
    for c in r.cells:
        if c._tc in seen: continue
        seen.append(c._tc); out.append(c)
    return out
res=[]
for n in (1,2):
    d=docx.Document(f'prep{n}.docx'); cur=None
    for t in d.tables:
        r0=[ctext(c) for c in ucells(t.rows[0])]
        j=' | '.join(r0)
        if 'عنوان الدرس' in j:
            cur={'file':n,'head':r0,'rows':[]}; res.append(cur); continue
        if cur is None: continue
        for r in t.rows:
            cs=[ctext(c) for c in ucells(r)]
            if any(cs[1:]) or cs[0]: cur['rows'].append(cs)
json.dump(res,open('raw.json','w'),ensure_ascii=False,indent=1)
for i,l in enumerate(res):
    print(i,l['head'][-1][:70].replace('\n',' '),'| rows',len(l['rows']),'| chars',sum(len(c) for r in l['rows'] for c in r))
