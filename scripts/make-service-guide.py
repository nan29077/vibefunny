# -*- coding: utf-8 -*-
import os
from fontTools.ttLib import TTFont as FTFont, TTCollection
from fontTools.subset import Subsetter, Options
from otf2ttf.cli import otf_to_ttf

# ---------- 1) 한글 폰트 준비 (Noto Sans CJK KR 서브셋 → TrueType 변환 → 임베드) ----------
SRC = open(__file__, encoding='utf-8').read()
CHARSET = sorted({ord(c) for c in SRC if ord(c) >= 32})
# 안전망: 자주 쓰는 한글/기호 추가
for extra in "①②③④⑤▪→✓·—₩…“”‘’":
    if ord(extra) not in CHARSET: CHARSET.append(ord(extra))

def kr_index(ttc_path, family="Noto Sans CJK KR"):
    coll = TTCollection(ttc_path, lazy=True)
    for i, f in enumerate(coll.fonts):
        if (f['name'].getDebugName(1) or '') == family:
            return i
    return 1

def prep_font(ttc_path, out_ttf):
    font = FTFont(ttc_path, fontNumber=kr_index(ttc_path))
    opt = Options()
    opt.glyph_names = True
    opt.layout_features = []        # 한글엔 불필요 → 용량 축소
    opt.name_IDs = ['*']
    opt.notdef_outline = True
    opt.recalc_bounds = True
    opt.drop_tables = []
    ss = Subsetter(options=opt)
    ss.populate(unicodes=CHARSET)
    ss.subset(font)
    otf_to_ttf(font)               # CFF → glyf 변환 (reportlab 임베드 가능)
    font.save(out_ttf)
    return out_ttf

REG_TTC = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
BOLD_TTC = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
prep_font(REG_TTC, "/tmp/NotoKR-Regular.ttf")
prep_font(BOLD_TTC, "/tmp/NotoKR-Bold.ttf")

# ---------- 2) reportlab 구성 ----------
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.utils import simpleSplit
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, PageBreak,
                                Table, TableStyle, Frame, PageTemplate, NextPageTemplate, Flowable)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

pdfmetrics.registerFont(TTFont('KR', "/tmp/NotoKR-Regular.ttf"))
pdfmetrics.registerFont(TTFont('KRB', "/tmp/NotoKR-Bold.ttf"))
pdfmetrics.registerFontFamily('KR', normal='KR', bold='KRB', italic='KR', boldItalic='KRB')
R, B = 'KR', 'KRB'

# 팔레트
PURPLE=colors.HexColor('#6D28D9'); PURPLE2=colors.HexColor('#8B5CF6')
PINK=colors.HexColor('#DB2777'); AMBER=colors.HexColor('#F59E0B')
GREEN=colors.HexColor('#059669'); BLUE=colors.HexColor('#2563EB')
INK=colors.HexColor('#111827'); GRAY=colors.HexColor('#6B7280'); GRAY2=colors.HexColor('#9CA3AF')
LIGHT=colors.HexColor('#F5F4FA'); ZEBRA=colors.HexColor('#FAFAFC'); LINE=colors.HexColor('#E7E5EE')
DARK=colors.HexColor('#0B0716'); DARK2=colors.HexColor('#1B1030')

OUT="/tmp/vibeaction-service-guide.pdf"
A4w,A4h=A4
def alpha(c,a): return colors.Color(c.red,c.green,c.blue,alpha=a)

S={
 'h1':   ParagraphStyle('h1',fontName=B,fontSize=19,leading=25,textColor=PURPLE,spaceAfter=7),
 'h2':   ParagraphStyle('h2',fontName=B,fontSize=12.5,leading=18,textColor=INK,spaceBefore=9,spaceAfter=4),
 'h3':   ParagraphStyle('h3',fontName=B,fontSize=11,leading=15,textColor=PINK,spaceBefore=5,spaceAfter=3),
 'body': ParagraphStyle('bd',fontName=R,fontSize=10,leading=16.5,textColor=INK,spaceAfter=5),
 'muted':ParagraphStyle('mu',fontName=R,fontSize=8.8,leading=13.5,textColor=GRAY,spaceAfter=3),
 'bullet':ParagraphStyle('bl',fontName=R,fontSize=10,leading=16,textColor=INK,leftIndent=13,spaceAfter=3),
 'cell': ParagraphStyle('cl',fontName=R,fontSize=9,leading=13,textColor=INK),
 'cellc':ParagraphStyle('cc',fontName=R,fontSize=9,leading=13,textColor=INK,alignment=TA_CENTER),
 'cellh':ParagraphStyle('ch',fontName=B,fontSize=9.2,leading=13,textColor=colors.white,alignment=TA_CENTER),
 'cellhl':ParagraphStyle('chl',fontName=B,fontSize=9.2,leading=13,textColor=colors.white),
 'cellb':ParagraphStyle('cb',fontName=B,fontSize=9.2,leading=13,textColor=PURPLE,alignment=TA_CENTER),
 'cellbl':ParagraphStyle('cbl',fontName=B,fontSize=9.2,leading=13,textColor=PURPLE),
 'foot': ParagraphStyle('ft',fontName=R,fontSize=8,textColor=GRAY,alignment=TA_CENTER),
 'toc':  ParagraphStyle('tc',fontName=R,fontSize=11,leading=20,textColor=INK),
 'tocb': ParagraphStyle('tcb',fontName=B,fontSize=11,leading=20,textColor=PURPLE),
}
def P(t,s='body'): return Paragraph(t,S[s])
def blist(items,dot=PURPLE):
    hx='#%02x%02x%02x'%(int(dot.red*255),int(dot.green*255),int(dot.blue*255))
    return [Paragraph(f'<font color="{hx}">▪</font>&nbsp; {it}',S['bullet']) for it in items]

