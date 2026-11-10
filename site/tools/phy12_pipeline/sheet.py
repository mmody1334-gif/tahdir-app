import sys,json,os
from PIL import Image,ImageDraw
d,pid,a,b,out=sys.argv[1:6]; a,b=int(a),int(b)
its=json.load(open(f'{d}/{pid}.json'))[a:b]
ims=[]
for it in its:
    im=Image.open(f'{d}/{it["file"]}').convert('RGB'); k=420/im.width; im=im.resize((420,max(1,int(im.height*k))))
    c=Image.new('RGB',(430,im.height+22),'white'); c.paste(im,(5,20)); ImageDraw.Draw(c).text((5,3),f"Q{it['n']} m={it['m']} p{it['page']} parts={it['parts']}",fill='red'); ims.append(c)
# pack into columns of height<=1500
cols=[[]];h=0
for c in ims:
    if h+c.height>1500 and cols[-1]: cols.append([]);h=0
    cols[-1].append(c);h+=c.height
W=430*len(cols);H=max(sum(c.height for c in col) for col in cols)
can=Image.new('RGB',(W,H),'white')
for i,col in enumerate(cols):
    y=0
    for c in col: can.paste(c,(i*430,y)); y+=c.height
can.save(out); print(can.size)
