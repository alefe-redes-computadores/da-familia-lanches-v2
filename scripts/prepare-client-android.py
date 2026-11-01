#!/usr/bin/env python3
"""Build-time TWA Cliente derived from the reviewed Admin launcher. No app build in Termux.

The Admin files remain immutable. In CI we use the same stable Android signing
certificate for both app packages, declared independently by Digital Asset Links.
"""
from pathlib import Path
from PIL import Image, ImageOps, ImageFilter, ImageDraw, ImageChops
import json, re, shutil, sys

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'android-admin'
DEST=ROOT/'android-cliente'
TARGET_PACKAGE='br.com.dafamilialanches.cliente'
TARGET_HOST='dafamilialanches.com.br'
# O manifesto PUBLICO do PWA e a autoridade: nao copiar/recriar o logo Admin.
# Sem padding artificial nem fundo de outra identidade nos launchers.
PWA_STANDARD_192='icon-192x192.png'
PWA_STANDARD_512='icon-512x512.png'
PWA_MASKABLE_512='icon-maskable-512x512.png'


def pwa_assets():
    manifest=json.loads((ROOT/'public/manifest.json').read_text(encoding='utf-8'))
    entries=manifest.get('icons',[])
    for filename, dimensions, purpose in [
        (PWA_STANDARD_192,'192x192','any'),
        (PWA_STANDARD_512,'512x512','any'),
        (PWA_MASKABLE_512,'512x512','maskable'),
    ]:
        valid=any(
            str(item.get('src','')).split('?',1)[0]=='/'+filename and
            item.get('sizes')==dimensions and purpose in item.get('purpose','any').split()
            for item in entries if isinstance(item,dict)
        )
        if not valid:raise SystemExit('R230: manifesto PWA nao autoriza '+filename)
        if not (ROOT/'public'/filename).is_file():raise SystemExit('R230: PNG oficial ausente: '+filename)
    theme=str(manifest.get('theme_color','')).upper()
    if not re.fullmatch(r'#[0-9A-F]{6}',theme):raise SystemExit('R230: cor PWA invalida')
    def load(filename,size):
        with Image.open(ROOT/'public'/filename) as source:
            source.load()
            if source.size!=(size,size):raise SystemExit('R230: dimensoes invalidas '+filename)
            return source.convert('RGBA')
    return (load(PWA_STANDARD_192,192),load(PWA_STANDARD_512,512),load(PWA_MASKABLE_512,512),theme)


def rounded_launcher(source,size,round_icon=False):
    # Arredondamento NATIVO sem mudar os pixels centrais do icone oficial.
    image=source.resize((size,size),Image.Resampling.LANCZOS)
    factor=4
    mask=Image.new('L',(size*factor,size*factor),0)
    painter=ImageDraw.Draw(mask)
    bounds=(0,0,size*factor-1,size*factor-1)
    if round_icon:
        painter.ellipse(bounds,fill=255)
    else:
        painter.rounded_rectangle(bounds,radius=round(size*factor*.22),fill=255)
    antialias=mask.resize((size,size),Image.Resampling.LANCZOS)
    image.putalpha(ImageChops.multiply(image.getchannel('A'),antialias))
    return image



def once(text,old,new,where):
    if text.count(old)!=1:raise SystemExit(f'R229: ancora invalida {where}: {old}')
    return text.replace(old,new,1)

def rewrite(path,changes):
    s=path.read_text(encoding='utf-8')
    for old,new in changes:
        if old not in s:raise SystemExit(f'R229: ancora ausente {path.name}: {old}')
        s=s.replace(old,new)
    path.write_text(s,encoding='utf-8')

def rewrite_optional(path,changes):
    """Replace optional references only when present in each Java class."""
    source=path.read_text(encoding='utf-8')
    for old,new in changes:
        source=source.replace(old,new)
    path.write_text(source,encoding='utf-8')