# ---------- line icons ----------
def _su(c,col): c.setStrokeColor(col); c.setLineWidth(1.4); c.setLineCap(1); c.setLineJoin(1); c.setFillColor(col)
def draw_glyph(c,name,x,y,s,col):
    import math
    c.saveState(); _su(c,col)
    p=s*0.24; ix=x+p; iy=y+p; m=s-2*p; cx=x+s/2; cy=y+s/2
    if name=='doc':
        c.roundRect(ix,iy,m*0.8,m,1.5,stroke=1,fill=0)
        for k in range(3):
            yy=iy+m*0.72-k*m*0.26; c.line(ix+m*0.15,yy,ix+m*0.6,yy)
    elif name=='target':
        c.circle(cx,cy,m*0.5,stroke=1,fill=0); c.circle(cx,cy,m*0.28,stroke=1,fill=0); c.circle(cx,cy,m*0.06,stroke=1,fill=1)
    elif name=='layers':
        for k in range(3):
            yy=iy+k*m*0.3
            c.lines([(ix,yy+m*0.18,cx,yy),(cx,yy,ix+m,yy+m*0.18),(ix+m,yy+m*0.18,cx,yy+m*0.36),(cx,yy+m*0.36,ix,yy+m*0.18)])
    elif name=='megaphone':
        c.lines([(ix,cy-m*0.15,ix,cy+m*0.15),(ix,cy+m*0.15,ix+m*0.55,cy+m*0.35),(ix+m*0.55,cy+m*0.35,ix+m*0.55,cy-m*0.35),(ix+m*0.55,cy-m*0.35,ix,cy-m*0.15)])
        c.line(ix+m*0.7,cy+m*0.1,ix+m,cy+m*0.25); c.line(ix+m*0.7,cy,ix+m,cy)
    elif name=='film':
        c.roundRect(ix,iy,m,m,1.5,stroke=1,fill=0); c.line(ix+m*0.32,iy,ix+m*0.32,iy+m); c.line(ix+m*0.68,iy,ix+m*0.68,iy+m)
    elif name=='cart':
        c.line(ix,iy+m*0.85,ix+m*0.2,iy+m*0.85); c.line(ix+m*0.2,iy+m*0.85,ix+m*0.34,iy+m*0.3)
        c.line(ix+m*0.34,iy+m*0.3,ix+m,iy+m*0.3); c.line(ix+m,iy+m*0.3,ix+m*0.86,iy+m*0.62); c.line(ix+m*0.34,iy+m*0.62,ix+m*0.92,iy+m*0.62)
        c.circle(ix+m*0.42,iy+m*0.12,m*0.09,stroke=1,fill=0); c.circle(ix+m*0.86,iy+m*0.12,m*0.09,stroke=1,fill=0)
    elif name=='play':
        c.lines([(ix+m*0.2,iy,ix+m*0.2,iy+m),(ix+m*0.2,iy+m,ix+m,cy),(ix+m,cy,ix+m*0.2,iy)])
    elif name=='users':
        c.circle(ix+m*0.32,iy+m*0.7,m*0.18,stroke=1,fill=0); c.circle(ix+m*0.68,iy+m*0.7,m*0.18,stroke=1,fill=0)
        c.arc(ix+m*0.06,iy,ix+m*0.58,iy+m*0.5,startAng=20,extent=140); c.arc(ix+m*0.42,iy,ix+m*0.94,iy+m*0.5,startAng=20,extent=140)
    elif name=='chart':
        c.line(ix,iy,ix,iy+m); c.line(ix,iy,ix+m,iy)
        for k,h in enumerate([0.4,0.7,0.55,0.95]):
            bx=ix+m*0.18+k*m*0.22; c.line(bx,iy,bx,iy+m*h)
    elif name=='building':
        c.roundRect(ix+m*0.2,iy,m*0.6,m,1,stroke=1,fill=0)
        for r in range(3):
            for col2 in range(2):
                wx=ix+m*0.32+col2*m*0.22; wy=iy+m*0.2+r*m*0.25; c.rect(wx,wy,m*0.12,m*0.12,stroke=1,fill=0)
    elif name=='star':
        pts=[]
        for k in range(10):
            ang=math.pi/2+k*math.pi/5; rr=m*0.5 if k%2==0 else m*0.22
            pts.append((cx+rr*math.cos(ang),cy+rr*math.sin(ang)))
        c.lines([(pts[k][0],pts[k][1],pts[(k+1)%10][0],pts[(k+1)%10][1]) for k in range(10)])
    elif name=='link':
        c.roundRect(ix,iy+m*0.28,m*0.55,m*0.32,m*0.16,stroke=1,fill=0); c.roundRect(ix+m*0.45,iy+m*0.4,m*0.55,m*0.32,m*0.16,stroke=1,fill=0)
    elif name=='flow':
        c.circle(ix+m*0.12,cy,m*0.1,stroke=1,fill=0); c.circle(cx,cy,m*0.1,stroke=1,fill=0); c.circle(ix+m*0.88,cy,m*0.1,stroke=1,fill=0)
        c.line(ix+m*0.24,cy,cx-m*0.1,cy); c.line(cx+m*0.12,cy,ix+m*0.76,cy)
    elif name=='globe':
        c.circle(cx,cy,m*0.5,stroke=1,fill=0); c.line(cx-m*0.5,cy,cx+m*0.5,cy)
        c.arc(cx-m*0.22,cy-m*0.5,cx+m*0.22,cy+m*0.5,startAng=90,extent=180); c.arc(cx-m*0.22,cy-m*0.5,cx+m*0.22,cy+m*0.5,startAng=270,extent=180)
    elif name=='mail':
        c.roundRect(ix,iy+m*0.15,m,m*0.7,1.5,stroke=1,fill=0); c.line(ix,iy+m*0.82,cx,iy+m*0.45); c.line(cx,iy+m*0.45,ix+m,iy+m*0.82)
    elif name=='question':
        c.circle(cx,cy,m*0.5,stroke=1,fill=0); c.setFont(B,s*0.42); c.drawCentredString(cx,cy-s*0.15,'?')
    c.restoreState()

class IconBox(Flowable):
    def __init__(self,glyph,color=PURPLE,bs=10*mm):
        super().__init__(); self.glyph=glyph; self.color=color; self.bs=bs
    def wrap(self,*a): return (self.bs,self.bs)
    def draw(self):
        c=self.canv; c.saveState(); c.setFillColor(alpha(self.color,0.12)); c.setStrokeColor(alpha(self.color,0.35)); c.setLineWidth(0.8)
        c.roundRect(0,0,self.bs,self.bs,self.bs*0.24,stroke=1,fill=1)
        draw_glyph(c,self.glyph,0,0,self.bs,self.color); c.restoreState()

