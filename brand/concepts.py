import cairosvg, io
from PIL import Image, ImageDraw, ImageFont
SH = "M256 88 L396 138 V250 C396 344 336 408 256 440 C176 408 116 344 116 250 V138 Z"
def bg(c1, c2):
    return f'''<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient>
<clipPath id="sh"><path d="{SH}"/></clipPath></defs><rect width="512" height="512" rx="112" fill="url(#bg)"/>'''
A = bg('#1A73E8','#5B2EE0') + f'''<path d="{SH}" fill="#FFFFFF"/>
<g clip-path="url(#sh)"><polyline points="90,268 190,268 216,222 246,322 278,180 304,268 430,268" fill="none" stroke="#2F51E4" stroke-width="26" stroke-linejoin="round" stroke-linecap="round"/></g>
<circle cx="384" cy="132" r="40" fill="#2F51E4"/><circle cx="384" cy="132" r="26" fill="#FFC107"/>'''
B = bg('#0B57D0','#0E8A7A') + f'''<path d="{SH}" fill="#FFFFFF"/>
<g clip-path="url(#sh)"><circle cx="256" cy="300" r="70" fill="#FFB300"/><rect x="100" y="300" width="320" height="200" fill="#0B57D0"/>
<g stroke="#FFB300" stroke-width="16" stroke-linecap="round"><line x1="256" y1="196" x2="256" y2="168"/><line x1="182" y1="226" x2="162" y2="206"/><line x1="330" y1="226" x2="350" y2="206"/></g>
<rect x="150" y="320" width="212" height="14" rx="7" fill="#FFFFFF" opacity=".9"/><rect x="186" y="352" width="140" height="14" rx="7" fill="#FFFFFF" opacity=".6"/></g>'''
C = bg('#101828','#1F3A8A') + f'''<path d="{SH}" fill="url(#bg2)"/><defs><linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4F8CFF"/><stop offset="1" stop-color="#7C4DFF"/></linearGradient></defs>
<polyline points="196,214 252,262 196,310" fill="none" stroke="#FFFFFF" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="272" y="300" width="64" height="26" rx="13" fill="#7CFFCB"/>'''
D = bg('#0B57D0','#6A3DE8') + f'''<g clip-path="url(#sh)"><rect x="100" y="80" width="320" height="380" fill="#FFFFFF"/>
<path d="M120 300 C190 300 200 196 256 196 C312 196 322 300 400 300 L400 460 L100 460 Z" fill="#A8C7FA"/></g>
<path d="{SH}" fill="none" stroke="#FFFFFF" stroke-width="6"/>
<circle cx="256" cy="196" r="22" fill="#0B57D0"/><circle cx="256" cy="196" r="10" fill="#FFC107"/>'''
concepts = {'A pulse shield':A,'B sunrise briefing':B,'C ops terminal':C,'D signal peak':D}
def png(svg, px):
    s=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{svg}</svg>'
    return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=s.encode(), output_width=px, output_height=px))).convert('RGBA')
W=300; sheet=Image.new('RGB',(4*(W+40)+40, W+190),'#F1F3F4'); d=ImageDraw.Draw(sheet)
f=ImageFont.truetype('/root/.fonts/Outfit_600SemiBold.ttf',22)
for i,(name,svg) in enumerate(concepts.items()):
    x=40+i*(W+40); sheet.paste(png(svg,W),(x,30),png(svg,W))
    for j,s in enumerate([96,48,24]):
        im=png(svg,s); sheet.paste(im,(x+[0,110,170][j],W+50),im)
    d.text((x,W+160),name,fill='#202124',font=f)
sheet.save('/tmp/claude-0/-home-claude/a16923f4-001c-592e-9fe9-2eac4e551645/scratchpad/concepts.png')
