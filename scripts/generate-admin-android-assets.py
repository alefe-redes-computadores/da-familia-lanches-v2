from pathlib import Path
from PIL import Image, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "dfl-admin-icon-master.png"
RES = ROOT / "android-admin" / "app" / "src" / "main" / "res"

if not SOURCE.exists():
    raise SystemExit("Master icon ausente.")

master = Image.open(SOURCE).convert("RGBA")
bbox = master.getbbox()
if not bbox:
    raise SystemExit("Master icon transparente/vazio.")

cropped = master.crop(bbox)

def contain_rgba(image, size, ratio=0.78):
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    limit = max(1, int(size * ratio))
    content = ImageOps.contain(image, (limit, limit), Image.Resampling.LANCZOS)
    x = (size - content.width) // 2
    y = (size - content.height) // 2
    canvas.alpha_composite(content, (x, y))
    return canvas

def legacy_icon(size):
    bg = Image.new("RGBA", (size, size), (9, 9, 11, 255))
    fg = contain_rgba(cropped, size, 0.74)
    bg.alpha_composite(fg)
    return bg.convert("RGB")

densities = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}

for density, size in densities.items():
    folder = RES / f"mipmap-{density}"
    folder.mkdir(parents=True, exist_ok=True)
    icon = legacy_icon(size)
    icon.save(folder / "ic_launcher.png", optimize=True)
    icon.save(folder / "ic_launcher_round.png", optimize=True)

drawable = RES / "drawable-nodpi"
drawable.mkdir(parents=True, exist_ok=True)

foreground = contain_rgba(cropped, 432, 0.68)
foreground.save(drawable / "ic_launcher_foreground.png", optimize=True)

splash = Image.new("RGB", (1152, 1152), (9, 9, 11))
splash_fg = ImageOps.contain(cropped, (430, 430), Image.Resampling.LANCZOS)
x = (splash.width - splash_fg.width) // 2
y = (splash.height - splash_fg.height) // 2
splash_rgba = splash.convert("RGBA")
splash_rgba.alpha_composite(splash_fg, (x, y))
splash_rgba.convert("RGB").save(drawable / "splash.png", optimize=True)

# Ícone de notificação Android: branco sólido + transparência, derivado
# diretamente da silhueta alfa do Master. Engrossamos levemente para
# continuar legível na barra de status.
alpha = cropped.getchannel("A")
alpha = ImageOps.contain(alpha, (72, 72), Image.Resampling.LANCZOS)
alpha = alpha.filter(ImageFilter.MaxFilter(3))
alpha = alpha.point(lambda value: 255 if value >= 42 else 0)

stat = Image.new("RGBA", (96, 96), (255, 255, 255, 0))
mask = Image.new("L", (96, 96), 0)
mx = (96 - alpha.width) // 2
my = (96 - alpha.height) // 2
mask.paste(alpha, (mx, my))
stat.putalpha(mask)
stat.save(drawable / "ic_stat_dfl_admin.png", optimize=True)

for path in [
    drawable / "ic_launcher_foreground.png",
    drawable / "splash.png",
    drawable / "ic_stat_dfl_admin.png",
]:
    if not path.exists() or path.stat().st_size == 0:
        raise SystemExit(f"Asset Android não gerado: {path}")

print("ADMIN ANDROID ASSETS: OK")