class Rule(Flowable):
    def __init__(self,color,w=170*mm,th=2): super().__init__(); self.color=color; self.w=w; self.th=th
    def wrap(self,aw,ah): self.w=min(self.w,aw); return (self.w,self.th+2)
    def draw(self):
        c=self.canv; c.setStrokeColor(self.color); c.setLineWidth(self.th); c.setLineCap(1); c.line(0,1,self.w*0.16,1)
        c.setStrokeColor(LINE); c.setLineWidth(0.8); c.line(self.w*0.17,1,self.w,1)

def section(num,title,glyph,color=PURPLE):
    ic=IconBox(glyph,color,10*mm)
    ttl=Paragraph(f'<font name="KR" color="#9CA3AF" size=9>SECTION {num}</font><br/>{title}',
                  ParagraphStyle('st',fontName=B,fontSize=17,leading=20,textColor=color))
    t=Table([[ic,ttl]],colWidths=[13*mm,157*mm])
    t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),0),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
    return [t, Rule(color), Spacer(1,7)]

class FlowDiagram(Flowable):
    def __init__(self,steps,color=PURPLE,width=170*mm,h=23*mm):
        super().__init__(); self.steps=steps; self.color=color; self.width=width; self.h=h
    def wrap(self,aw,ah): self.width=min(self.width,aw); return (self.width,self.h)
    def draw(self):
        c=self.canv; n=len(self.steps); gap=6*mm; bw=(self.width-gap*(n-1))/n; bh=self.h
        for i,st in enumerate(self.steps):
            x=i*(bw+gap)
            c.setFillColor(alpha(self.color,0.07)); c.setStrokeColor(alpha(self.color,0.55)); c.setLineWidth(1)
            c.roundRect(x,0,bw,bh,4,stroke=1,fill=1)
            c.setFillColor(self.color); c.circle(x+5*mm,bh-5*mm,2.6*mm,stroke=0,fill=1)
            c.setFillColor(colors.white); c.setFont(B,8); c.drawCentredString(x+5*mm,bh-6.2*mm,str(i+1))
            c.setFillColor(INK)
            for j,ln in enumerate(simpleSplit(st,R,8.2,bw-6*mm)[:3]):
                c.setFont(R,8.2); c.drawString(x+3*mm,bh-11*mm-j*3.7*mm,ln)
            if i<n-1:
                ax=x+bw+gap*0.2; ay=bh/2
                c.setStrokeColor(self.color); c.setLineWidth(1.5)
                c.line(ax,ay,ax+gap*0.55,ay); c.line(ax+gap*0.55,ay,ax+gap*0.34,ay+1.5*mm); c.line(ax+gap*0.55,ay,ax+gap*0.34,ay-1.5*mm)

def tbl(data,widths,head=PURPLE):
    t=Table(data,colWidths=widths,repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),head),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,ZEBRA]),
        ('LINEBELOW',(0,0),(-1,-1),0.5,LINE),
        ('LINEBELOW',(0,0),(-1,0),0,head),
        ('BOX',(0,0),(-1,-1),0.6,LINE),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),
        ('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),
    ]))
    return t

# gradient cover bg
def grad_v(c,x,y,w,h,c1,c2,steps=80):
    for i in range(steps):
        t=i/(steps-1)
        col=colors.Color(c1.red+(c2.red-c1.red)*t,c1.green+(c2.green-c1.green)*t,c1.blue+(c2.blue-c1.blue)*t)
        c.setFillColor(col); c.rect(x,y+h*i/steps,w,h/steps+1,fill=1,stroke=0)

def cover_bg(c,doc):
    c.saveState(); w,h=A4
    grad_v(c,0,0,w,h,DARK,DARK2)
    c.setFillColor(alpha(PURPLE2,0.18)); c.circle(w*0.85,h*0.80,70*mm,fill=1,stroke=0)
    c.setFillColor(alpha(PINK,0.10)); c.circle(w*0.12,h*0.30,55*mm,fill=1,stroke=0)
    c.setFillColor(PURPLE); c.rect(0,h-7*mm,w,7*mm,fill=1,stroke=0)
    c.setFillColor(AMBER); c.rect(0,h-10*mm,w*0.4,3*mm,fill=1,stroke=0)
    c.setFillColor(AMBER); c.rect(20*mm,h*0.62,16*mm,1.4*mm,fill=1,stroke=0)
    c.restoreState()

def content_bg(c,doc):
    c.saveState(); w,h=A4
    c.setFillColor(PURPLE); c.rect(0,h-5*mm,w,5*mm,fill=1,stroke=0)
    c.setFillColor(AMBER); c.rect(0,h-5*mm,38*mm,5*mm,fill=1,stroke=0)
    c.setFont(R,8); c.setFillColor(GRAY2); c.drawString(20*mm,A4h-13*mm,'VIBEACTION · 서비스 소개서')
    # footer
    c.setStrokeColor(LINE); c.setLineWidth(0.6); c.line(20*mm,14*mm,w-20*mm,14*mm)
    c.setFillColor(GRAY); c.setFont(R,7.5); c.drawString(20*mm,9.5*mm,'CONFIDENTIAL · 본 자료의 수치는 예시이며 정책에 따라 변동될 수 있습니다.')
    # page pill
    c.setFillColor(PURPLE); c.roundRect(w-32*mm,8*mm,12*mm,5*mm,2.5,fill=1,stroke=0)
    c.setFillColor(colors.white); c.setFont(B,7.5); c.drawCentredString(w-26*mm,9.6*mm,f'{doc.page:02d}')
    c.restoreState()

cover_frame=Frame(20*mm,26*mm,A4w-40*mm,A4h-80*mm,id='cv')
content_frame=Frame(20*mm,17*mm,A4w-40*mm,A4h-30*mm,id='ct')
doc=SimpleDocTemplate(OUT,pagesize=A4,leftMargin=20*mm,rightMargin=20*mm,topMargin=22*mm,bottomMargin=20*mm,
                      title="VIBEACTION 서비스 소개서",author="VIBEACTION")
doc.addPageTemplates([PageTemplate(id='Cover',frames=[cover_frame],onPage=cover_bg),
                      PageTemplate(id='Content',frames=[content_frame],onPage=content_bg)])

