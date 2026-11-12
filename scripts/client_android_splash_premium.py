#!/usr/bin/env python3
"""DFL R252: premium client-only Android TWA splash, derived from official PWA art.

This module is called exclusively after generating android-cliente from reviewed
android-admin source. It never modifies the Admin template or customer website.
"""
from __future__ import annotations

from pathlib import Path
import re
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont, ImageOps

NS = 'http://schemas.android.com/apk/res/android'
A = '{' + NS + '}'
ET.register_namespace('android', NS)
CLIENT = 'br.com.dafamilialanches.cliente'
META_PREFIX = 'android.support.customtabs.trusted.'


def ensure(condition: bool, description: str):
    if not condition:
        raise RuntimeError('R252 BLOQUEADO: ' + description)


def alpha_logo(source: Image.Image) -> Image.Image:
    """Extract only official white/silver/red lettering; exclude rounded black icon plate.

    Source is the exact, existing 512px public icon. No AI reconstruction or invented
    brand artwork, and no upsizing the 48px favicon. Clip is deliberately restricted
    to the logo lettering region to avoid extracting the reflective rounded border.
    """
    ensure(source.size == (512, 512), 'icone fonte oficial deve ser 512x512')
    art = source.convert('RGBA')
    # Geometry measured against the official PWA icon from 04/11/2026.
    region = (42, 140, 475, 400)
    part = art.crop(region)
    target = Image.new('RGBA', part.size, (0, 0, 0, 0))
    src_px = part.load()
    dst_px = target.load()
    n_color = 0
    for y in range(part.height):
        for x in range(part.width):
            r, g, b, original_alpha = src_px[x, y]
            # Neutral white/silver strokes. Dark glossy icon contour is excluded.
            neutral_alpha = max(0., min(1., (min(r, g, b) - 58.) / 72.))
            # Red DFL accent and red LANCHES lettering.
            red_excess = r - max(g, b)
            red_alpha = max(0., min(1., (red_excess - 38.) / 78.)) * max(0., min(1., (r - 88.) / 72.))
            alpha = int(round(original_alpha * max(neutral_alpha, red_alpha)))
            if alpha <= 7:
                continue
            n_color += 1
            # Preserve original metallic/red art; avoid dark halos on semi-transparent edges.
            if red_alpha > neutral_alpha:
                cr = min(255, int(r + (255 - r) * (1 - alpha / 255.) * 0.45))
                cg, cb = g, b
            else:
                boost = max(0, 255 - max(r, g, b)) * (1 - alpha / 255.) * 0.55
                cr, cg, cb = [min(255, int(c + boost)) for c in (r, g, b)]
            dst_px[x, y] = (cr, cg, cb, alpha)
    ensure(n_color > 14000, 'fonte nao corresponde a marca DFL validada')
    bounds = target.getbbox()
    ensure(bounds is not None, 'marca extraida vazia')
    x0, y0, x1, y1 = bounds
    ensure(x1 - x0 > 250 and y1 - y0 > 145, 'marca extraida incompleta')
    # Tiny transparent padding keeps antialiasing from touching the crop.
    pad = 6
    logo = Image.new('RGBA', (x1 - x0 + pad * 2, y1 - y0 + pad * 2), (0, 0, 0, 0))
    logo.alpha_composite(target.crop(bounds), (pad, pad))
    return logo


