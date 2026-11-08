import sys, json, glob, os
from pptx import Presentation
from pptx.util import Emu
src, out = sys.argv[1], sys.argv[2]
for f in sorted(glob.glob(os.path.join(src,'*.pptx'))):
    p = Presentation(f); slides=[]
    for i,s in enumerate(p.slides,1):
        items=[]
        def walk(shs, gx=0, gy=0):
            for sh in shs:
                if sh.shape_type==6:  # group
                    walk(sh.shapes); continue
                d={'x':int(sh.left or 0)//12700,'y':int(sh.top or 0)//12700,'w':int(sh.width or 0)//12700,'h':int(sh.height or 0)//12700,'name':sh.name}
                if sh.has_text_frame and sh.text_frame.text.strip(): d['t']=sh.text_frame.text
                if getattr(sh,'has_table',False) and sh.has_table: d['table']=[[c.text for c in r.cells] for r in sh.table.rows]
                if getattr(sh,'has_chart',False) and sh.has_chart:
                    ch=sh.chart; d['chart']={'cats':list(ch.plots[0].categories) if ch.plots else [], 'series':[{'name':se.name,'vals':list(se.values)} for pl in ch.plots for se in pl.series]}
                if len(d)>5: items.append(d)
        walk(s.shapes)
        notes = s.notes_slide.notes_text_frame.text if s.has_notes_slide else ''
        slides.append({'n':i,'items':items,'notes':notes})
    name=os.path.basename(f).replace('Ant_Yapi_','').replace('_Birim_Raporu_2026.pptx','')
    json.dump(slides, open(os.path.join(out,name+'.json'),'w'), ensure_ascii=False, indent=0)
    print(name, len(slides))
