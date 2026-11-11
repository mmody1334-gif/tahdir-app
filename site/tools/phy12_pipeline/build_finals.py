import json,sys,os,hashlib,importlib
from PIL import Image
W=sys.argv[1]; ROOT='/root/tahdir-app/site'
sys.path.insert(0,W+'/fin')
sys.path.insert(0,W+'/prep'); from manual import UNITS
OUT=ROOT+'/finals/img/phy12'; os.makedirs(OUT,exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT,f))
papers={}; qs=[]
for f in ['d2324_1','d2324_2','d2425_1','d2425_2','d2526_1','d2526_2']:
    m=importlib.import_module(f); P=m.P
    pid='phy12-'+P['year'][2:4]+P['year'][7:9]+'-'+('0' if 'الأول' in P['session'] else '1')
    papers[pid]={'year':P['year'],'term':1,'session':P['session'],'region':'','total':P['total']}
    cut={i['n']:i for i in json.load(open(f"{W}/ex/{P['id']}/{P['id']}.json"))}
    for n,(mk,ao,codes,l,l2,t,x,a) in sorted(m.Q.items()):
        qid=hashlib.md5(f'phy12|{pid}|{n}'.encode()).hexdigest()[:10]
        im=Image.open(f"{W}/ex/{P['id']}/{cut[n]['file']}").convert('L')
        if im.width>1000: im=im.resize((1000,round(im.height*1000/im.width)),Image.LANCZOS)
        im.save(f'{OUT}/{qid}.webp','WEBP',quality=82,method=6)
        cs=[c.strip() for c in codes.split('؛')]
        qs.append({'id':qid,'p':pid,'n':str(n),'m':mk,'t':t,'x':x,'a':a,'as':'ms','c':'، '.join(cs),
                   'ao':'AO1، AO2' if '؛' in ao else ao,'u':cs[0].split('-')[0],'l':l,'l2':l2,
                   'im':f'phy12/{qid}.webp','w':im.width,'h':im.height})
p=ROOT+'/data/finals.json'; raw=open(p,encoding='utf-8').read(); F=json.loads(raw)
F['الفيزياء|الثاني عشر']={'subject':'الفيزياء','grade':'الثاني عشر','units':UNITS,'papers':papers,'q':qs}
open(p,'w',encoding='utf-8').write(json.dumps(F,ensure_ascii=False,separators=(',',':')) if '\n' not in raw[:500] else json.dumps(F,ensure_ascii=False,indent=1))
print(len(papers),'papers',len(qs),'questions', sum(os.path.getsize(os.path.join(OUT,f)) for f in os.listdir(OUT))//1024,'KB')