st=[]
st.append(NextPageTemplate('Content'))
st.append(Spacer(1,44*mm))
st.append(Paragraph('AI SHORTFORM CREATOR · COMMERCE PLATFORM',ParagraphStyle('x',fontName=R,fontSize=10,textColor=colors.HexColor('#C4B5FD'))))
st.append(Spacer(1,7*mm))
st.append(Paragraph('VIBEACTION',ParagraphStyle('x',fontName=B,fontSize=48,leading=52,textColor=colors.white)))
st.append(Paragraph('서비스 소개서',ParagraphStyle('x',fontName=B,fontSize=27,leading=36,textColor=colors.white)))
st.append(Spacer(1,11*mm))
st.append(Paragraph('"숏폼으로 수익을 만들다"',ParagraphStyle('x',fontName=B,fontSize=17,textColor=AMBER)))
st.append(Spacer(1,7*mm))
st.append(Paragraph('영상 제작 · 숏폼 배포 · 영상 판매 · 유튜브 쇼츠 커머스 · 추천/맞구독.<br/>한 사람이 다섯 갈래의 수익 파이프라인을 동시에 운영하는<br/>크리에이터–광고주 올인원 플랫폼.',
    ParagraphStyle('x',fontName=R,fontSize=12,leading=20,textColor=colors.HexColor('#D9D5E8'))))
st.append(Spacer(1,12*mm))
chips=Table([[Paragraph(f'<font color="#FCD34D">▪</font> {t}',ParagraphStyle('cp',fontName=R,fontSize=9,textColor=colors.white)) for t in ['캠페인','배포','영상판매','쇼츠 커머스','추천·맞구독']]],
            colWidths=[33*mm]*5)
chips.setStyle(TableStyle([('LEFTPADDING',(0,0),(-1,-1),0)]))
st.append(chips)
st.append(Spacer(1,10*mm))
st.append(Paragraph('투자 · 제휴 · 크리에이터 모집용  |  2025',ParagraphStyle('x',fontName=R,fontSize=9.5,textColor=GRAY2)))
st.append(PageBreak())

# TOC
st.append(P('목차','h1')); st.append(Rule(PURPLE)); st.append(Spacer(1,6))
toc=[('01','서비스 개요 · 슬로건'),('02','문제 정의와 솔루션'),('03','크리에이터 수익구조 — 5대 파이프라인'),
 ('04','① 캠페인 참여 (배포 / 영상제작 분리)'),('05','② 영상 판매 (바이브포터)'),
 ('06','③ 유튜브 쇼츠 커머스 (카페24 연동)'),('07','④ 쇼츠 자체 수익 · ⑤ 추천/맞구독'),
 ('08','통합 월 수익 시뮬레이션'),('09','광고주 혜택 · 청구단가 · 회사 마진 구조'),
 ('10','플랫폼 강점 · AI 자동화'),('11','생태계 연동'),('12','이용 흐름 · 정산/포인트 정책'),
 ('13','시장 규모 · 성장성'),('14','FAQ'),('15','회사 정보 · 연락처 · CTA')]
rows=[[Paragraph(n,S['tocb']),Paragraph(t,S['toc'])] for n,t in toc]
tt=Table(rows,colWidths=[16*mm,148*mm])
tt.setStyle(TableStyle([('LINEBELOW',(0,0),(-1,-1),0.4,LINE),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),('VALIGN',(0,0),(-1,-1),'MIDDLE')]))
st.append(tt); st.append(PageBreak())

# 01
st+=section('01','서비스 개요','doc',PURPLE)
st.append(P('<b>VIBEACTION</b>는 AI 시대의 숏폼 콘텐츠를 중심으로 <b>크리에이터의 다양한 수익 활동</b>과 <b>광고주의 효율적 마케팅</b>, 그리고 <b>커머스 판매</b>까지 하나로 연결하는 올인원 플랫폼입니다. 경험이 없어도 AI 도구와 표준화된 워크플로우를 따라 영상 제작·배포·판매에 참여하고, 본인 채널을 운영하며 상품을 판매하는 커머스로 확장할 수 있습니다.'))
st.append(P('핵심은 <b>다중 수익 파이프라인</b>입니다. 캠페인 참여, 숏폼 배포, 영상 제작·판매, 유튜브 쇼츠 커머스, 추천·맞구독을 동시에 운영해 안정적인 부수입 구조를 만듭니다.'))
st.append(Spacer(1,4))
st.append(tbl([[Paragraph('구분',S['cellhl']),Paragraph('한 줄 정의',S['cellhl'])],
 [Paragraph('슬로건',S['cellbl']),Paragraph('"숏폼으로 수익을 만들다" — 누구나, 무경험에서, 다섯 갈래로',S['cell'])],
 [Paragraph('크리에이터',S['cellbl']),Paragraph('AI 숏폼으로 제작·배포·판매·커머스·추천까지 다중 수익을 올리는 부업 플랫폼',S['cell'])],
 [Paragraph('광고주',S['cellbl']),Paragraph('검증된 크리에이터 풀로 숏폼 제작·배포를 빠르고 합리적으로 집행',S['cell'])],
 [Paragraph('커머스',S['cellbl']),Paragraph('카페24 연동 상품을 크리에이터 쇼츠에 연결해 판매·정산까지 자동화',S['cell'])]],
 [30*mm,135*mm]))
st.append(PageBreak())

# 02
st+=section('02','문제 정의와 솔루션','target',PINK)
st.append(P('왜 필요한가','h2'))
st+=blist(['<b>크리에이터</b> — 숏폼 수익화는 진입장벽(구독자/조회수 조건)과 단발성 수익에 그쳐 꾸준한 부수입으로 잇기 어렵다.',
 '<b>예비 창작자</b> — 영상 제작 경험·AI 도구 활용법이 없어 시작 자체가 막막하다.',
 '<b>광고주</b> — 숏폼 제작·배포를 빠르게, 합리적 단가로, 다수 채널에 집행하기 어렵다.',
 '<b>커머스 셀러</b> — 콘텐츠와 판매(결제·배송)가 분리돼 전환·운영 비용이 크다.'],dot=PINK)
st.append(P('솔루션','h2'))
st+=blist(['<b>다중 수익 구조</b> — 조건 없는 배포부터 제작·판매·커머스·추천까지 한 계정에서 조합.',
 '<b>무경험 친화</b> — AI 영상 제작 가이드 + 표준 캠페인/정산으로 누구나 시작.',
 '<b>표준 캠페인·포인트 정산</b> — 광고주는 명확한 단가와 포인트로 투명하게 집행.',
 '<b>콘텐츠=커머스</b> — 카페24 연동으로 쇼츠가 곧 판매 채널이 되고 결제·배송은 자동.'])
