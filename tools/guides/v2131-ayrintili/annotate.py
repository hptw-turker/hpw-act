import json, os
from PIL import Image, ImageDraw, ImageFont
B=json.load(open('/tmp/k2/boxes.json')); S=1.5; OUT='/tmp/k2/img'; os.makedirs(OUT,exist_ok=True); LEG={}
try: F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26)
except Exception: F=ImageFont.load_default()
for name,bx in B.items():
    p=f'/tmp/k2/shots/{name}.png'
    if not os.path.exists(p): continue
    im=Image.open(p).convert('RGB'); d=ImageDraw.Draw(im); W,H=im.size; n=0; leg=[]
    for b in bx:
        if b['x'] is None: continue
        n+=1; x,y,w,h=[v*S for v in (b['x'],b['y'],b['w'],b['h'])]; x0,y0,x1,y1=max(0,x-6),max(0,y-6),min(W-1,x+w+6),min(H-1,y+h+6)
        d.rectangle([x0,y0,x1,y1],outline='#CF051E',width=3)
        cx,cy=max(22,x0-4),max(22,y0-4); d.ellipse([cx-22,cy-22,cx+22,cy+22],fill='#CF051E',outline='white',width=3)
        t=str(n); tw=d.textlength(t,font=F); d.text((cx-tw/2,cy-16),t,fill='white',font=F); leg.append((n,b['label']))
    im.save(f'{OUT}/{name}.jpg',quality=88); LEG[name]=leg
json.dump(LEG,open('/tmp/k2/legends.json','w'),ensure_ascii=False,indent=1); print(len(LEG),'görsel işaretlendi; toplam işaret', sum(len(v) for v in LEG.values()))
