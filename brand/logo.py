"""SecOpsDaily logo: a security shield carrying a live pulse, with an amber
'daily alert' badge. Exports all Android launcher, splash and UI assets."""
import cairosvg, io, os, sys
from PIL import Image
SH = "M256 92 L392 140 V250 C392 342 334 404 256 436 C178 404 120 342 120 250 V140 Z"
PULSE = "92,266 188,266 214,224 244,318 276,176 304,266 432,266"
BLUE1, BLUE2, INK, AMBER = '#1A73E8', '#5B3DF5', '#2448E8', '#FFB300'

def mark(variant='color'):
    if variant == 'mono':  # drawn white-on-black; black is turned transparent by to_alpha()
        return f'''<defs><clipPath id="sh"><path d="{SH}"/></clipPath></defs><rect width="512" height="512" fill="#000"/>
<path d="{SH}" fill="#fff"/><g clip-path="url(#sh)"><polyline points="{PULSE}" fill="none" stroke="#000" stroke-width="28" stroke-linejoin="round" stroke-linecap="round"/></g>
<circle cx="380" cy="138" r="46" fill="#000"/><circle cx="380" cy="138" r="30" fill="#fff"/>'''
    return f'''<defs><clipPath id="sh"><path d="{SH}"/></clipPath>
<linearGradient id="ink" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{BLUE1}"/><stop offset="1" stop-color="{BLUE2}"/></linearGradient>
<linearGradient id="face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E8EEFF"/></linearGradient></defs>
<path d="{SH}" fill="url(#face)"/>
<g clip-path="url(#sh)"><polyline points="{PULSE}" fill="none" stroke="url(#ink)" stroke-width="28" stroke-linejoin="round" stroke-linecap="round"/></g>
<circle cx="380" cy="138" r="46" fill="#FFFFFF"/><circle cx="380" cy="138" r="30" fill="{AMBER}"/>'''

def bg(rx=112):
    return f'''<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{BLUE1}"/><stop offset="1" stop-color="{BLUE2}"/></linearGradient></defs>
<rect width="512" height="512" rx="{rx}" fill="url(#bg)"/>'''

def svg(body, scale=1.0, size=512):
    off = size*(1-scale)/2
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}"><g transform="translate({off} {off}) scale({scale})">{body}</g></svg>'

def render(s, px):
    return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=s.encode(), output_width=px, output_height=px))).convert('RGBA')

def to_alpha(im):
    # luminance becomes alpha: white = opaque white, black = transparent
    l = im.convert('L')
    out = Image.new('RGBA', im.size, (255, 255, 255, 0)); out.putalpha(l)
    return out

if __name__ == '__main__':
    out = sys.argv[1]
    def save(name, s, px): render(s, px).save(os.path.join(out, name))
    full = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{bg(0)}<g transform="translate(46 40) scale(0.82)">{mark()}</g></svg>'
    save('icon.png', full, 1024)
    save('android-icon-background.png', f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{bg(0)}</svg>', 1024)
    save('android-icon-foreground.png', svg(mark(), 0.6), 1024)      # inside the 66% adaptive safe zone
    to_alpha(render(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#000"/><g transform="translate(102.4 102.4) scale(0.6)">{mark("mono")}</g></svg>', 1024)).save(os.path.join(out, 'android-icon-monochrome.png'))
    save('splash-icon.png', svg(mark(), 0.92), 512)
    to_alpha(render(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#000"/><g transform="translate(20.5 20.5) scale(0.92)">{mark("mono")}</g></svg>', 96)).save(os.path.join(out, 'notification-icon.png'))
    save('favicon.png', f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{bg(112)}<g transform="translate(46 40) scale(0.82)">{mark()}</g></svg>', 64)
    with open(os.path.join(out, '..', 'brand', 'secopsdaily-mark.svg'), 'w') as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{mark()}</svg>')
    with open(os.path.join(out, '..', 'brand', 'secopsdaily-icon.svg'), 'w') as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{bg(112)}<g transform="translate(46 40) scale(0.82)">{mark()}</g></svg>')
    print('assets written')