st.append(Spacer(1,5))
st.append(FlowDiagram(['문제 : 단발·고진입·분절','VIBEACTION : 다중 파이프라인','결과 : 지속 가능한 수익'],PINK,h=20*mm))
st.append(PageBreak())

# 03
st+=section('03','크리에이터 수익구조 — 5대 파이프라인','layers',PURPLE)
st.append(P('크리에이터는 아래 다섯 가지를 자유롭게 조합합니다. 각 파이프라인의 상세 흐름·단가는 이어지는 페이지에서 다룹니다.','muted'))
st.append(Spacer(1,4))
st.append(tbl([[Paragraph('파이프라인',S['cellhl']),Paragraph('수익 방식',S['cellh']),Paragraph('핵심',S['cellhl'])],
 [Paragraph('① 캠페인 참여',S['cellbl']),Paragraph('배포 건당 단가 / 영상제작 단가',S['cellc']),Paragraph('배포·영상제작 분리 참여',S['cell'])],
 [Paragraph('② 영상 판매',S['cellbl']),Paragraph('영상 1건 판매가의 일부 적립',S['cellc']),Paragraph('바이브포터 마켓 판매',S['cell'])],
 [Paragraph('③ 쇼츠 커머스',S['cellbl']),Paragraph('판매가 × 수수료율',S['cellc']),Paragraph('카페24 연동 상품 판매',S['cell'])],
 [Paragraph('④ 쇼츠 자체 수익',S['cellbl']),Paragraph('조회수 기반 쇼츠 수익화',S['cellc']),Paragraph('영상 자체가 추가 수익원',S['cell'])],
 [Paragraph('⑤ 추천·맞구독',S['cellbl']),Paragraph('추천 수당 + 채널 성장',S['cellc']),Paragraph('네트워크로 수익 가속',S['cell'])]],
 [34*mm,72*mm,59*mm]))
st.append(PageBreak())

# 04
st+=section('04','① 캠페인 참여 — 배포 / 영상제작 분리','megaphone',PURPLE)
st.append(P('광고주가 등록한 캠페인에 참여해 보상을 받습니다. "영상제작 + 배포" 캠페인은 <b>배포</b>와 <b>영상제작</b>이 별도 슬롯으로 분리되어 각각 신청할 수 있고, 배포 참여자는 이미 제작된 영상을 받아 "퍼가서" 내 채널에 올립니다.'))
st.append(FlowDiagram(['캠페인 선택 / 유형 신청','승인 후 제작 또는 영상 퍼가기','SNS 업로드 · 결과 제출','검수 승인 시 지갑 적립'],PURPLE))
st.append(Spacer(1,6)); st.append(P('단가 구조 (기본값 예시)','h2'))
st.append(P('배포 — 플랫폼별 건당','h3'))
st.append(tbl([[Paragraph('항목',S['cellhl']),Paragraph('크리에이터 지급',S['cellh']),Paragraph('광고주 청구',S['cellh']),Paragraph('회사 마진',S['cellh'])],
 [Paragraph('YouTube / IG / TikTok / FB (각)',S['cell']),Paragraph('10,000원',S['cellc']),Paragraph('15,000원',S['cellc']),Paragraph('5,000원',S['cellb'])],
 [Paragraph('4개 플랫폼 동시 (1세트)',S['cell']),Paragraph('40,000원',S['cellc']),Paragraph('60,000원',S['cellc']),Paragraph('20,000원',S['cellb'])]],
 [66*mm,33*mm,33*mm,33*mm]))
st.append(P('영상 제작 — 길이 구간별 건당','h3'))
st.append(tbl([[Paragraph('영상 길이',S['cellh']),Paragraph('크리에이터 제작단가',S['cellh']),Paragraph('광고주 청구단가',S['cellh']),Paragraph('회사 마진',S['cellh'])],
 [Paragraph('15초 이하',S['cellc']),Paragraph('3,000원',S['cellc']),Paragraph('10,000원',S['cellc']),Paragraph('7,000원',S['cellb'])],
 [Paragraph('30초 이하',S['cellc']),Paragraph('5,000원',S['cellc']),Paragraph('15,000원',S['cellc']),Paragraph('10,000원',S['cellb'])],
 [Paragraph('60초 이하',S['cellc']),Paragraph('8,000원',S['cellc']),Paragraph('25,000원',S['cellc']),Paragraph('17,000원',S['cellb'])],
 [Paragraph('90초 이하',S['cellc']),Paragraph('12,000원',S['cellc']),Paragraph('35,000원',S['cellc']),Paragraph('23,000원',S['cellb'])]],
 [41*mm,42*mm,42*mm,40*mm]))
st.append(P('예시) 30초 배포 20건 + 60초 제작 10건 = (10,000×20)+(8,000×10) = 280,000원/월','muted'))
st.append(PageBreak())

# 05
st+=section('05','② 영상 판매 — 바이브포터','film',AMBER)
st.append(P('AI로 제작한 숏폼 영상을 <b>바이브포터</b> 마켓에 등록해 판매합니다. 한 번 만든 영상이 반복 수익으로 이어지며, 크리에이터는 길이 구간별 적립 단가를 받습니다. (구매·할인 등 거래는 바이브포터 앱에서 진행)'))
st.append(FlowDiagram(['영상 제작 · 등록','관리자 노출 승인','마켓에서 판매','판매분 적립'],AMBER))
st.append(Spacer(1,6)); st.append(P('영상 판매 적립 단가 (예시)','h2'))
st.append(tbl([[Paragraph('영상 길이',S['cellh']),Paragraph('판매가',S['cellh']),Paragraph('크리에이터 적립',S['cellh']),Paragraph('비고',S['cellhl'])],
 [Paragraph('30초 이하',S['cellc']),Paragraph('3,000원',S['cellc']),Paragraph('1,500원',S['cellb']),Paragraph('플랫폼 수수료 별도(20% 기준)',S['cell'])],
 [Paragraph('60초 이하',S['cellc']),Paragraph('5,000원',S['cellc']),Paragraph('2,500원',S['cellb']),Paragraph('대량 등록 시 누적 수익',S['cell'])],
 [Paragraph('90초 이하',S['cellc']),Paragraph('7,000원',S['cellc']),Paragraph('3,500원',S['cellb']),Paragraph('재판매 가능',S['cell'])],
 [Paragraph('90초 초과',S['cellc']),Paragraph('10,000원',S['cellc']),Paragraph('5,000원',S['cellb']),Paragraph('-',S['cell'])]],
 [34*mm,30*mm,38*mm,63*mm]))
