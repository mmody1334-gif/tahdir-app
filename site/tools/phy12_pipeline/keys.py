import sys,pymupdf,numpy as np
from PIL import Image
pdf,f,l,pid,rot=sys.argv[1:6]; f,l,rot=int(f),int(l),int(rot)
d=pymupdf.open(pdf); ims=[]
for pn in range(f-1,l):
    p=d[pn]; pm=p.get_pixmap(matrix=pymupdf.Matrix(1.05,1.05),colorspace=pymupdf.csGRAY)
    im=Image.frombytes('L',(pm.width,pm.height),pm.samples)
    if rot: im=im.rotate(rot,expand=True)
    a=np.array(im); ink=a<170; r=np.where(ink.any(1))[0]; c=np.where(ink.any(0))[0]
    if len(r): im=im.crop((max(0,c.min()-5),max(0,r.min()-5),c.max()+5,r.max()+5))
    ims.append(im)
B='/tmp/claude-0/-home-claude/04728906-5d34-5942-a349-b29d76cc71c6/scratchpad/phy12/keys/'
k=0
for i in range(0,len(ims),2):
    g=ims[i:i+2]; w=max(x.width for x in g); c=Image.new('L',(w,sum(x.height for x in g)+10*(len(g)-1)),255); y=0
    for x in g: c.paste(x,(0,y)); y+=x.height+10
    k+=1; c.save(f'{B}{pid}-{k:02d}.png'); print(pid,k,c.size)
