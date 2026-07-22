# -*- coding: utf-8 -*-
import os, math
from fontTools.ttLib import TTFont as FTFont, TTCollection
from fontTools.subset import Subsetter, Options
from otf2ttf.cli import otf_to_ttf

# ===== 1) 폰트 준비 (Noto Sans KR 서브셋 -> TTF 임베드) =====
SRC=open(__file__,encoding='utf-8').read()
CHARSET=sorted({ord(c) for c in SRC if ord(c)>=32})
for ex in "①②③④⑤▪→✓·—₩…“”‘’◆●":
    if ord(ex) not in CHARSET: CHARSET.append(ord(ex))
def kr_index(p,fam="Noto Sans CJK KR"):
    coll=TTCollection(p,lazy=True)
    for i,f in enumerate(coll.fonts):
        if (f['name'].getDebugName(1) or '')==fam: return i
    return 1
def prep(ttc,out):
    f=FTFont(ttc,fontNumber=kr_index(ttc)); o=Options()
    o.glyph_names=True; o.layout_features=[]; o.name_IDs=['*']; o.notdef_outline=True; o.recalc_bounds=True
    ss=Subsetter(options=o); ss.populate(unicodes=CHARSET); ss.subset(f); otf_to_ttf(f); f.save(out); return out
prep("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc","/tmp/NKR-R.ttf")
prep("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc","/tmp/NKR-B.ttf")

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, Table, TableStyle, Flowable
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

pdfmetrics.registerFont(TTFont('KR',"/tmp/NKR-R.ttf"))
pdfmetrics.registerFont(TTFont('KRB',"/tmp/NKR-B.ttf"))
pdfmetrics.registerFontFamily('KR',normal='KR',bold='KRB',italic='KR',boldItalic='KRB')
R,B='KR','KRB'

PURPLE=colors.HexColor('#6D28D9'); PURPLE2=colors.HexColor('#8B5CF6')
PINK=colors.HexColor('#DB2777'); AMBER=colors.HexColor('#F59E0B'); ORANGE=colors.HexColor('#EA580C')
GREEN=colors.HexColor('#059669'); BLUE=colors.HexColor('#2563EB')
INK=colors.HexColor('#111827'); GRAY=colors.HexColor('#6B7280'); GRAY2=colors.HexColor('#9CA3AF')
ZEBRA=colors.HexColor('#FAFAFC'); LINE=colors.HexColor('#E7E5EE'); DARK=colors.HexColor('#0B0716'); DARK2=colors.HexColor('#1B1030')
A4w,A4h=A4
MX=20*mm; CW=A4w-40*mm; TOP=A4h-20*mm; BOT=18*mm
def al(c,a): return colors.Color(c.red,c.green,c.blue,alpha=a)
def hx(c): return '#%02x%02x%02x'%(int(c.red*255),int(c.green*255),int(c.blue*255))

PS=lambda **k: ParagraphStyle('s',**k)
def para(t,size=10,lead=16.5,color=INK,font=R,align=TA_LEFT,sa=0):
    return Paragraph(t,PS(fontName=font,fontSize=size,leading=lead,textColor=color,alignment=align,spaceAfter=sa))
def bullets(items,color=PURPLE,size=10):
    return [Paragraph(f'<font color="{hx(color)}">▪</font>&nbsp; {it}',PS(fontName=R,fontSize=size,leading=15.5,textColor=INK,leftIndent=12,spaceAfter=4)) for it in items]