st.append(P('예시) 60초 영상 50건 판매 = 2,500 × 50 = 125,000원 (누적 카탈로그가 커질수록 수익 증가)','muted'))
st.append(Spacer(1,3))
st.append(P('또한 바이브포터에서 구매한 영상을 가져와 <b>쇼츠 커머스 운영</b>에 활용할 수 있어, 제작이 어려운 크리에이터도 커머스에 바로 참여할 수 있습니다.'))
st.append(PageBreak())

# 06
st+=section('06','③ 유튜브 쇼츠 커머스 — 카페24 연동','cart',PINK)
st.append(P('본인이 운영하는 유튜브 채널의 쇼츠에 상품을 연동해 <b>판매 수수료</b>를 얻습니다. 최고관리자가 등록한 상품(카페24 연동)을 영상 내용에 맞게 <b>자동 추천</b>받아 연결하고, 결제·배송은 카페24로 처리됩니다.'))
st.append(FlowDiagram(['운영 채널 등록','쇼츠 링크 입력 → 상품 추천','상품 연동 (여러 개)','구매 발생 → 수수료 적립'],PINK))
st.append(Spacer(1,6)); st.append(P('상품 1건 판매 시 적립 = 판매가 × 수수료율 (상품별 8~15%, 예시)','h2'))
st.append(tbl([[Paragraph('상품 (카테고리)',S['cellhl']),Paragraph('판매가',S['cellh']),Paragraph('수수료율',S['cellh']),Paragraph('건당 적립',S['cellh'])],
 [Paragraph('뷰티 — 수분 세럼',S['cell']),Paragraph('24,900원',S['cellc']),Paragraph('12%',S['cellc']),Paragraph('2,988원',S['cellb'])],
 [Paragraph('패션 — 후드 티셔츠',S['cell']),Paragraph('32,000원',S['cellc']),Paragraph('15%',S['cellc']),Paragraph('4,800원',S['cellb'])],
 [Paragraph('식품 — 원두 커피',S['cell']),Paragraph('21,900원',S['cellc']),Paragraph('10%',S['cellc']),Paragraph('2,190원',S['cellb'])],
 [Paragraph('디지털 — 무선 이어폰',S['cell']),Paragraph('59,000원',S['cellc']),Paragraph('8%',S['cellc']),Paragraph('4,720원',S['cellb'])],
 [Paragraph('반려 — 관절 영양제',S['cell']),Paragraph('29,000원',S['cellc']),Paragraph('14%',S['cellc']),Paragraph('4,060원',S['cellb'])]],
 [64*mm,32*mm,30*mm,39*mm]))
st.append(P('객단가·건수 가정 시뮬레이션','h2'))
st.append(tbl([[Paragraph('활동 강도',S['cellh']),Paragraph('가정',S['cellh']),Paragraph('예상 월 수익',S['cellh'])],
 [Paragraph('가볍게 (월 4편)',S['cellc']),Paragraph('쇼츠당 월 5건 · 객단가 3천원대',S['cellc']),Paragraph('약 6~10만원',S['cellb'])],
 [Paragraph('꾸준히 (월 12편)',S['cellc']),Paragraph('쇼츠당 월 8건',S['cellc']),Paragraph('약 25~40만원',S['cellb'])],
 [Paragraph('전업급 (월 30편)',S['cellc']),Paragraph('쇼츠당 월 12건',S['cellc']),Paragraph('약 90~150만원',S['cellb'])]],
 [44*mm,76*mm,45*mm],head=PINK))
st.append(PageBreak())

# 07
st+=section('07','④ 쇼츠 자체 수익 · ⑤ 추천/맞구독','play',GREEN)
st.append(P('④ 쇼츠 자체 수익','h2'))
st.append(P('상품 판매 수수료와 별개로, 내 채널에 올린 쇼츠는 <b>조회수 기반 유튜브 쇼츠 수익화</b>로도 수익이 발생합니다. 영상 한 편이 "상품 판매 + 영상 자체 수익" 두 갈래로 작동합니다.'))
st+=blist(['상품 판매 수수료 (판매가 × 수수료율)','쇼츠 조회수 기반 영상 수익','콘텐츠 누적 = 수익 누적'],dot=GREEN)
st.append(Spacer(1,4)); st.append(P('⑤ 추천 · 맞구독','h2'))
st.append(P('지인 초대(추천 수당)와 회원 간 <b>맞구독</b>으로 네트워크를 키워 수익과 채널 성장을 동시에 얻습니다. 맞구독으로 초기 구독자를 확보하면 내 채널을 빠르게 "수익 채널"로 전환할 수 있습니다.'))
st.append(FlowDiagram(['추천 링크 공유 / 맞구독','신규 가입 · 구독 확보','수익화 조건 도달 가속','커머스 · 영상 수익 가동'],GREEN))
st.append(Spacer(1,3))
st+=blist(['추천 링크로 가입 시 고정 추천 수당 지급 (정책에 따라)','회원 맞구독으로 초기 구독자 확보 → 수익 채널 전환','추천 인원 제한 없음 — 네트워크가 클수록 자동 수익'],dot=GREEN)
st.append(PageBreak())

# 08
st+=section('08','통합 월 수익 시뮬레이션','chart',PURPLE)
st.append(P('여러 파이프라인을 동시에 운영했을 때의 합산 예시입니다. (가정치이며 실제 수익은 활동량·전환율에 따라 달라집니다)','muted'))
st.append(Spacer(1,4))
st.append(tbl([[Paragraph('시나리오',S['cellhl']),Paragraph('배포',S['cellh']),Paragraph('영상제작',S['cellh']),Paragraph('쇼츠 커머스',S['cellh']),Paragraph('추천/기타',S['cellh']),Paragraph('월 합계',S['cellh'])],
 [Paragraph('라이트',S['cellbl']),Paragraph('20건 20만',S['cellc']),Paragraph('-',S['cellc']),Paragraph('~6만',S['cellc']),Paragraph('~4만',S['cellc']),Paragraph('약 30만원',S['cellb'])],
 [Paragraph('액티브',S['cellbl']),Paragraph('40건 40만',S['cellc']),Paragraph('10건 5만',S['cellc']),Paragraph('~30만',S['cellc']),Paragraph('~15만',S['cellc']),Paragraph('약 90~120만원',S['cellb'])],
 [Paragraph('전업',S['cellbl']),Paragraph('80건 80만',S['cellc']),Paragraph('30건 24만',S['cellc']),Paragraph('~120만',S['cellc']),Paragraph('~30만',S['cellc']),Paragraph('약 200만원+',S['cellb'])]],
 [24*mm,28*mm,26*mm,30*mm,26*mm,31*mm]))