def main():
    standard192, standard512, maskable512, theme_color=pwa_assets()
    if not SOURCE.joinpath('app/src/main/java/br/com/dafamilialanches/admin/EntryActivity.java').is_file():
        raise SystemExit('R229: template Admin nao encontrado')
    if DEST.exists():
        raise SystemExit('R229: android-cliente preexistente (recusa sobrescrever)')
    def ignored(base,names):
        return {n for n in names if n in ('.gradle','build','.idea')}
    shutil.copytree(SOURCE,DEST,ignore=ignored)
    main=DEST/'app/src/main'
    java=main/'java/br/com/dafamilialanches/admin'
    for path in sorted(java.glob('*.java')):
        # Cada classe Java precisa do package, mas nem todas contêm URL,
        # nomes visuais ou funções de diagnóstico. Esses dados são opcionais.
        rewrite(path,[('package br.com.dafamilialanches.admin','package '+TARGET_PACKAGE)])
        rewrite_optional(path,[
          ('admin.dafamilialanches.com.br',TARGET_HOST),
          ('DFL Admin','DFL Cliente'),('DFL ADMIN','DFL CLIENTE'),
          ('AdminInBrowser','ClienteInBrowser'),
          ('dfl_admin_native_diagnostics','dfl_cliente_native_diagnostics'),
        ])
    java.rename(java.parent/'cliente')
    manifest=main/'AndroidManifest.xml'
    rewrite(manifest,[('admin.dafamilialanches.com.br',TARGET_HOST),
      ('ic_stat_dfl_admin','ic_stat_dfl_cliente'),('admin_system_bar','cliente_system_bar')])
    # R232: primeiro acesso do Cliente nao pode exigir push nao implementado.
    # Operacao restrita ao clone android-cliente, nunca ao template Admin.
    from client_android_runtime import prepare_client_runtime
    prepare_client_runtime(main)
    gradle=DEST/'app/build.gradle'
    rewrite(gradle,[('br.com.dafamilialanches.admin',TARGET_PACKAGE)])
    settings=DEST/'settings.gradle'
    rewrite(settings,[('DFLAdmin','DFLCliente')])
    strings=main/'res/values/strings.xml'
    rewrite(strings,[('DFL Admin','Da Família Lanches'),
       ('admin.dafamilialanches.com.br',TARGET_HOST),
       ('br.com.dafamilialanches.admin.fileprovider',TARGET_PACKAGE+'.fileprovider')])
    colors=main/'res/values/colors.xml'
    rewrite(colors,[('admin_system_bar','cliente_system_bar')])
    colors_content=colors.read_text(encoding='utf-8')
    if colors_content.count('#09090B')!=2:
        raise SystemExit('R230: cor base Android inesperada: nao copiar Admin')
    colors.write_text(colors_content.replace('#09090B',theme_color),encoding='utf-8')

    res=main/'res'
    for density,size in {'mdpi':48,'hdpi':72,'xhdpi':96,'xxhdpi':144,'xxxhdpi':192}.items():
        folder=res/('mipmap-'+density)
        folder.mkdir(parents=True,exist_ok=True)
        rounded_launcher(standard192,size).save(folder/'ic_launcher.png',optimize=True)
        rounded_launcher(standard192,size,round_icon=True).save(folder/'ic_launcher_round.png',optimize=True)

    drawable=res/'drawable-nodpi'
    drawable.mkdir(parents=True,exist_ok=True)
    # Maskable ja traz a area de seguranca do PWA: nao encolher pela segunda vez.
    # Android recorta a forma (circulo, squircular etc) via adaptive-icon.xml.
    maskable512.resize((432,432),Image.Resampling.LANCZOS).save(
        drawable/'ic_launcher_foreground.png',optimize=True)
    splash=Image.new('RGBA',(1152,1152),(*tuple(int(theme_color[i:i+2],16) for i in (1,3,5)),255))
    mid=ImageOps.contain(standard512,(440,440),Image.Resampling.LANCZOS)
    splash.alpha_composite(mid,((1152-mid.width)//2,(1152-mid.height)//2))
    splash.convert('RGB').save(drawable/'splash.png',optimize=True)
    # Ic. de status monocromatico derivado da arte PWA (nunca do Admin).
    sample=standard512.resize((96,96),Image.Resampling.LANCZOS)
    alpha=sample.getchannel('A')
    if alpha.getextrema()==(255,255):
        # Caso a arte oficial seja RGB opaca, retirar a cor de fundo da borda.
        base=sample.getpixel((0,0))[:3]
        rgb=sample.convert('RGB')
        diff=ImageChops.difference(rgb,Image.new('RGB',rgb.size,base))
        alpha=ImageOps.grayscale(diff).point(lambda value:255 if value>=18 else 0)
    alpha=alpha.filter(ImageFilter.MaxFilter(3))
    stat=Image.new('RGBA',(96,96),(255,255,255,0)); stat.putalpha(alpha)
    stat.save(drawable/'ic_stat_dfl_cliente.png',optimize=True)
    # The selector owns the CI lifecycle; never publish unverified metadata.
    gradle_text=gradle.read_text(encoding='utf-8')
    manifest_text=manifest.read_text(encoding='utf-8')
    assert 'applicationId "'+TARGET_PACKAGE+'"' in gradle_text
    assert 'admin.dafamilialanches.com.br' not in manifest_text
    assert '@drawable/ic_stat_dfl_cliente' in manifest_text
    assert (java.parent/'cliente/EntryActivity.java').is_file()
    for generated in sorted((java.parent/'cliente').glob('*.java')):
        content=generated.read_text(encoding='utf-8')
        assert 'package '+TARGET_PACKAGE+';' in content, 'Pacote Java diferente: '+generated.name
        assert 'br.com.dafamilialanches.admin' not in content, 'Referencia Admin: '+generated.name
        assert 'admin.dafamilialanches.com.br' not in content, 'Host Admin: '+generated.name
    assert (drawable/'ic_launcher_foreground.png').stat().st_size>0
    print('R231 APK CLIENTE: Java opcional seguro + 3 PNGs do manifesto PWA, adaptive maskable, legacy arredondado; assinatura no CI')

if __name__=='__main__':main()