# ===== line icons =====
def _su(c,col): c.setStrokeColor(col); c.setLineWidth(1.5); c.setLineCap(1); c.setLineJoin(1); c.setFillColor(col)
def glyph(c,name,x,y,s,col):
    c.saveState(); _su(c,col)
    p=s*0.24; ix=x+p; iy=y+p; m=s-2*p; cx=x+s/2; cy=y+s/2
    if name=='doc':
        c.roundRect(ix,iy,m*0.8,m,1.5,stroke=1,fill=0)
        for k in range(3): yy=iy+m*0.72-k*m*0.26; c.line(ix+m*0.15,yy,ix+m*0.6,yy)
    elif name=='megaphone':
        c.lines([(ix,cy-m*0.15,ix,cy+m*0.15),(ix,cy+m*0.15,ix+m*0.55,cy+m*0.35),(ix+m*0.55,cy+m*0.35,ix+m*0.55,cy-m*0.35),(ix+m*0.55,cy-m*0.35,ix,cy-m*0.15)]); c.line(ix+m*0.7,cy+m*0.1,ix+m,cy+m*0.25); c.line(ix+m*0.7,cy,ix+m,cy)
    elif name=='film':
        c.roundRect(ix,iy,m,m,1.5,stroke=1,fill=0); c.line(ix+m*0.32,iy,ix+m*0.32,iy+m); c.line(ix+m*0.68,iy,ix+m*0.68,iy+m)
    elif name=='cart':
        c.line(ix,iy+m*0.85,ix+m*0.2,iy+m*0.85); c.line(ix+m*0.2,iy+m*0.85,ix+m*0.34,iy+m*0.3); c.line(ix+m*0.34,iy+m*0.3,ix+m,iy+m*0.3); c.line(ix+m,iy+m*0.3,ix+m*0.86,iy+m*0.62); c.line(ix+m*0.34,iy+m*0.62,ix+m*0.92,iy+m*0.62); c.circle(ix+m*0.42,iy+m*0.12,m*0.09,stroke=1,fill=0); c.circle(ix+m*0.86,iy+m*0.12,m*0.09,stroke=1,fill=0)
    elif name=='play': c.lines([(ix+m*0.2,iy,ix+m*0.2,iy+m),(ix+m*0.2,iy+m,ix+m,cy),(ix+m,cy,ix+m*0.2,iy)])
    elif name=='users':
        c.circle(ix+m*0.32,iy+m*0.7,m*0.18,stroke=1,fill=0); c.circle(ix+m*0.68,iy+m*0.7,m*0.18,stroke=1,fill=0); c.arc(ix+m*0.06,iy,ix+m*0.58,iy+m*0.5,startAng=20,extent=140); c.arc(ix+m*0.42,iy,ix+m*0.94,iy+m*0.5,startAng=20,extent=140)
    elif name=='chart':
        c.line(ix,iy,ix,iy+m); c.line(ix,iy,ix+m,iy)
        for k,h in enumerate([0.4,0.7,0.55,0.95]): bx=ix+m*0.18+k*m*0.22; c.line(bx,iy,bx,iy+m*h)
    elif name=='building':
        c.roundRect(ix+m*0.2,iy,m*0.6,m,1,stroke=1,fill=0)
        for r in range(3):
            for cc in range(2): wx=ix+m*0.32+cc*m*0.22; wy=iy+m*0.2+r*m*0.25; c.rect(wx,wy,m*0.12,m*0.12,stroke=1,fill=0)
    elif name=='star':
        pts=[]; 
        for k in range(10): ang=math.pi/2+k*math.pi/5; rr=m*0.5 if k%2==0 else m*0.22; pts.append((cx+rr*math.cos(ang),cy+rr*math.sin(ang)))
        c.lines([(pts[k][0],pts[k][1],pts[(k+1)%10][0],pts[(k+1)%10][1]) for k in range(10)])
    elif name=='link':
        c.roundRect(ix,iy+m*0.28,m*0.55,m*0.32,m*0.16,stroke=1,fill=0); c.roundRect(ix+m*0.45,iy+m*0.4,m*0.55,m*0.32,m*0.16,stroke=1,fill=0)
    elif name=='flow':
        c.circle(ix+m*0.12,cy,m*0.1,stroke=1,fill=0); c.circle(cx,cy,m*0.1,stroke=1,fill=0); c.circle(ix+m*0.88,cy,m*0.1,stroke=1,fill=0); c.line(ix+m*0.24,cy,cx-m*0.1,cy); c.line(cx+m*0.12,cy,ix+m*0.76,cy)
    elif name=='globe':
        c.circle(cx,cy,m*0.5,stroke=1,fill=0); c.line(cx-m*0.5,cy,cx+m*0.5,cy); c.arc(cx-m*0.22,cy-m*0.5,cx+m*0.22,cy+m*0.5,startAng=90,extent=180); c.arc(cx-m*0.22,cy-m*0.5,cx+m*0.22,cy+m*0.5,startAng=270,extent=180)
    elif name=='target': c.circle(cx,cy,m*0.5,stroke=1,fill=0); c.circle(cx,cy,m*0.28,stroke=1,fill=0); c.circle(cx,cy,m*0.06,stroke=1,fill=1)
    elif name=='gear':
        c.circle(cx,cy,m*0.28,stroke=1,fill=0)
        for k in range(8): a=k*math.pi/4; c.line(cx+m*0.34*math.cos(a),cy+m*0.34*math.sin(a),cx+m*0.5*math.cos(a),cy+m*0.5*math.sin(a))
    elif name=='wallet':
        c.roundRect(ix,iy+m*0.1,m,m*0.7,2,stroke=1,fill=0); c.circle(ix+m*0.8,iy+m*0.45,m*0.07,stroke=1,fill=1)
    elif name=='check': c.circle(cx,cy,m*0.5,stroke=1,fill=0); c.lines([(ix+m*0.25,cy,cx-m*0.02,iy+m*0.32),(cx-m*0.02,iy+m*0.32,ix+m*0.8,iy+m*0.72)])
    elif name=='rocket':
        c.lines([(cx,iy+m,cx-m*0.22,iy+m*0.4),(cx-m*0.22,iy+m*0.4,cx,iy+m*0.18),(cx,iy+m*0.18,cx+m*0.22,iy+m*0.4),(cx+m*0.22,iy+m*0.4,cx,iy+m)]); c.circle(cx,iy+m*0.62,m*0.08,stroke=1,fill=0); c.line(cx-m*0.18,iy+m*0.1,cx-m*0.06,iy+m*0.3); c.line(cx+m*0.18,iy+m*0.1,cx+m*0.06,iy+m*0.3)
    elif name=='handshake':
        c.lines([(ix,cy,ix+m*0.3,cy+m*0.18),(ix+m*0.3,cy+m*0.18,cx,cy),(cx,cy,ix+m*0.7,cy+m*0.18),(ix+m*0.7,cy+m*0.18,ix+m,cy)])
    c.restoreState()

class IconBox(Flowable):
    def __init__(s,g,color=PURPLE,bs=11*mm): s.g=g; s.color=color; s.bs=bs; Flowable.__init__(s)
    def wrap(s,*a): return (s.bs,s.bs)
    def draw(s):
        c=s.canv; c.saveState(); c.setFillColor(al(s.color,0.12)); c.setStrokeColor(al(s.color,0.35)); c.setLineWidth(0.8)
        c.roundRect(0,0,s.bs,s.bs,s.bs*0.24,stroke=1,fill=1); glyph(c,s.g,0,0,s.bs,s.color); c.restoreState()

# ---- composite Flowables ----
class TitleBlock(Flowable):
    def __init__(s,kicker,title,g,color,center=True,sub=None):
        s.kicker=kicker; s.title=title; s.g=g; s.color=color; s.center=center; s.sub=sub; Flowable.__init__(s)
    def wrap(s,aw,ah): s.w=aw; s.h=(34*mm if s.sub else 30*mm); return (aw,s.h)
    def draw(s):
        c=s.canv; cx=s.w/2
        bs=12*mm
        # icon centered above
        gx=(s.w-bs)/2 if s.center else 0
        gy=s.h-bs
        c.saveState(); c.setFillColor(al(s.color,0.12)); c.setStrokeColor(al(s.color,0.35)); c.setLineWidth(0.8)
        c.roundRect(gx,gy,bs,bs,bs*0.24,stroke=1,fill=1); glyph(c,s.g,gx,gy,bs,s.color); c.restoreState()
        c.setFillColor(GRAY2); c.setFont(R,8.5)
        if s.center: c.drawCentredString(cx,gy-5*mm,s.kicker)
        else: c.drawString(0,gy-5*mm,s.kicker)
        c.setFillColor(s.color); c.setFont(B,18)
        if s.center: c.drawCentredString(cx,gy-12*mm,s.title)
        else: c.drawString(0,gy-12*mm,s.title)
        # accent rule
        if s.center:
            c.setStrokeColor(s.color); c.setLineWidth(2.2); c.setLineCap(1); c.line(cx-9*mm,gy-15.5*mm,cx+9*mm,gy-15.5*mm)

