#!/usr/bin/env python3
"""R230 image-integrity gate: compare the generated Android pixels to official PWA PNGs."""
import json
import re
from pathlib import Path
from PIL import Image, ImageChops

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'
DEST=ROOT/'android-cliente/app/src/main/res'


def check(ok,why):
    if not ok:raise SystemExit('R230 ICON GATE REPROVADO: '+why)
    print('OK: '+why)


def load(path):
    check(path.is_file(),str(path.relative_to(ROOT))+' existe')
    with Image.open(path) as image:
        image.load()
        return image.convert('RGBA')


def equal_pixels(actual,expected,why):
    check(actual.size==expected.size and not any(channel.getbbox() for channel in ImageChops.difference(actual,expected).split()),why)


def main():
    from importlib.machinery import SourceFileLoader
    # Usar somente o shape helper; a verificacao independente compara tambem os pixels.
    module=SourceFileLoader('r230_client_icon_builder',str(ROOT/'scripts/prepare-client-android.py')).load_module()
    manifest=json.loads((PUBLIC/'manifest.json').read_text(encoding='utf-8'))
    for file,purpose in [('icon-192x192.png','any'),('icon-512x512.png','any'),('icon-maskable-512x512.png','maskable')]:
        check(any(isinstance(x,dict) and x.get('src','').split('?')[0]=='/'+file and purpose in x.get('purpose','any').split() for x in manifest['icons']),file+' registrado no manifesto do PWA')
    standard192=load(PUBLIC/'icon-192x192.png')
    maskable512=load(PUBLIC/'icon-maskable-512x512.png')
    equal_pixels(load(DEST/'drawable-nodpi/ic_launcher_foreground.png'),maskable512.resize((432,432),Image.Resampling.LANCZOS),'adaptive foreground = PWA maskable sem reducao, padding ou troca da arte')
    for density,size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
        icon=load(DEST/f'mipmap-{density}/ic_launcher.png')
        round_icon=load(DEST/f'mipmap-{density}/ic_launcher_round.png')
        equal_pixels(icon,module.rounded_launcher(standard192,size),'icone '+density+' = PWA original com recorte de bordas')
        equal_pixels(round_icon,module.rounded_launcher(standard192,size,round_icon=True),'icone redondo '+density+' = PWA original com mascara circular')
        check(icon.getpixel((0,0))[3]==0 and round_icon.getpixel((0,0))[3]==0,'bordas transparentes '+density)
        check(icon.getpixel((size//2,size//2))[3]>0,'centro visivel '+density)
    colors=(DEST/'values/colors.xml').read_text(encoding='utf-8')
    theme=str(manifest['theme_color']).upper()
    check(f'name="ic_launcher_background">{theme}' in colors,'background adaptive igual ao tema oficial PWA')
    check(f'name="cliente_system_bar">{theme}' in colors,'status bar combina com o PWA')
    adaptive=(DEST/'mipmap-anydpi-v26/ic_launcher.xml').read_text(encoding='utf-8')
    check('@drawable/ic_launcher_foreground' in adaptive and '@color/ic_launcher_background' in adaptive,'mascara adaptive Android preservada')
    gradle=(ROOT/'android-cliente/app/build.gradle').read_text(encoding='utf-8')
    check('applicationId "br.com.dafamilialanches.cliente"' in gradle,'identidade cliente distinta de admin')
    print('R230: CERTIFICACAO DE ICONES ANDROID / PWA APROVADA')

if __name__=='__main__':main()