st.append(Spacer(1,6))
st.append(P('핵심: 단일 활동이 아니라 <b>조합</b>이 수익을 키웁니다. 배포로 기본 수익을 깔고, 제작·판매로 단가를 높이며, 쇼츠 커머스로 상한을 끌어올리고, 추천/맞구독으로 자동화·가속하는 구조입니다.'))
st.append(PageBreak())

# 09
st+=section('09','광고주 혜택 · 청구단가 · 회사 마진 구조','building',BLUE)
st.append(P('광고주(실행사·대행사·제작의뢰인)는 포인트를 충전해 캠페인을 집행하고, 회사는 청구단가와 크리에이터 지급단가의 차액을 마진으로 확보합니다.'))
st.append(P('혜택','h3'))
st+=blist(['검증된 크리에이터 풀로 제작·배포를 빠르게 집행','4대 플랫폼 동시 배포로 도달 극대화',
 '브랜드 세이프티(금칙어·경쟁사·성인/폭력/정치 제외) 옵션','UTM·프로모션 코드·KPI 성과 추적','포인트 기반 투명 정산'],dot=BLUE)
st.append(P('마진 구조','h3'))
st.append(tbl([[Paragraph('항목',S['cellhl']),Paragraph('광고주 청구',S['cellh']),Paragraph('크리에이터 지급',S['cellh']),Paragraph('회사 마진',S['cellh'])],
 [Paragraph('배포 1건',S['cell']),Paragraph('15,000원',S['cellc']),Paragraph('10,000원',S['cellc']),Paragraph('5,000원 (33%)',S['cellb'])],
 [Paragraph('영상제작 30초',S['cell']),Paragraph('15,000원',S['cellc']),Paragraph('5,000원',S['cellc']),Paragraph('10,000원 (67%)',S['cellb'])],
 [Paragraph('영상제작 60초',S['cell']),Paragraph('25,000원',S['cellc']),Paragraph('8,000원',S['cellc']),Paragraph('17,000원 (68%)',S['cellb'])],
 [Paragraph('쇼츠 커머스',S['cell']),Paragraph('상품 판매가',S['cellc']),Paragraph('수수료(8~15%)',S['cellc']),Paragraph('상품 마진 + 운영 수수료',S['cellb'])],
 [Paragraph('대행사 거래',S['cell']),Paragraph('대행사 집행액',S['cellc']),Paragraph('-',S['cellc']),Paragraph('실행사 수직 수수료 5%',S['cellb'])]],
 [34*mm,34*mm,38*mm,59*mm],head=BLUE))
st.append(P('* 단가는 관리자 정책으로 조정 가능. 제작·배포 마진은 카탈로그가 커질수록 규모의 경제가 작동합니다.','muted'))
st.append(PageBreak())

# 10
st+=section('10','플랫폼 강점 · AI 자동화','star',AMBER)
st+=blist(['<b>다중 수익 구조</b> — 한 계정에서 5개 파이프라인 동시 운영',
 '<b>무경험 친화</b> — AI 영상 제작 가이드·툴 매트릭스로 진입장벽 제거',
 '<b>AI 영상 제작 자동화</b> — 스크립트(ChatGPT/Claude)·생성(Runway·Pika·Kling)·편집(CapCut AI)·음성(ElevenLabs·HeyGen)·썸네일(Midjourney)',
 '<b>콘텐츠=커머스</b> — 카페24 연동으로 쇼츠가 즉시 판매 채널',
 '<b>커뮤니티 성장</b> — 회원 맞구독으로 초기 채널 성장 가속',
 '<b>투명 정산</b> — 지갑/포인트 원장 기반 수익·비용 관리'],dot=AMBER)
st.append(Spacer(1,4))
st.append(FlowDiagram(['AI 스크립트','AI 영상 생성','AI 편집 · 음성','업로드 · 배포 · 판매'],AMBER,h=20*mm))
st.append(PageBreak())

# 11
st+=section('11','생태계 연동','link',PURPLE)
st.append(P('VIBEACTION는 단독 서비스가 아니라 확장 가능한 생태계로 설계되었습니다.'))
st.append(tbl([[Paragraph('연동',S['cellhl']),Paragraph('역할',S['cellh']),Paragraph('VIBEACTION 연결점',S['cellhl'])],
 [Paragraph('바이브포터',S['cellbl']),Paragraph('영상 거래(제작·구매) 마켓',S['cellc']),Paragraph('영상 판매 수익 / 구매 영상으로 쇼츠 커머스 운영',S['cell'])],
 [Paragraph('AI스토리',S['cellbl']),Paragraph('맞춤 동화 제작 의뢰',S['cellc']),Paragraph('동화 제작 의뢰 수신·연동 (관리자 AI스토리 연동)',S['cell'])],
 [Paragraph('카페24',S['cellbl']),Paragraph('커머스(상품·결제·배송)',S['cellc']),Paragraph('상품 등록·연동, 쇼츠 판매·발주·배송 처리',S['cell'])],
 [Paragraph('바이브API',S['cellbl']),Paragraph('공통 API / 연동 레이어',S['cellc']),Paragraph('외부 서비스·자동화 확장 기반',S['cell'])]],
 [26*mm,52*mm,87*mm]))
st.append(P('* 어댑터 구조로 설계되어 API 키 입력 시 실연동, 미입력 시 미리보기(mock)로 안전하게 동작합니다.','muted'))
st.append(PageBreak())