class KPIRow(Flowable):
    def __init__(s,cards,color,h=24*mm): s.cards=cards; s.color=color; s.hh=h; Flowable.__init__(s)
    def wrap(s,aw,ah): s.w=aw; return (aw,s.hh)
    def draw(s):
        c=s.canv; n=len(s.cards); gap=5*mm; bw=(s.w-gap*(n-1))/n
        for i,(big,lab) in enumerate(s.cards):
            x=i*(bw+gap)
            c.setFillColor(al(s.color,0.06)); c.setStrokeColor(al(s.color,0.25)); c.setLineWidth(0.8)
            c.roundRect(x,0,bw,s.hh,4,stroke=1,fill=1)
            c.setFillColor(s.color); c.setFont(B,15); c.drawCentredString(x+bw/2,s.hh-11*mm,big)
            c.setFillColor(GRAY); c.setFont(R,8.3)
            for j,ln in enumerate(simpleSplit(lab,R,8.3,bw-6*mm)[:2]):
                c.drawCentredString(x+bw/2,s.hh-15.5*mm-j*3.6*mm,ln)

class Callout(Flowable):
    def __init__(s,title,text,color,icon='check'): s.title=title; s.text=text; s.color=color; s.icon=icon; Flowable.__init__(s)
    def wrap(s,aw,ah):
        s.w=aw; s.lines=simpleSplit(s.text,R,9.5,aw-22*mm); s.h=12*mm+len(s.lines)*4.6*mm; return (aw,s.h)
    def draw(s):
        c=s.canv; c.setFillColor(al(s.color,0.07)); c.setStrokeColor(al(s.color,0.3)); c.setLineWidth(1)
        c.roundRect(0,0,s.w,s.h,5,stroke=1,fill=1)
        bs=8*mm; c.setFillColor(al(s.color,0.16)); c.roundRect(6*mm,s.h-bs-3*mm,bs,bs,2,stroke=0,fill=1); glyph(c,s.icon,6*mm,s.h-bs-3*mm,bs,s.color)
        c.setFillColor(s.color); c.setFont(B,10.5); c.drawString(16*mm,s.h-8*mm,s.title)
        c.setFillColor(INK); c.setFont(R,9.5)
        for j,ln in enumerate(s.lines): c.drawString(16*mm,s.h-12.5*mm-j*4.6*mm,ln)

class StepList(Flowable):
    def __init__(s,steps,color,title='자세한 진행 방법'):
        s.steps=steps; s.color=color; s.title=title; Flowable.__init__(s)
    def wrap(s,aw,ah):
        s.w=aw; s.lay=[]; s.titleh=7*mm; total=s.titleh
        for t,d in s.steps:
            dl=simpleSplit(d,R,9,aw-16*mm); h=5.4*mm+max(1,len(dl))*4.0*mm
            s.lay.append((t,dl,h)); total+=h+1.6*mm
        s.h=total; return (aw,total)
    def draw(s):
        c=s.canv; y=s.h
        c.setFillColor(s.color); c.setFont(B,10.5); c.drawString(0,y-5*mm,s.title); y-=s.titleh
        for i,(t,dl,h) in enumerate(s.lay):
            top=y
            c.setFillColor(s.color); c.circle(3.2*mm,top-3.4*mm,3.0*mm,stroke=0,fill=1)
            c.setFillColor(colors.white); c.setFont(B,8); c.drawCentredString(3.2*mm,top-4.6*mm,str(i+1))
            c.setFillColor(INK); c.setFont(B,9.5); c.drawString(9*mm,top-3.6*mm,t)
            c.setFillColor(GRAY); c.setFont(R,9)
            for j,ln in enumerate(dl): c.drawString(9*mm,top-8.0*mm-j*4.0*mm,ln)
            if i<len(s.lay)-1:
                c.setStrokeColor(al(s.color,0.35)); c.setLineWidth(1); c.line(3.2*mm,top-6.6*mm,3.2*mm,top-h+1.4*mm)
            y-=h+1.6*mm

class FlowDiagram(Flowable):
    def __init__(s,steps,color,h=22*mm): s.steps=steps; s.color=color; s.hh=h; Flowable.__init__(s)
    def wrap(s,aw,ah): s.w=aw; return (aw,s.hh)
    def draw(s):
        c=s.canv; n=len(s.steps); gap=6*mm; bw=(s.w-gap*(n-1))/n; bh=s.hh
        for i,sstep in enumerate(s.steps):
            x=i*(bw+gap)
            c.setFillColor(al(s.color,0.07)); c.setStrokeColor(al(s.color,0.55)); c.setLineWidth(1); c.roundRect(x,0,bw,bh,4,stroke=1,fill=1)
            c.setFillColor(s.color); c.circle(x+5*mm,bh-5*mm,2.6*mm,stroke=0,fill=1); c.setFillColor(colors.white); c.setFont(B,8); c.drawCentredString(x+5*mm,bh-6.2*mm,str(i+1))
            c.setFillColor(INK)
            for j,ln in enumerate(simpleSplit(sstep,R,8.2,bw-6*mm)[:3]): c.setFont(R,8.2); c.drawString(x+3*mm,bh-11*mm-j*3.7*mm,ln)
            if i<n-1:
                ax=x+bw+gap*0.2; ay=bh/2; c.setStrokeColor(s.color); c.setLineWidth(1.5); c.line(ax,ay,ax+gap*0.55,ay); c.line(ax+gap*0.55,ay,ax+gap*0.34,ay+1.5*mm); c.line(ax+gap*0.55,ay,ax+gap*0.34,ay-1.5*mm)

