# -*- coding: utf-8 -*-
"""生成马卡龙记账 PWA 图标：192 / 512 / maskable / apple-touch-icon"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.dirname(os.path.abspath(__file__))
PINK = (255, 179, 186)
BLUE = (186, 225, 255)
GREEN = (186, 255, 201)
DEEP = (255, 143, 163)
WHITE = (255, 255, 255)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def rounded_gradient(size, radius, maskable=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    grad = Image.new("RGBA", (size, size))
    gd = ImageDraw.Draw(grad)
    for y in range(size):
        for_x_color = None
        t = y / size
        if t < 0.5:
            c = lerp(PINK, BLUE, t * 2)
        else:
            c = lerp(BLUE, GREEN, (t - 0.5) * 2)
        gd.line([(0, y), (size, y)], fill=c)
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    r = 0 if maskable else int(size * radius)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
    img.paste(grad, (0, 0), mask)
    return img


def draw_icon(size, radius=0.22, maskable=False, bg=None):
    img = rounded_gradient(size, radius, maskable)
    if bg:
        base = Image.new("RGBA", (size, size), bg + (255,))
        base.paste(img, (0, 0), img)
        img = base
    d = ImageDraw.Draw(img)
    # 白色圆
    scale = 1.0 if maskable else 1.0
    cr = int(size * 0.29 * scale)
    cx = cy = size // 2
    d.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=(255, 255, 255, 235))
    # “记”字
    font = None
    for fp in [r"C:\Windows\Fonts\msyhbd.ttc", r"C:\Windows\Fonts\msyh.ttc",
               r"C:\Windows\Fonts\simhei.ttf"]:
        if os.path.exists(fp):
            font = ImageFont.truetype(fp, int(cr * 1.15))
            break
    if font:
        text = "记"
        bbox = d.textbbox((0, 0), text, font=font)
        w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
        d.text((cx - w / 2 - bbox[0], cy - h / 2 - bbox[1]), text,
               font=font, fill=DEEP + (255,))
    return img


def main():
    specs = [
        ("icon-192.png", 192, 0.22, False, None),
        ("icon-512.png", 512, 0.22, False, None),
        ("icon-512-maskable.png", 512, 0.0, True, None),
        ("apple-touch-icon.png", 180, 0.22, False, (255, 247, 248)),
    ]
    for name, size, radius, maskable, bg in specs:
        img = draw_icon(size, radius, maskable, bg)
        img.save(os.path.join(OUT, name))
        print("saved", name, img.size)


if __name__ == "__main__":
    main()
