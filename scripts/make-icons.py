"""Generates Vigil brand assets (launcher, adaptive, monochrome, splash, notification, favicon) from the vector logo."""
import cairosvg, os
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets')
GRAD = '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2DD4BF"/><stop offset="1" stop-color="#0E7490"/></linearGradient></defs>'
def mark(fill='url(#g)', ink='#04201C', ink_op=0.55):
    return (f'<path d="M32 4 L54 12 V30 C54 44 44.5 54.5 32 60 C19.5 54.5 10 44 10 30 V12 Z" fill="{fill}"/>'
            f'<circle cx="32" cy="31" r="14" fill="none" stroke="{ink}" stroke-width="2.5" stroke-opacity="{ink_op}"/>'
            f'<circle cx="32" cy="31" r="7" fill="none" stroke="{ink}" stroke-width="2.5" stroke-opacity="{ink_op}"/>'
            f'<path d="M32 31 L43.5 22.5 A14 14 0 0 1 46 31 Z" fill="{ink}" fill-opacity="0.75"/>'
            f'<circle cx="32" cy="31" r="2.6" fill="{ink}"/>')
def svg(body, bg=None, scale=1.0, size=64):
    off = size * (1 - scale) / 2
    rect = f'<rect width="{size}" height="{size}" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">{GRAD}{rect}<g transform="translate({off} {off}) scale({scale * size / 64})">{body}</g></svg>'
def png(name, s, px):
    cairosvg.svg2png(bytestring=s.encode(), write_to=os.path.join(OUT, name), output_width=px, output_height=px)
png('icon.png', svg(mark(), bg='#0A0E14', scale=0.78), 1024)
png('android-icon-foreground.png', svg(mark(), scale=0.56), 1024)       # adaptive safe zone
png('android-icon-background.png', svg('', bg='#0A0E14'), 1024)
png('android-icon-monochrome.png', svg(mark(fill='#FFFFFF', ink='#000000', ink_op=1), scale=0.56), 1024)
png('splash-icon.png', svg(mark(), scale=0.9), 512)
png('notification-icon.png', svg(mark(fill='#FFFFFF', ink='#000000', ink_op=1), scale=0.9), 96)
png('favicon.png', svg(mark(), bg='#0A0E14', scale=0.86), 64)
print('icons written')