def tbl(data,widths,head=PURPLE):
    t=Table(data,colWidths=widths)
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),head),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,ZEBRA]),
        ('LINEBELOW',(0,0),(-1,-1),0.5,LINE),('BOX',(0,0),(-1,-1),0.6,LINE),('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('TOPPADDING',(0,0),(-1,-1),6.5),('BOTTOMPADDING',(0,0),(-1,-1),6.5),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7)]))
    return t
def ch(t): return Paragraph(t,PS(fontName=B,fontSize=9,leading=12.5,textColor=colors.white,alignment=TA_CENTER))
def chl(t): return Paragraph(t,PS(fontName=B,fontSize=9,leading=12.5,textColor=colors.white))
def cc(t): return Paragraph(t,PS(fontName=R,fontSize=8.8,leading=12.5,textColor=INK,alignment=TA_CENTER))
def cl(t): return Paragraph(t,PS(fontName=R,fontSize=8.8,leading=12.5,textColor=INK))
def cb(t,col=PURPLE): return Paragraph(t,PS(fontName=B,fontSize=8.8,leading=12.5,textColor=col,alignment=TA_CENTER))
def cbl(t,col=PURPLE): return Paragraph(t,PS(fontName=B,fontSize=8.8,leading=12.5,textColor=col))

# ===== page renderer (vertical center + per-page bg) =====
def grad_v(c,x,y,w,h,c1,c2,steps=80):
    for i in range(steps):
        t=i/(steps-1); col=colors.Color(c1.red+(c2.red-c1.red)*t,c1.green+(c2.green-c1.green)*t,c1.blue+(c2.blue-c1.blue)*t)
        c.setFillColor(col); c.rect(x,y+h*i/steps,w,h/steps+1,fill=1,stroke=0)

def page_bg(c,variant,color,ctop,total):
    # top accent strip always
    c.setFillColor(color); c.rect(0,A4h-5*mm,A4w,5*mm,fill=1,stroke=0); c.setFillColor(AMBER); c.rect(0,A4h-5*mm,38*mm,5*mm,fill=1,stroke=0)
    if variant=='panel':
        pad=7*mm; c.setFillColor(al(color,0.04)); c.setStrokeColor(al(color,0.18)); c.setLineWidth(1)
        c.roundRect(MX-6*mm,ctop-total-pad,CW+12*mm,total+2*pad,8,stroke=1,fill=1)
    elif variant=='sideband':
        c.setFillColor(al(color,0.10)); c.rect(0,BOT-4*mm,7*mm,A4h-40*mm,fill=1,stroke=0)
        c.setFillColor(color); c.rect(0,ctop-total-3*mm,2.5*mm,total+6*mm,fill=1,stroke=0)
    elif variant=='corner':
        c.setFillColor(al(color,0.07)); c.circle(A4w-6*mm,A4h-30*mm,34*mm,fill=1,stroke=0); c.setFillColor(al(AMBER,0.06)); c.circle(8*mm,BOT+10*mm,26*mm,fill=1,stroke=0)
    elif variant=='bar':
        c.setFillColor(al(color,0.07)); c.rect(MX-6*mm,ctop+4*mm,CW+12*mm,1.6*mm,fill=1,stroke=0)

def footer(c,pageno,label,color):
    c.setStrokeColor(LINE); c.setLineWidth(0.6); c.line(MX,14*mm,A4w-MX,14*mm)
    c.setFillColor(GRAY); c.setFont(R,7.5); c.drawString(MX,9.5*mm,label)
    c.drawString(MX,A4h-13*mm,'VIBEACTION')
    c.setFillColor(color); c.roundRect(A4w-MX-12*mm,8*mm,12*mm,5*mm,2.5,fill=1,stroke=0)
    c.setFillColor(colors.white); c.setFont(B,7.5); c.drawCentredString(A4w-MX-6*mm,9.6*mm,f'{pageno:02d}')

def render(c,blocks,color,variant,pageno,label,gap=5*mm):
    hs=[]; total=0
    for f in blocks:
        w,h=f.wrapOn(c,CW,A4h); hs.append(h); total+=h
    total+=gap*(len(blocks)-1)
    region_top=A4h-24*mm; region_bot=BOT+4*mm; region=region_top-region_bot
    y=region_bot+(region+total)/2
    if y>region_top: y=region_top
    page_bg(c,variant,color,y,total)
    for f,h in zip(blocks,hs):
        f.drawOn(c,MX,y-h); y-=h+gap
    footer(c,pageno,label,color)
    c.showPage()

def cover(c,subtitle,color,label):
    grad_v(c,0,0,A4w,A4h,DARK,DARK2)
    c.setFillColor(al(color,0.20)); c.circle(A4w*0.82,A4h*0.78,72*mm,fill=1,stroke=0)
    c.setFillColor(al(AMBER,0.10)); c.circle(A4w*0.14,A4h*0.28,52*mm,fill=1,stroke=0)
    c.setFillColor(color); c.rect(0,A4h-7*mm,A4w,7*mm,fill=1,stroke=0); c.setFillColor(AMBER); c.rect(0,A4h-10*mm,A4w*0.4,3*mm,fill=1,stroke=0)
    cx=A4w/2
    c.setFillColor(AMBER); c.rect(cx-9*mm,A4h*0.60,18*mm,1.6*mm,fill=1,stroke=0)
    c.setFillColor(colors.HexColor('#C4B5FD')); c.setFont(R,11); c.drawCentredString(cx,A4h*0.555,'AI SHORTFORM CREATOR · COMMERCE PLATFORM')
    c.setFillColor(colors.white); c.setFont(B,46); c.drawCentredString(cx,A4h*0.47,'VIBEACTION')
    c.setFont(B,24); c.drawCentredString(cx,A4h*0.405,subtitle)
    c.setFillColor(AMBER); c.setFont(B,15); c.drawCentredString(cx,A4h*0.33,'"숏폼으로 수익을 만들다"')
    c.setFillColor(colors.HexColor('#D9D5E8')); c.setFont(R,11)
    c.drawCentredString(cx,A4h*0.27,label)
    c.setFillColor(GRAY2); c.setFont(R,9.5); c.drawCentredString(cx,A4h*0.16,'투자 · 제휴 · 모집용  |  2025')
    c.showPage()

# =========================================================================
# 크리에이터용 가이드
# =========================================================================
def build_creator():
    c=canvas.Canvas("/tmp/vibeaction-guide-creator.pdf",pagesize=A4)
    LB='크리에이터 가이드 · CONFIDENTIAL'
    cover(c,'크리에이터 가이드',PURPLE,'크리에이터가 여섯 갈래로 수익을 만드는 법')
    pg=2
    # 2 한눈에 보기 (6대)
    render(c,[
        TitleBlock('OVERVIEW','한눈에 보는 6대 수익원','layers',PURPLE),
        para('VIBEACTION 크리에이터는 아래 여섯 가지 수익 활동을 자유롭게 조합합니다. 하나만 해도 되고, 합칠수록 수익이 빠르게 커집니다.',align=TA_CENTER,color=GRAY),
        KPIRow([('6','수익 파이프라인'),('0원','가입비'),('4','동시 배포 플랫폼')],PURPLE,h=22*mm),
        tbl([[chl('수익원'),ch('수익 방식'),chl('특징')],
            [cbl('① 캠페인 배포'),cc('배포 건당 고정 단가'),cl('가장 쉬움 · 구독자 0도 가능')],
            [cbl('② 영상 제작'),cc('길이 구간별 제작 단가'),cl('AI 도구로 제작·납품')],
            [cbl('③ 영상 판매'),cc('영상 판매가의 일부 적립'),cl('한 번 만들면 반복 수익')],
            [cbl('④ 동화 제작'),cc('동화 1편 제작 적립'),cl('AI스토리 동화 의뢰 연동')],
            [cbl('⑤ 쇼츠 커머스'),cc('판매가 × 수수료율'),cl('채널 운영 + 상품 연동')],
            [cbl('⑥ 쇼츠 자체·추천'),cc('조회수 수익 + 추천 수당'),cl('네트워크로 자동화')]],
            [40*mm,64*mm,61*mm]),
        Callout('핵심 전략','쉬운 배포로 기본 수익 → 제작·판매·동화로 단가↑ → 쇼츠 커머스로 상한↑ → 추천·맞구독으로 가속. 순서대로 쌓으세요.',PURPLE,'rocket'),
    ],PURPLE,'panel',pg,LB); pg+=1
    # 3 캠페인 배포
    render(c,[
        TitleBlock('수익원 ①','캠페인 — 숏폼 배포','megaphone',BLUE),
        para('광고주 캠페인의 <b>배포</b> 슬롯에 참여해, 제공된 영상을 내 SNS 채널에 올리면 배포 건당 고정 단가를 받습니다. 구독자 조건이 없어 가장 빠르게 시작할 수 있습니다.'),
        tbl([[chl('플랫폼'),ch('배포 1건 지급'),ch('4개 동시(1세트)')],
            [cbl('YouTube / IG / TikTok / FB',BLUE),cc('각 10,000원'),cb('40,000원',BLUE)]],
            [86*mm,40*mm,39*mm],head=BLUE),
        FlowDiagram(['배포 캠페인 신청','영상 퍼가기','업로드·링크 제출','검수 승인 → 적립'],BLUE,h=20*mm),
        StepList([
            ('가입 & 배포 계정 등록','대시보드 → 내 SNS 계정에서 YouTube·Instagram·TikTok·Facebook 채널을 등록합니다.'),
            ('캠페인 찾기·참여','캠페인 메뉴에서 "배포" 유형을 골라 신청합니다.'),
            ('영상 퍼가기','승인되면 제공 영상을 다운로드(퍼가기)합니다.'),
            ('업로드·제출','내 채널에 올린 뒤 게시물 URL을 제출합니다.'),
            ('정산 수령','검수 승인 후 지갑에 적립 → 출금 신청.'),
        ],BLUE),
        Callout('더 버는 법','한 영상을 4개 플랫폼에 동시 배포(1세트 4만원). 채널을 여러 개 운영하고 신규 캠페인을 빠르게 잡으면 월 건수가 늘어납니다.',BLUE,'rocket'),
    ],BLUE,'sideband',pg,LB); pg+=1
    # 4 영상 제작
    render(c,[
        TitleBlock('수익원 ②','캠페인 — 영상 제작','film',AMBER),
        para('영상 제작 슬롯에 참여해 AI 도구로 숏폼을 제작·납품합니다. 길이가 길수록 제작 단가가 높아집니다.'),
        tbl([[ch('영상 길이'),ch('크리에이터 제작단가'),ch('비고')],
            [cc('15초 이하'),cb('3,000원',ORANGE),cl('빠른 대량 제작')],
            [cc('30초 이하'),cb('5,000원',ORANGE),cl('가장 보편적')],
            [cc('60초 이하'),cb('8,000원',ORANGE),cl('정보·리뷰형')],
            [cc('90초 이하'),cb('12,000원',ORANGE),cl('스토리형 고단가')]],
            [42*mm,52*mm,71*mm],head=AMBER),
        FlowDiagram(['제작 슬롯 신청','AI로 제작','원본 제출','승인 → 적립'],AMBER,h=20*mm),
        StepList([
            ('가입 & 프로필 설정','크리에이터로 가입하고 프로필을 설정합니다.'),
            ('제작 캠페인 참여','캠페인 메뉴에서 "영상제작" 슬롯을 신청합니다.'),
            ('브리프 확인·제작','상품/톤/키워드 브리프를 보고 AI 도구로 영상을 제작합니다.'),
            ('원본 제출','완성한 원본 영상을 업로드 제출합니다.'),
            ('정산 수령','승인되면 길이 구간별 제작단가가 적립됩니다.'),
        ],AMBER),
        Callout('더 버는 법','AI 도구로 제작 시간을 줄여 건수를 늘리세요. 30초 구간을 하루 3~5건 루틴화하면 안정적입니다.',AMBER,'rocket'),
    ],AMBER,'panel',pg,LB); pg+=1
    # 5 영상 판매
    render(c,[
        TitleBlock('수익원 ③','영상 판매 — 바이브포터','play',ORANGE),
        para('제작한 숏폼을 <b>바이브포터</b> 마켓에 등록하면 판매될 때마다 적립됩니다. 한 번 만든 영상이 카탈로그에 쌓여 반복 수익이 됩니다.'),
        tbl([[ch('영상 길이'),ch('판매가'),ch('크리에이터 적립')],
            [cc('30초 이하'),cc('3,000원'),cb('1,500원',ORANGE)],
            [cc('60초 이하'),cc('5,000원'),cb('2,500원',ORANGE)],
            [cc('90초 이하'),cc('7,000원'),cb('3,500원',ORANGE)],
            [cc('90초 초과'),cc('10,000원'),cb('5,000원',ORANGE)]],
            [55*mm,55*mm,55*mm],head=ORANGE),
        FlowDiagram(['영상 등록','노출 승인','마켓 판매','판매분 적립'],ORANGE,h=20*mm),
        StepList([
            ('영상 등록','영상판매 메뉴에서 제목·길이·썸네일과 함께 영상을 등록합니다.'),
            ('노출 승인 대기','관리자 검수 후 마켓에 노출됩니다.'),
            ('판매','구매자가 영상을 구매합니다. (거래는 바이브포터 앱)'),
            ('적립·출금','판매분이 적립되고 누적 후 출금합니다.'),
        ],ORANGE),
        Callout('더 버는 법','트렌드·계절·인기 카테고리를 반복 제작해 카탈로그를 키우세요. 등록 수가 많을수록 판매·누적 수익이 커집니다.',ORANGE,'rocket'),
    ],ORANGE,'corner',pg,LB); pg+=1
    # 6 동화 제작 (NEW)
    render(c,[
        TitleBlock('수익원 ④','동화 제작 — AI스토리 의뢰','doc',GREEN),
        para('AI스토리에서 들어온 <b>맞춤 동화 제작 의뢰</b> 캠페인에 참여해 그림동화를 제작합니다. 아이 이름·테마·그림체·페이지수·목소리 브리프에 맞춰 제작하고 적립받습니다.'),
        tbl([[ch('동화 분량'),ch('제작 적립(예시)'),ch('비고')],
            [cc('8페이지 이하'),cb('30,000원',GREEN),cl('짧은 그림동화')],
            [cc('12페이지 이하'),cb('45,000원',GREEN),cl('표준 그림동화')],
            [cc('16페이지 이상'),cb('60,000원',GREEN),cl('장편 · 고난도')]],
            [50*mm,52*mm,63*mm],head=GREEN),
        FlowDiagram(['동화 캠페인 참여','브리프대로 제작','제출(목소리 포함)','검수 승인 → 적립'],GREEN,h=20*mm),
        StepList([
            ('동화 캠페인 찾기','캠페인 메뉴에서 "동화 제작(AI스토리)" 유형 캠페인을 찾습니다.'),
            ('브리프 확인·신청','아이 이름·나이·테마·그림체·페이지수·목소리 브리프를 확인하고 참여 신청합니다.'),
            ('동화 제작','브리프에 맞춰 그림+텍스트 동화를 제작하고, 필요 시 목소리 더빙을 반영합니다.'),
            ('결과물 제출','완성한 동화를 제출합니다.'),
            ('정산 수령','검수 승인 후 분량별 제작 적립금이 지갑에 들어옵니다.'),
        ],GREEN),
        Callout('더 버는 법','그림체를 다양화하고 회차를 빠르게 소화하세요. 목소리 더빙 등 옵션 작업까지 맡으면 건당 적립을 높일 수 있습니다.',GREEN,'rocket'),
    ],GREEN,'panel',pg,LB); pg+=1
    # 7 쇼츠 커머스
    render(c,[
        TitleBlock('수익원 ⑤','유튜브 쇼츠 커머스','cart',PINK),
        para('내 유튜브 채널 쇼츠에 상품을 연동해 <b>판매 수수료</b>를 얻습니다. 관리자가 등록한 카페24 연동 상품을 영상에 맞게 추천받아 연결하고, 결제·배송은 카페24가 처리합니다.'),
        tbl([[chl('상품(예시)'),ch('판매가'),ch('수수료'),ch('건당 적립')],
            [cl('뷰티 수분세럼'),cc('24,900'),cc('12%'),cb('2,988원',PINK)],
            [cl('패션 후드티'),cc('32,000'),cc('15%'),cb('4,800원',PINK)],
            [cl('무선 이어폰'),cc('59,000'),cc('8%'),cb('4,720원',PINK)]],
            [56*mm,33*mm,30*mm,46*mm],head=PINK),
        StepList([
            ('운영 채널 등록','내 SNS 계정 → "숏폼 운영 채널 YouTube"에 운영 채널을 등록합니다.'),
            ('쇼츠 준비','직접 제작하거나 바이브포터에서 구매한 영상으로 쇼츠를 업로드합니다.'),
            ('상품 연동','쇼츠 커머스 메뉴에서 링크 입력 → 추천 상품 중 골라 연동합니다.'),
            ('판매 발생','시청자가 연동 상품을 구매합니다. (결제·배송은 카페24)'),
            ('수수료 수령','판매가 × 수수료율이 적립 → 출금 신청.'),
        ],PINK),
        Callout('더 버는 법','한 쇼츠에 여러 상품을 연동하면 영상 1편이 다중 수익원이 됩니다. 영상 주제와 잘 맞는 고수수료 상품을 고르세요.',PINK,'rocket'),
    ],PINK,'sideband',pg,LB); pg+=1
    # 8 자체수익 + 추천
    render(c,[
        TitleBlock('수익원 ⑥','쇼츠 자체 수익 · 추천/맞구독','users',PURPLE2),
        para('<b>쇼츠 자체 수익</b> — 내 채널 쇼츠는 상품 수수료와 별개로 <b>조회수 기반 수익화</b>로도 수익이 납니다. <b>추천·맞구독</b> — 회원 맞구독으로 초기 구독자를 모으고, 추천 링크로 수당을 받습니다.'),
        FlowDiagram(['맞구독·추천','구독자 확보','수익화 조건 도달','조회수·추천 수익'],PURPLE2,h=20*mm),
        StepList([
            ('수익화 조건 확인','내 운영 채널의 쇼츠 수익화 조건(구독자/조회수)을 확인합니다.'),
            ('맞구독 참여','SNS 맞구독 커뮤니티에서 서로 구독해 초기 구독자를 확보합니다.'),
            ('추천 링크 공유','내 추천 코드/링크를 지인에게 공유합니다.'),
            ('꾸준한 업로드','쇼츠를 지속 업로드해 조회수 기반 수익을 키웁니다.'),
            ('수익 수령','추천 수당과 쇼츠 수익이 적립됩니다.'),
        ],PURPLE2),
        Callout('더 버는 법','초반엔 맞구독으로 구독자를 빠르게 모아 수익화 조건을 채우세요. 추천은 인원 제한이 없어 네트워크가 클수록 자동 수익이 쌓입니다.',PURPLE2,'rocket'),
    ],PURPLE2,'panel',pg,LB); pg+=1
    # 9 통합 시뮬
    render(c,[
        TitleBlock('SIMULATION','통합 월 수익 시뮬레이션','chart',PURPLE),
        para('여러 수익원을 함께 운영했을 때의 합산 예시입니다. (가정치 · 실제는 활동량/전환율에 따라 변동)',align=TA_CENTER,color=GRAY),
        tbl([[chl('시나리오'),ch('배포'),ch('제작·동화'),ch('쇼츠 커머스'),ch('판매·추천'),ch('월 합계')],
            [cbl('라이트'),cc('20만'),cc('-'),cc('~6만'),cc('~4만'),cb('약 30만원')],
            [cbl('액티브'),cc('40만'),cc('10만'),cc('~30만'),cc('~15만'),cb('약 95~120만원')],
            [cbl('전업'),cc('80만'),cc('30만'),cc('~120만'),cc('~30만'),cb('약 200만원+')]],
            [22*mm,24*mm,26*mm,28*mm,24*mm,41*mm]),
        Callout('수익 극대화 공식','① 쉬운 배포로 베이스 → ② 제작·판매·동화로 단가↑ → ③ 쇼츠 커머스로 상한↑ → ④ 추천·맞구독으로 자동화. 여섯 수익원을 단계적으로 쌓으면 수익 곡선이 가팔라집니다.',PURPLE,'star'),
    ],PURPLE,'bar',pg,LB); pg+=1
    # 10 정산 + 행동가이드
    render(c,[
        TitleBlock('PAYOUT & ROUTINE','정산 흐름 · 실전 루틴','wallet',BLUE),
        para('<b>정산</b> — 적립(대기) → 작업 승인 시 출금가능 전환 → 언제든 출금 신청. 출금 시 세무 처리 후 지급됩니다.'),
        FlowDiagram(['활동·적립(대기)','작업 승인','출금가능 전환','출금 신청·지급'],BLUE,h=20*mm),
        StepList([
            ('지갑 확인','수익 현황(지갑)에서 대기/출금가능 잔액을 확인합니다.'),
            ('출금 신청','출금가능 잔액을 계좌로 출금 신청합니다.'),
            ('세무 처리·지급','원천징수 등 처리 후 지급됩니다.'),
        ],BLUE,title='출금 방법'),
        Callout('주간 루틴 체크리스트','매일: 배포 1~2건 + 쇼츠 1편. 주간: 영상 5~10건 마켓 등록, 동화 캠페인 확인, 쇼츠 상품 연동 점검, 맞구독·추천 공유.',BLUE,'check'),
    ],BLUE,'corner',pg,LB); pg+=1
    # 11 CTA
    render(c,[
        TitleBlock('START','지금 시작하세요','rocket',PURPLE),
        para('가입 → SNS/운영 채널 등록 → 가장 쉬운 배포부터 시작하면 됩니다. 활동을 늘리고 조합할수록 수익이 커집니다.',align=TA_CENTER),
        KPIRow([('6','수익 파이프라인'),('0원','가입비'),('4','동시 배포 플랫폼')],PURPLE,h=22*mm),
        Callout('VIBEACTION 크리에이터로 시작하기','앱에서 가입 후 대시보드의 캠페인·쇼츠 커머스 메뉴에서 바로 활동을 시작할 수 있습니다.',PURPLE,'play'),
    ],PURPLE,'panel',pg,LB); pg+=1
    c.save(); return pg-1

# =========================================================================
# 광고주용 가이드
# =========================================================================
def build_advertiser():
    c=canvas.Canvas("/tmp/vibeaction-guide-advertiser.pdf",pagesize=A4)
    LB='광고주 가이드 · CONFIDENTIAL'
    cover(c,'광고주 가이드',BLUE,'실행사 · 대행사 · 제작의뢰인을 위한 숏폼 마케팅')
    pg=2
    render(c,[
        TitleBlock('OVERVIEW','왜 VIBEACTION 인가','target',BLUE),
        para('검증된 크리에이터 풀로 숏폼 영상 제작과 4대 플랫폼 동시 배포를 빠르고 합리적인 단가로 집행합니다. 포인트 기반으로 투명하게 정산되고, 성과까지 추적할 수 있습니다.',align=TA_CENTER,color=GRAY),
        KPIRow([('4','동시 배포 플랫폼'),('80억+','4대 플랫폼 사용자'),('포인트','투명 정산')],BLUE,h=22*mm),
        tbl([[chl('니즈'),ch('VIBEACTION 제공')],
            [cbl('빠른 제작',BLUE),cl('AI 기반 다수 크리에이터 동시 제작 · 표준 단가')],
            [cbl('넓은 도달',BLUE),cl('YouTube·Instagram·TikTok·Facebook 동시 배포')],
            [cbl('안전한 집행',BLUE),cl('브랜드 세이프티 옵션 · 검수 승인 후 지급')],
            [cbl('성과 측정',BLUE),cl('UTM·프로모션 코드·KPI 추적')]],
            [34*mm,131*mm],head=BLUE),
    ],BLUE,'panel',pg,LB); pg+=1
    render(c,[
        TitleBlock('STEP 1','캠페인 등록 방식','doc',PURPLE),
        para('캠페인 유형을 고르고 플랫폼·단가·자격·브랜드 세이프티·KPI를 설정해 등록합니다. "영상제작+배포"는 제작과 배포를 분리해 동시에 모집할 수 있습니다.'),
        FlowDiagram(['포인트 충전','캠페인 유형·조건 설정','크리에이터 모집·집행','결과 검수·승인'],PURPLE),
        tbl([[chl('캠페인 유형'),ch('설명')],
            [cbl('영상제작 + 배포'),cl('제작과 배포를 분리 모집 — 제작본을 배포자가 퍼가서 배포')],
            [cbl('자체 영상 배포'),cl('보유 영상을 크리에이터가 배포')],
            [cbl('기존 영상 기반 배포'),cl('등록된 영상으로 배포 집행')],
            [cbl('단순 영상 제작'),cl('배포 없이 영상 제작만 의뢰')]],
            [46*mm,119*mm]),
    ],PURPLE,'sideband',pg,LB); pg+=1
    render(c,[
        TitleBlock('PRICING','청구단가 구조','chart',BLUE),
        para('명확한 표준 단가로 예산을 예측할 수 있습니다. 4개 플랫폼 동시 배포 시 도달이 크게 확장됩니다.'),
        para('배포 — 플랫폼별 건당',size=10.5,font=B,color=PINK,sa=2),
        tbl([[chl('항목'),ch('광고주 청구'),ch('비고')],
            [cl('배포 1건 (플랫폼당)'),cb('15,000원',BLUE),cl('구독자 조건 없이 광범위 집행')],
            [cl('4개 플랫폼 동시(1세트)'),cb('60,000원',BLUE),cl('도달 4배 효과')]],
            [70*mm,40*mm,55*mm],head=BLUE),
        para('영상 제작 — 길이 구간별 건당',size=10.5,font=B,color=PINK,sa=2),
        tbl([[ch('15초'),ch('30초'),ch('60초'),ch('90초')],
            [cb('10,000원',BLUE),cb('15,000원',BLUE),cb('25,000원',BLUE),cb('35,000원',BLUE)]],
            [41*mm,41*mm,41*mm,42*mm],head=BLUE),
        Callout('예산 예시','30초 영상 10편 제작 + 4개 플랫폼 5세트 배포 = (15,000×10)+(60,000×5) = 450,000원',BLUE,'wallet'),
    ],BLUE,'bar',pg,LB); pg+=1
    render(c,[
        TitleBlock('QUALITY','AI 영상 제작 자동화 · 품질','gear',AMBER),
        para('크리에이터는 표준 워크플로우와 최신 AI 도구로 숏폼을 빠르게 제작합니다. 다수 제작자가 동시에 참여해 물량과 다양성을 동시에 확보합니다.'),
        FlowDiagram(['AI 스크립트','AI 영상 생성','AI 편집·음성','검수·납품'],AMBER),
        tbl([[chl('단계'),ch('대표 도구')],
            [cbl('스크립트',ORANGE),cl('ChatGPT · Claude')],
            [cbl('영상 생성',ORANGE),cl('Runway · Pika · Kling')],
            [cbl('편집',ORANGE),cl('CapCut AI · Adobe Firefly')],
            [cbl('음성/아바타',ORANGE),cl('ElevenLabs · HeyGen')]],
            [40*mm,125*mm],head=AMBER),
        Callout('품질 관리','브랜드 세이프티(금칙어·경쟁사·성인/폭력/정치 제외) 옵션과 검수 승인 절차로, 승인된 결과물에만 비용이 집행됩니다.',AMBER,'check'),
    ],AMBER,'panel',pg,LB); pg+=1
    render(c,[
        TitleBlock('REACH','4개 플랫폼 동시 배포 효과','globe',PINK),
        para('하나의 영상을 YouTube·Instagram·TikTok·Facebook에 동시에 배포해 도달을 극대화합니다. 플랫폼별 알고리즘이 서로 다른 청중에게 노출합니다.'),
        KPIRow([('20억+','YouTube'),('20억+','Instagram'),('10억+','TikTok'),('30억+','Facebook')],PINK,h=22*mm),
        Callout('동시 배포의 힘','같은 제작비로 4개 채널에 노출 → 채널별 오디언스가 겹치지 않아 실질 도달이 배가됩니다. (사용자 수는 업계 개략치)',PINK,'rocket'),
    ],PINK,'corner',pg,LB); pg+=1
    render(c,[
        TitleBlock('REPORTING','성과 · 리포팅','chart',GREEN),
        para('캠페인 성과를 추적할 수 있는 도구를 제공합니다.'),
        tbl([[chl('도구'),ch('용도')],
            [cbl('UTM 링크',GREEN),cl('유입·전환 추적 (GA 등 연동)')],
            [cbl('프로모션 코드',GREEN),cl('채널별 매출 기여 측정')],
            [cbl('KPI 목표',GREEN),cl('조회·클릭·전환 목표 설정 및 점검')],
            [cbl('배포 검수',GREEN),cl('게시물 URL·증빙 확인 후 승인')]],
            [40*mm,125*mm],head=GREEN),
        Callout('투명한 집행','크리에이터 제출 → 검수 승인 → 지급의 단계로 진행되어, 미이행 건에는 비용이 나가지 않습니다.',GREEN,'check'),
    ],GREEN,'sideband',pg,LB); pg+=1
    render(c,[
        TitleBlock('ROI','도입 효과 · ROI','rocket',PURPLE),
        para('자체 제작·개별 섭외 대비 시간과 비용을 줄이면서 도달을 키웁니다. 예시로 단순 비교해 봅니다.',align=TA_CENTER,color=GRAY),
        tbl([[chl('구분'),ch('기존 방식(예시)'),ch('VIBEACTION')],
            [cbl('영상 1편 제작'),cc('수십만원·수일'),cb('15초 1만원~ · 신속')],
            [cbl('4채널 배포'),cc('개별 섭외·관리'),cb('1세트 6만원 일괄')],
            [cbl('성과 추적'),cc('수기/분산'),cb('UTM·코드·KPI 통합')]],
            [34*mm,66*mm,65*mm]),
        Callout('핵심 가치','소액으로 다수 크리에이터를 통한 대량 제작·동시 배포·성과 추적을 한 번에. 캠페인 규모를 키울수록 단위 비용 효율이 좋아집니다.',PURPLE,'star'),
    ],PURPLE,'bar',pg,LB); pg+=1
    render(c,[
        TitleBlock('STRUCTURE','실행사 · 대행사 · 정산','building',BLUE),
        para('실행사–대행사 수직 구조를 지원하며, 대행사 집행액 기준 수직 수수료가 자동 반영됩니다.'),
        tbl([[chl('주체'),ch('역할')],
            [cbl('실행사',BLUE),cl('캠페인 직접 집행 · 대행사 관리')],
            [cbl('대행사',BLUE),cl('상위 실행사 소속으로 캠페인 집행')],
            [cbl('제작의뢰인',BLUE),cl('영상 제작 의뢰(바이브포터 등) 중심')]],
            [40*mm,125*mm],head=BLUE),
        Callout('정산 정책','포인트 충전·사용·환불이 원장으로 관리되고, 대행사 거래는 실행사 수직 수수료(예: 5%)가 자동 정산됩니다.',BLUE,'wallet'),
    ],BLUE,'panel',pg,LB); pg+=1
    render(c,[
        TitleBlock('ONBOARDING','도입 절차 · 문의','handshake',PURPLE),
        para('간단한 절차로 바로 시작할 수 있습니다.',align=TA_CENTER),
        FlowDiagram(['광고주 가입','포인트 충전','캠페인 등록','집행·검수·정산'],PURPLE),
        Callout('도입 문의','제휴·대량 집행·맞춤 단가는 앱 내 문의 또는 운영팀 이메일로 연락 주세요. 캠페인 설계부터 리포팅까지 함께합니다.',PURPLE,'handshake'),
        para('© 2025 VIBEACTION · 본 자료의 수치/단가는 예시이며 정책에 따라 변동될 수 있습니다.',size=8,color=GRAY,align=TA_CENTER),
    ],PURPLE,'corner',pg,LB); pg+=1
    c.save(); return pg-1

n1=build_creator(); n2=build_advertiser()
print("creator pages:",n1+1,"advertiser pages:",n2+1)
for f in ["/tmp/vibeaction-guide-creator.pdf","/tmp/vibeaction-guide-advertiser.pdf"]:
    print(f, os.path.getsize(f),"bytes")
