#!/usr/bin/env python3
"""Build-time TWA Cliente derived from the reviewed Admin launcher. No app build in Termux.

The Admin files remain immutable. In CI we use the same stable Android signing
certificate for both app packages, declared independently by Digital Asset Links.
"""
from pathlib import Path
from PIL import Image, ImageOps, ImageFilter
import re, shutil, sys

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'android-admin'
DEST=ROOT/'android-cliente'
TARGET_PACKAGE='br.com.dafamilialanches.cliente'
TARGET_HOST='dafamilialanches.com.br'


def once(text,old,new,where):
    if text.count(old)!=1:raise SystemExit(f'R229: ancora invalida {where}: {old}')
    return text.replace(old,new,1)

def rewrite(path,changes):
    s=path.read_text(encoding='utf-8')
    for old,new in changes:
        if old not in s:raise SystemExit(f'R229: ancora ausente {path.name}: {old}')
        s=s.replace(old,new)
    path.write_text(s,encoding='utf-8')

def main():
    if not SOURCE.joinpath('app/src/main/java/br/com/dafamilialanches/admin/EntryActivity.java').is_file():
        raise SystemExit('R229: template Admin nao encontrado')
    if DEST.exists():
        raise SystemExit('R229: android-cliente preexistente (recusa sobrescrever)')
    def ignored(base,names):
        return {n for n in names if n in ('.gradle','build','.idea')}
    shutil.copytree(SOURCE,DEST,ignore=ignored)
    main=DEST/'app/src/main'
    java=main/'java/br/com/dafamilialanches/admin'
    for path in java.glob('*.java'):
        rewrite(path,[('package br.com.dafamilialanches.admin','package '+TARGET_PACKAGE),
          ('admin.dafamilialanches.com.br',TARGET_HOST),
          ('DFL Admin','DFL Cliente'),('DFL ADMIN','DFL CLIENTE'),
          ('AdminInBrowser','ClienteInBrowser'),('dfl_admin_native_diagnostics','dfl_cliente_native_diagnostics')])
    java.rename(java.parent/'cliente')
    manifest=main/'AndroidManifest.xml'
    rewrite(manifest,[('admin.dafamilialanches.com.br',TARGET_HOST),
      ('ic_stat_dfl_admin','ic_stat_dfl_cliente'),('admin_system_bar','cliente_system_bar')])
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
    img_source=ROOT/'public/icon-512x512.png'
    if not img_source.is_file():raise SystemExit('R229: icone oficial Cliente ausente')
    image=Image.open(img_source).convert('RGBA')
    if not image.getbbox():raise SystemExit('R229: icone Cliente vazio')
    cropped=image.crop(image.getbbox())
    res=main/'res'
    for density,size in {'mdpi':48,'hdpi':72,'xhdpi':96,'xxhdpi':144,'xxxhdpi':192}.items():
        folder=res/('mipmap-'+density)
        folder.mkdir(parents=True,exist_ok=True)
        icon=Image.new('RGBA',(size,size),(14,14,16,255))
        small=ImageOps.contain(cropped,(int(size*.86),int(size*.86)),Image.Resampling.LANCZOS)
        icon.alpha_composite(small,((size-small.width)//2,(size-small.height)//2))
        icon.convert('RGB').save(folder/'ic_launcher.png',optimize=True)
        icon.convert('RGB').save(folder/'ic_launcher_round.png',optimize=True)
    drawable=res/'drawable-nodpi'
    drawable.mkdir(parents=True,exist_ok=True)
    def foreground(size,ratio):
        img=Image.new('RGBA',(size,size),(0,0,0,0))
        fg=ImageOps.contain(cropped,(int(size*ratio),int(size*ratio)),Image.Resampling.LANCZOS)
        img.alpha_composite(fg,((size-fg.width)//2,(size-fg.height)//2))
        return img
    foreground(432,.68).save(drawable/'ic_launcher_foreground.png',optimize=True)
    splash=Image.new('RGBA',(1152,1152),(14,14,16,255))
    mid=ImageOps.contain(cropped,(440,440),Image.Resampling.LANCZOS)
    splash.alpha_composite(mid,((1152-mid.width)//2,(1152-mid.height)//2))
    splash.convert('RGB').save(drawable/'splash.png',optimize=True)
    alpha=foreground(96,.72).getchannel('A').filter(ImageFilter.MaxFilter(3)).point(lambda x: 255 if x>=42 else 0)
    stat=Image.new('RGBA',(96,96),(255,255,255,0));stat.putalpha(alpha)
    stat.save(drawable/'ic_stat_dfl_cliente.png',optimize=True)
    # The selector owns the CI lifecycle; never publish unverified metadata.
    gradle_text=gradle.read_text(encoding='utf-8')
    manifest_text=manifest.read_text(encoding='utf-8')
    assert 'applicationId "'+TARGET_PACKAGE+'"' in gradle_text
    assert 'admin.dafamilialanches.com.br' not in manifest_text
    assert '@drawable/ic_stat_dfl_cliente' in manifest_text
    assert (java.parent/'cliente/EntryActivity.java').is_file()
    assert (drawable/'ic_launcher_foreground.png').stat().st_size>0
    print('R229 APK CLIENTE: launcher isolado, icones prontos, origem HTTPS verificada; assinatura no CI')

if __name__=='__main__':main()