def font(size: int):
    for candidate in ('DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def make_splash(source: Image.Image, theme_color: str, drawable: Path):
    ensure(bool(re.fullmatch(r'#[0-9A-Fa-f]{6}', theme_color)), 'cor oficial invalida')
    bg = tuple(int(theme_color[i:i + 2], 16) for i in (1, 3, 5))
    logo = alpha_logo(source)
    # 1152px PNG: TWA transfers this full-quality splash to Chrome; CENTER_INSIDE
    # ensures it is fully visible even on a narrow viewport.
    canvas = Image.new('RGB', (1152, 1152), bg)
    mark = ImageOps.contain(logo, (640, 380), Image.Resampling.LANCZOS)
    canvas.paste(mark, ((1152 - mark.width) // 2, 374), mark)
    draw = ImageDraw.Draw(canvas)
    caption = 'Preparando seu cardápio…'
    ft = font(34)
    box = draw.textbbox((0, 0), caption, font=ft)
    draw.text(((1152 - (box[2] - box[0])) // 2, 804), caption, font=ft, fill=(223, 190, 130))
    # No card rectangle, border or faked loading progress.
    drawable.mkdir(parents=True, exist_ok=True)
    canvas.save(drawable / 'splash.png', optimize=True)
    # Android 12+ system splash keeps only the official brand on transparent pixels.
    system = Image.new('RGBA', (432, 432), (0, 0, 0, 0))
    mini = ImageOps.contain(logo, (310, 186), Image.Resampling.LANCZOS)
    system.alpha_composite(mini, ((432 - mini.width) // 2, (432 - mini.height) // 2))
    system.save(drawable / 'splash_logo_compat.png', optimize=True)


def add_meta(activity: ET.Element, name: str, value: str, attribute='resource'):
    ensure(not any(x.attrib.get(A + 'name') == name for x in activity.findall('meta-data')),
           'metadata duplicada ' + name)
    ET.SubElement(activity, 'meta-data', {A + 'name': name, A + attribute: value})


def _verify_updater_file_provider(app, resources):
    """R60: the updater's private FileProvider is distinct from TWA splash.

    It is present in the reviewed Admin template, before the Cliente clone's
    second (splash-only) provider is added. Never broaden its authorized path.
    """
    name = 'androidx.core.content.FileProvider'
    providers = [p for p in app.findall('provider') if p.attrib.get(A + 'name') == name]
    update = [p for p in providers if p.attrib.get(A + 'authorities') == '${applicationId}.updates.fileprovider']
    ensure(len(update) == 1 and 1 <= len(providers) <= 2, 'updater FileProvider ausente ou duplicado')
    provider = update[0]
    ensure(provider.attrib.get(A + 'exported') == 'false' and
           provider.attrib.get(A + 'grantUriPermissions') == 'true',
           'updater FileProvider publico ou sem grantURI')
    info = [m for m in provider.findall('meta-data')
            if m.attrib.get(A + 'name') == 'android.support.FILE_PROVIDER_PATHS']
    ensure(len(info) == 1 and info[0].attrib.get(A + 'resource') == '@xml/dfl_update_paths',
           'updater FileProvider paths divergentes')
    file = resources / 'xml/dfl_update_paths.xml'
    ensure(file.is_file(), 'paths privados do atualizador ausentes')
    paths = ET.parse(file).getroot()
    elements = list(paths)
    ensure(paths.tag == 'paths' and len(elements) == 1 and
           elements[0].tag == 'files-path' and
           elements[0].attrib.get('name') == 'dfl-apk-updates' and
           elements[0].attrib.get('path') == 'dfl-apk-updates/',
           'atualizador exporia arquivos fora de dfl-apk-updates/')
    return providers


def apply_client_splash(main: Path, source_icon: Image.Image, theme_color: str):
    ensure(main.as_posix().endswith('android-cliente/app/src/main'), 'somente cliente gerado')
    ensure(CLIENT in (main / 'res/values/strings.xml').read_text(encoding='utf-8'),
           'strings de identidade Cliente ausentes')
    resource = main / 'res'
    make_splash(source_icon, theme_color, resource / 'drawable-nodpi')
    manifest_path = main / 'AndroidManifest.xml'
    tree = ET.parse(manifest_path)
    root = tree.getroot()
    app = root.find('application')
    ensure(app is not None, 'application Android ausente')
    activity_names = {x.attrib.get(A + 'name'): x for x in app.findall('activity')}
    entry = activity_names.get('.EntryActivity')
    safe = activity_names.get('.SafeLauncherActivity')
    ensure(entry is not None and safe is not None, 'Entry/SafeLauncher ausentes')
    ensure(entry.attrib.get(A + 'theme') == '@android:style/Theme.Material.NoActionBar',
           'tema de entrada mudou e exige revisao')
    ensure(safe.attrib.get(A + 'exported') == 'false', 'SafeLauncher ficou publico')
    entry.set(A + 'theme', '@style/DFLClienteEntryTheme')

    add_meta(safe, META_PREFIX + 'SPLASH_IMAGE_DRAWABLE', '@drawable/splash')
    add_meta(safe, META_PREFIX + 'SPLASH_SCREEN_BACKGROUND_COLOR', '@color/cliente_system_bar')
    add_meta(safe, META_PREFIX + 'SPLASH_SCREEN_FADE_OUT_DURATION', '240', 'value')
    add_meta(safe, META_PREFIX + 'FILE_PROVIDER_AUTHORITY', '@string/provider_authority', 'value')
    providers = _verify_updater_file_provider(app, resource)
    ensure(len(providers) == 1, 'splash ja tem outro FileProvider no manifesto')
    provider = ET.SubElement(app, 'provider', {
        A + 'name': 'androidx.core.content.FileProvider',
        A + 'authorities': '@string/provider_authority',
        A + 'exported': 'false',
        A + 'grantUriPermissions': 'true',
    })
    ET.SubElement(provider, 'meta-data', {
        A + 'name': 'android.support.FILE_PROVIDER_PATHS',
        A + 'resource': '@xml/dfl_twa_splash_paths',
    })
    ET.indent(tree, space='    ')
    tree.write(manifest_path, encoding='utf-8', xml_declaration=True)

    xml_dir = resource / 'xml'
    xml_dir.mkdir(parents=True, exist_ok=True)
    (xml_dir / 'dfl_twa_splash_paths.xml').write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<paths xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <files-path name="twa_splash" path="twa_splash/" />\n'
        '</paths>\n', encoding='utf-8')

    values = resource / 'values'
    (values / 'styles.xml').write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        '  <style name="DFLClienteEntryTheme" parent="@android:style/Theme.Material.NoActionBar">\n'
        '    <item name="android:windowBackground">@color/cliente_system_bar</item>\n'
        '    <item name="android:statusBarColor">@color/cliente_system_bar</item>\n'
        '    <item name="android:navigationBarColor">@color/cliente_system_bar</item>\n'
        '    <item name="android:windowLightStatusBar">false</item>\n'
        '    <item name="android:windowLightNavigationBar">false</item>\n'
        '  </style>\n</resources>\n', encoding='utf-8')
    v31 = resource / 'values-v31'
    v31.mkdir(parents=True, exist_ok=True)
    (v31 / 'styles.xml').write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        '  <style name="DFLClienteEntryTheme" parent="@android:style/Theme.Material.NoActionBar">\n'
        '    <item name="android:windowBackground">@color/cliente_system_bar</item>\n'
        '    <item name="android:statusBarColor">@color/cliente_system_bar</item>\n'
        '    <item name="android:navigationBarColor">@color/cliente_system_bar</item>\n'
        '    <item name="android:windowLightStatusBar">false</item>\n'
        '    <item name="android:windowLightNavigationBar">false</item>\n'
        '    <item name="android:windowSplashScreenBackground">@color/cliente_system_bar</item>\n'
        '    <item name="android:windowSplashScreenAnimatedIcon">@drawable/splash_logo_compat</item>\n'
        '    <item name="android:windowSplashScreenIconBackgroundColor">@color/cliente_system_bar</item>\n'
        '  </style>\n</resources>\n', encoding='utf-8')

    safe_path = main / 'java/br/com/dafamilialanches/cliente/SafeLauncherActivity.java'
    java = safe_path.read_text(encoding='utf-8')
    anchor = '    private static final AtomicBoolean\n'
    ensure(java.count(anchor) == 1, 'contrato do SafeLauncher mudou')
    ensure('getSplashImageScaleType' not in java, 'escala ja personalizada')
    java = java.replace(anchor,
        '    // R252: marca oficial inteira no splash, inclusive telas estreitas.\n'
        '    @Override\n'
        '    protected android.widget.ImageView.ScaleType getSplashImageScaleType() {\n'
        '        return android.widget.ImageView.ScaleType.CENTER_INSIDE;\n'
        '    }\n\n' + anchor, 1)
    safe_path.write_text(java, encoding='utf-8')
    print('R252: splash Cliente borderless 1152px, Android 12+ escuro, FileProvider restrito e TWA handoff habilitados')


def verify_client_splash(resource: Path, source_png: Path, theme_color: str):
    main = resource.parent
    manifest = ET.parse(main / 'AndroidManifest.xml').getroot()
    app = manifest.find('application')
    ensure(app is not None, 'app gerado ausente')
    aa = {x.attrib.get(A+'name'): x for x in app.findall('activity')}
    entry, safe = aa.get('.EntryActivity'), aa.get('.SafeLauncherActivity')
    ensure(entry is not None and safe is not None, 'activities geradas ausentes')
    ensure(entry.attrib.get(A+'theme') == '@style/DFLClienteEntryTheme', 'tema escuro nao aplicado')
    ensure(safe.attrib.get(A+'exported') == 'false', 'SafeLauncher exportado')
    metadata = {x.attrib.get(A+'name'): x for x in safe.findall('meta-data')}
    expected = {
        'SPLASH_IMAGE_DRAWABLE': (A+'resource', '@drawable/splash'),
        'SPLASH_SCREEN_BACKGROUND_COLOR': (A+'resource','@color/cliente_system_bar'),
        'SPLASH_SCREEN_FADE_OUT_DURATION': (A+'value','240'),
        'FILE_PROVIDER_AUTHORITY': (A+'value','@string/provider_authority'),
    }
    for k,(field,value) in expected.items():
        n = META_PREFIX + k
        ensure(n in metadata and metadata[n].attrib.get(field) == value, 'metadata '+k)
    providers = _verify_updater_file_provider(app, resource)
    ensure(len(providers) == 2, 'esperados exatamente 2 FileProviders: update e splash')
    splash = [p for p in providers if p.attrib.get(A + 'authorities') == '@string/provider_authority']
    ensure(len(splash) == 1 and splash[0].attrib.get(A + 'exported') == 'false',
           'splash FileProvider ausente ou publico')
    ensure(splash[0].attrib.get(A + 'grantUriPermissions') == 'true',
           'splash sem grantUriPermissions')
    splash_meta = [m for m in splash[0].findall('meta-data')
                   if m.attrib.get(A + 'name') == 'android.support.FILE_PROVIDER_PATHS']
    ensure(len(splash_meta) == 1 and splash_meta[0].attrib.get(A + 'resource') == '@xml/dfl_twa_splash_paths',
           'splash FileProvider aponta para paths nao autorizados')
    paths = ET.parse(resource/'xml/dfl_twa_splash_paths.xml').getroot()
    ensure(len(paths)==1 and paths[0].tag=='files-path' and paths[0].attrib.get('path')=='twa_splash/',
           'paths FileProvider demasiado amplos')
    ensure(CLIENT+'.fileprovider' in (resource/'values/strings.xml').read_text(encoding='utf-8'),
           'authority cliente nao declarada')
    for p in (resource/'values/styles.xml',resource/'values-v31/styles.xml'):
        ET.parse(p)
        ensure('@color/cliente_system_bar' in p.read_text(encoding='utf-8'), 'tema branco em '+p.name)
    ensure('windowSplashScreenAnimatedIcon' in (resource/'values-v31/styles.xml').read_text(encoding='utf-8'),
           'splash Android 12+ ausente')
    java=(main/'java/br/com/dafamilialanches/cliente/SafeLauncherActivity.java').read_text(encoding='utf-8')
    ensure('getSplashImageScaleType()' in java and 'CENTER_INSIDE' in java,
           'escala mobile sem corte nao configurada')
    with Image.open(source_png) as image:
        src=image.convert('RGBA')
    with Image.open(resource/'drawable-nodpi/splash.png') as image:
        splash=image.convert('RGB')
    with Image.open(resource/'drawable-nodpi/splash_logo_compat.png') as image:
        system=image.convert('RGBA')
    ensure(splash.size==(1152,1152) and system.size==(432,432), 'dimensoes PNG incorretas')
    rgb=tuple(int(theme_color[i:i+2],16) for i in (1,3,5))
    for xy in ((0,0),(1151,0),(0,1151),(1151,1151),(60,490),(1090,490)):
        ensure(splash.getpixel(xy)==rgb,'splash tem placa ou borda indesejada')
    ensure(system.getpixel((0,0))[3]==0, 'icone Android 12 com fundo artificial')
    ensure(system.getbbox() is not None and system.getchannel('A').getbbox() is not None,'marca splash vazia')
    ensure(alpha_logo(src).size[0]>350,'marca nao preservada')
    print('R252: manifest FileProvider, Android12, fundo uniforme sem moldura, marca official e PNGs verificados')