# 12
st+=section('12','이용 흐름 · 정산/포인트 정책','flow',PURPLE)
st.append(P('크리에이터','h3'))
st.append(FlowDiagram(['가입 · SNS/운영채널 등록','활동 선택 (배포·제작·커머스)','제작 / 배포 / 판매','지갑 적립 → 출금 신청'],PURPLE))
st.append(Spacer(1,5)); st.append(P('광고주','h3'))
st.append(FlowDiagram(['가입 · 포인트 충전','캠페인 등록 (유형·단가·KPI)','집행 · 결과 검수/승인','성과 확인 · 정산'],BLUE))
st.append(Spacer(1,5)); st.append(P('정산 · 포인트 정책','h2'))
st+=blist(['<b>크리에이터 지갑</b> — 적립(pending) → 작업 승인 시 출금가능(available) → 출금 신청/지급',
 '<b>광고주 포인트</b> — 충전·환불·사용 원장 관리, 캠페인 집행 시 자동 차감',
 '<b>원천징수</b> — 출금 시 관련 세무 처리 후 지급(주민번호는 처리 후 폐기)',
 '<b>대행사 정산</b> — 실행사–대행사 수직 수수료(예: 5%) 자동 반영'])
st.append(PageBreak())

# 13
st+=section('13','시장 규모 · 성장성','globe',GREEN)
st.append(P('숏폼은 전 세계 사용자가 가장 많은 시간을 쓰는 포맷이며, 커머스·크리에이터 이코노미와 결합해 빠르게 성장하고 있습니다. (아래 플랫폼 사용자 수는 업계 공개 발표 기준의 개략치이며 시점에 따라 변동될 수 있습니다.)'))
st.append(tbl([[Paragraph('플랫폼',S['cellhl']),Paragraph('월 사용자(개략)',S['cellh']),Paragraph('특징',S['cellhl'])],
 [Paragraph('YouTube Shorts',S['cell']),Paragraph('약 20억+',S['cellc']),Paragraph('세계 최대 동영상, 숏폼 급성장',S['cell'])],
 [Paragraph('Instagram',S['cell']),Paragraph('약 20억+',S['cellc']),Paragraph('릴스 알고리즘 노출 강점',S['cell'])],
 [Paragraph('TikTok',S['cell']),Paragraph('약 10억+',S['cellc']),Paragraph('Z세대 숏폼 1위, 바이럴',S['cell'])],
 [Paragraph('Facebook',S['cell']),Paragraph('약 30억+',S['cellc']),Paragraph('전 연령 광범위 도달',S['cell'])]],
 [42*mm,38*mm,85*mm],head=GREEN))
st.append(P('성장 동력','h3'))
st+=blist(['AI 영상 생성 비용 급감 → 누구나 대량 제작 가능','숏폼 커머스(라이브/숏핑) 확산 → 콘텐츠–판매 결합 가속','크리에이터 이코노미 확대 → 부업·N잡 수요 증가'],dot=GREEN)
st.append(P('* 구체적 시장 규모(TAM/SAM)는 추정 기관·기준에 따라 차이가 큽니다. 투자 검토 시 별도 시장 자료와 함께 확인을 권장합니다.','muted'))
st.append(PageBreak())

# 14
st+=section('14','자주 묻는 질문 (FAQ)','question',PINK)
for q,a in [
 ('Q. 영상 제작 경험이 없어도 되나요?','네. AI 도구 가이드와 표준 워크플로우가 제공되며, 조건 없는 숏폼 배포부터 시작할 수 있습니다.'),
 ('Q. 가입비가 있나요?','기본 가입비는 0원입니다. 일부 정책(구독/유료 모델)은 관리자 설정에 따라 달라질 수 있습니다.'),
 ('Q. 쇼츠 커머스 상품은 어디서 오나요?','최고관리자가 등록한 카페24 연동 상품 중 영상 내용에 맞는 상품을 추천받아 연결합니다.'),
 ('Q. 직접 영상을 못 만들면 커머스를 못 하나요?','바이브포터에서 구매한 영상으로도 쇼츠 커머스를 운영할 수 있습니다.'),
 ('Q. 정산/출금은 어떻게 되나요?','적립금은 작업 승인 후 출금 가능 상태로 전환되며, 언제든 출금 신청할 수 있습니다.'),
 ('Q. 광고주는 어떻게 비용을 집행하나요?','포인트를 충전해 캠페인 단가에 따라 자동 차감되며, 내역은 원장으로 투명하게 관리됩니다.')]:
    st.append(P(q,'h3')); st.append(P(a,'body'))
st.append(PageBreak())

# 15
st+=section('15','회사 정보 · 연락처','mail',PURPLE)
st.append(tbl([[Paragraph('항목',S['cellhl']),Paragraph('내용',S['cellhl'])],
 [Paragraph('서비스명',S['cellbl']),Paragraph('VIBEACTION (바이브액션)',S['cell'])],
 [Paragraph('분야',S['cellbl']),Paragraph('AI 숏폼 크리에이터 부업 · 커머스 플랫폼',S['cell'])],
 [Paragraph('웹사이트',S['cellbl']),Paragraph('vibeaction.com',S['cell'])],
 [Paragraph('문의',S['cellbl']),Paragraph('제휴·투자·입점 문의: 앱 내 문의 또는 운영팀 이메일',S['cell'])]],
 [30*mm,135*mm]))
st.append(Spacer(1,12))
close=Table([[Paragraph('지금 VIBEACTION에서 나만의 숏폼 수익 파이프라인을 시작하세요.',
    ParagraphStyle('cl',fontName=B,fontSize=13.5,leading=20,textColor=colors.white,alignment=TA_CENTER))]],colWidths=[165*mm])
close.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),PURPLE),('TOPPADDING',(0,0),(-1,-1),17),('BOTTOMPADDING',(0,0),(-1,-1),17)]))
st.append(close); st.append(Spacer(1,4))
ac=Table([[Paragraph('크리에이터 가입 · 광고주 캠페인 · 제휴 제안 모두 환영합니다',
    ParagraphStyle('cl',fontName=R,fontSize=10.5,leading=16,textColor=DARK,alignment=TA_CENTER))]],colWidths=[165*mm])
ac.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),AMBER),('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),10)]))
st.append(ac); st.append(Spacer(1,8))
st.append(Paragraph('© 2025 VIBEACTION. 본 소개서의 수치/단가는 예시이며 플랫폼 정책에 따라 변동될 수 있습니다.',S['foot']))

doc.build(st)
print("PDF built", OUT, os.path.getsize(OUT), "bytes")
