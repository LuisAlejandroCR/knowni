# build_demo.py: edits the raw iPhone recording (knowni-ios.MP4) into the 16:9 demo.
# Blurs the document number, e-mail and code; removes dev overlays; adds headline
# panels, a live zoom card, a journey progress bar, burned-in subtitles and the voice.
# Outputs out/knowni-demo.mp4. `--plan` prints the timeline and voice fit without rendering;
# `--split-voice` cuts one narration file (voz/narracion.*) into the per-segment files.

import json
import os
import re
import subprocess
import sys

# The raw recording shows the owner's document number and e-mail: it and every render live
# outside the repository, in knowni-media/demo next to the clone, and are never committed.
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MEDIA = os.environ.get("KNOWNI_MEDIA_DEMO") or os.path.join(os.path.dirname(REPO), "knowni-media", "demo")
SRC = os.path.join(MEDIA, "knowni-ios.MP4")
WORK = os.path.join(MEDIA, "work", "build")
OUT = os.path.join(MEDIA, "out")
# One file per segment name (voz/solicitud.mp3, …), generated with Nayla in ElevenLabs.
# A missing file leaves that segment silent; its subtitle is still burned in.
VOICE = os.path.join(MEDIA, "voz")
FONTS = os.environ.get("KNOWNI_FONTS") or "C:/Windows/Fonts"
CPS = 15  # characters per second the voice can say without rushing
VOICE_IN = 0.2  # the voice starts after the fade-in
MIN_DUR = 5.0  # every screen stays long enough to read; short takes hold their last frame

W, H = 1920, 1080
DEEP, LIME, CANVAS, SOFT, DIM = "#193e36", "#dbef9e", "#fafbf7", "#b9c9c0", "#5f7d73"
SCREEN = (170, 40, 462, 1000)  # x, y, w, h of the phone screen on the canvas
BEZEL = 14
TEXT_X, TEXT_W = 760, 1060
SUB_Y = 884  # subtitle box top; zoom cards end above it
STEPS = ["Solicitud", "Autorización", "Pago", "Consulta", "Stellar", "Compartir", "Verificar"]

# Source-pixel boxes (1290x2796). Found on gridded frames of the recording.
GEAR = (1085, 440, 160, 155)
CIRCLE = (1075, 770, 190, 190)
# The document number is never typed on screen in the edit: its typing (12.0-16.3 s) is cut,
# because the keypad highlights each key. Boxes reach the right edge to cover slide-ins.
DOC_READY = (40, 2120, 1250, 230)
EMAIL_FIELD, SENT_TO_LINE = (40, 900, 1250, 190), (40, 710, 1250, 95)

# src start/end in seconds, speed, step index, texts, zoom box, blurs (box, local start, local end).
SEGMENTS = [
    dict(name="intro", voice="Para firmar un contrato no hace falta entregar tu expediente.",
         a=0.2, b=4.8, step=-1, eyebrow="KNOWNI · DEMO EN UN IPHONE REAL",
         title="Demuestra más.\nRevela menos.",
         sub="Respondes lo que te piden para firmar un contrato,\nsin entregar tu cédula ni tu expediente."),
    dict(name="solicitud", voice="Llega una solicitud firmada, y vence.",
         a=5.0, b=8.0, step=0, eyebrow="01 · SOLICITUD",
         title="Alguien te pide\nrequisitos.",
         sub="La solicitud llega firmada: quién pregunta, para qué\ny hasta cuándo. Vence en 10 minutos.",
         zoom=(48, 850, 1146, 400)),
    dict(name="autoriza", voice="Tú eliges qué fuentes se consultan.",
         a=8.0, b=11.9, step=1, eyebrow="02 · AUTORIZACIÓN",
         title="Consultar\nno es compartir.",
         sub="Tú eliges qué fuentes se consultan. Tu número de\ndocumento va al emisor, nunca a quien pregunta.",
         zoom=(75, 1125, 1140, 770), blurs=[(DOC_READY, 0, 4)]),
    dict(name="conectar", voice="Sin pago, no hay consulta.",
         a=16.7, b=17.9, step=2, eyebrow="03 · PAGO PRIMERO",
         title="Sin pago,\nno hay consulta.",
         sub="El emisor cobra antes de tocar una sola fuente.\nLa app pide conectar la wallet.",
         zoom=(75, 2490, 1140, 175), blurs=[(DOC_READY, 0, 2)]),
    dict(name="correo", voice="Entras con tu correo.",
         a=18.0, b=18.7, step=2, blurs=[(EMAIL_FIELD, 0, 1)], eyebrow="04 · WALLET CAVOS",
         title="Tu wallet vive\nen el teléfono.",
         sub="Entras con un código por correo. Sin contraseñas\ny sin semilla que anotar."),
    dict(name="codigo", voice="Un código por correo, y la llave queda sellada en este iPhone.",
         a=36.2, b=48.4, speed=2.0, step=2, eyebrow="04 · WALLET CAVOS",
         title="Tu wallet vive\nen el teléfono.",
         sub="La llave de Stellar se guarda sellada con una llave\ndel Secure Enclave de este iPhone.",
         blurs=[(EMAIL_FIELD, 0, 13), (SENT_TO_LINE, 0, 13)]),
    dict(name="fondos", voice="Cuenta de testnet, fondeada con Friendbot.",
         a=48.6, b=51.6, step=2, eyebrow="04 · WALLET CAVOS",
         title="Cuenta Stellar\nlista en testnet.",
         sub="Fondeada con Friendbot: el XLM de prueba\nno tiene valor real.",
         zoom=(72, 950, 1146, 440)),
    dict(name="pagar", voice="Una fuente cuesta 1,2 XLM.",
         a=52.3, b=55.0, step=2, eyebrow="05 · EL PRECIO SIGUE A LO QUE AUTORIZAS",
         title="Pagar 1.2 XLM\ny consultar.",
         sub="Una fuente, 1.2 XLM. Pedir más cuesta más:\nnadie pide datos de sobra gratis.",
         zoom=(75, 2490, 1140, 175), blurs=[(DOC_READY, 0, 3)]),
    dict(name="consulta", voice="La wallet firma el pago. El emisor lo verifica en Stellar y solo entonces consulta la Registraduría.",
         a=55.0, b=65.0, step=3, eyebrow="06 · CONSULTA",
         title="Pago primero.\nConsulta después.",
         sub="El emisor verifica el pago en Stellar antes\nde llamar a la Registraduría.",
         zoom=(72, 940, 1146, 610)),
    dict(name="stellar", voice="La transacción está en Stellar testnet: exitosa, 1,2 XLM al emisor.",
         a=71.0, b=82.8, step=4, gear=False, eyebrow="07 · STELLAR TESTNET",
         title="Verificable\npor cualquiera.",
         sub="Transacción 53e6ea60…2724 · Successful\n1.2 XLM de la wallet al emisor, con la\nreferencia de la cotización en el memo."),
    dict(name="recibiran", voice="La otra parte recibe una sola respuesta.",
         a=85.3, b=87.9, step=5, eyebrow="08 · ANTES DE COMPARTIR",
         title="Esto es lo que\nrecibirán.",
         sub="Documento vigente: sí. Nada más:\nni nombre, ni número, ni expediente.",
         zoom=(72, 1000, 1146, 810)),
    dict(name="enviada", voice="Confirmas antes de enviar. La respuesta va firmada por el emisor.",
         a=88.0, b=93.0, step=5, eyebrow="09 · COMPARTIR",
         title="Tú conservas\nel control.",
         sub="Confirmas antes de enviar. La respuesta va firmada\npor el emisor y solo sirve para esta solicitud."),
    dict(name="verifica", voice="En este mismo teléfono se comprueban firma y destinatario. Repetida, se rechaza.",
         a=94.0, b=100.5, step=6, eyebrow="10 · LA CONTRAPARTE VERIFICA",
         title="Verificada.\nY no se reusa.",
         sub="Firma, destinatario y vigencia se comprueban en el\ndispositivo. La misma respuesta dos veces: rechazada.",
         zoom=(72, 380, 1146, 560)),
    dict(name="espacio", voice="Y el historial queda en tu teléfono.",
         a=108.0, b=111.0, step=6, eyebrow="11 · MI ESPACIO",
         title="Todo queda\nen tu teléfono.",
         sub="Historial de lo que compartiste y rechazaste.\nTu documento nunca llega a la contraparte."),
]

TITLE_CARD = dict(name="titulo", voice="Una verificación real, en un iPhone.",
                  eyebrow="STELLAR TESTNET · 26/09/2026", title="knowni",
                  sub="Una verificación real, grabada en un iPhone.\nDatos personales difuminados.", dur=4.0)
END_CARD = dict(name="cierre", voice="Pago real en testnet, emisor real. Falta la contraparte en otro teléfono.",
                eyebrow="LO QUE ACABAS DE VER", title="Demuestra más.\nRevela menos.",
                sub="Pago real en Stellar testnet: 53e6ea60…2724\n"
                    "Emisor real vía Croma · firma verificada en el dispositivo\n"
                    "Aún falta: la contraparte en un segundo teléfono\n"
                    "y la prueba ZK generada en iOS.\n\n"
                    "github.com/LuisAlejandroCR/knowni", dur=8.0)


def font(bold, size):
    from PIL import ImageFont
    return ImageFont.truetype(os.path.join(FONTS, "segoeuib.ttf" if bold else "segoeui.ttf"), size)


def text_block(draw, x, y, text, fnt, fill, line_h):
    for line in text.split("\n"):
        draw.text((x, y), line, font=fnt, fill=fill)
        y += line_h
    return y


def panel(path, eyebrow, title, sub, step, with_phone=True, big=False):
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (W, H), DEEP)
    d = ImageDraw.Draw(img)
    x = TEXT_X if with_phone else 170
    d.text((x, 118), eyebrow, font=font(True, 24), fill=LIME)
    y = text_block(d, x, 160, title, font(True, 120 if big else 78), CANVAS, 128 if big else 86)
    y = text_block(d, x, y + 22, sub, font(False, 32), SOFT, 44)
    if step >= 0:
        span = (W - 100 - TEXT_X) / (len(STEPS) - 1)
        d.line((TEXT_X, 1012, TEXT_X + span * (len(STEPS) - 1), 1012), fill=DIM, width=2)
        for i, label in enumerate(STEPS):
            cx = TEXT_X + span * i
            on = i <= step
            r = 9 if i == step else 6
            d.ellipse((cx - r, 1012 - r, cx + r, 1012 + r), fill=LIME if on else DIM)
            f = font(i == step, 20)
            tw = d.textlength(label, font=f)
            d.text((cx - tw / 2, 1030), label, font=f, fill=LIME if i == step else (SOFT if on else DIM))
    img.save(path)
    return y + 34  # where a zoom card may start


def bezel(path):
    sx, sy, sw, sh = SCREEN
    w, h = sw + 2 * BEZEL, sh + 2 * BEZEL
    from PIL import Image, ImageDraw
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=62, fill="#0d1f1b")
    d.rounded_rectangle((BEZEL, BEZEL, w - 1 - BEZEL, h - 1 - BEZEL), radius=50, fill=(0, 0, 0, 0))
    img.save(path)


def run(cmd):
    print(" ".join(cmd[:6]), "…")
    subprocess.run(cmd, check=True)


def blur_chain(src, blurs):
    """Returns filter lines that blur each box during its local window."""
    lines, cur = [], src
    for i, ((x, y, w, h), t0, t1) in enumerate(blurs):
        lr, cr = min(28, h // 2 - 2), min(12, h // 4 - 2)
        lines.append(f"[{cur}]split[k{i}][c{i}]")
        lines.append(f"[c{i}]crop={w}:{h}:{x}:{y},boxblur=luma_radius={lr}:luma_power=5:chroma_radius={cr}:chroma_power=3[b{i}]")
        lines.append(f"[k{i}][b{i}]overlay={x}:{y}:enable='between(t,{t0},{t1})'[s{i}]")
        cur = f"s{i}"
    return lines, cur


def take_dur(seg):
    return round((seg["b"] - seg["a"]) / seg.get("speed", 1.0), 3)


def seg_dur(seg):
    if "dur" in seg:
        return seg["dur"]
    return max(take_dur(seg), MIN_DUR)


def voice_file(seg):
    for ext in ("wav", "mp3", "m4a"):
        path = os.path.join(VOICE, f"{seg['name']}.{ext}")
        if os.path.exists(path):
            return path
    return None


def probe_seconds(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         check=True, capture_output=True, text=True).stdout
    return float(out.strip())


def wrap(text, fnt, max_w, draw):
    lines, cur = [], ""
    for word in text.split():
        trial = f"{cur} {word}".strip()
        if cur and draw.textlength(trial, font=fnt) > max_w:
            lines.append(cur)
            cur = word
        else:
            cur = trial
    return lines + [cur]


def subtitle(path, text, x, w):
    """A transparent frame with the voice line in a dark box, below the zoom card."""
    from PIL import Image, ImageDraw
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    fnt = font(False, 30)
    lines = wrap(text, fnt, w - 48, d)
    box_w = 48 + max(d.textlength(line, font=fnt) for line in lines)
    box_h = 24 + 40 * len(lines)
    d.rounded_rectangle((x, SUB_Y, x + box_w, SUB_Y + box_h), radius=14, fill=(8, 20, 17, 215))
    for n, line in enumerate(lines):
        d.text((x + 24, SUB_Y + 12 + 40 * n), line, font=fnt, fill=CANVAS)
    img.save(path)


def audio_inputs(seg, dur):
    """ffmpeg inputs and filter lines for the voice, or silence when it has no file yet."""
    voice = voice_file(seg)
    if not voice:
        return ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"], "[{n}:a]anull[aout]"
    ms = int(VOICE_IN * 1000)
    return ["-i", voice], (f"[{{n}}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={ms}:all=1,"
                           f"apad,atrim=0:{dur},afade=t=out:st={max(dur - 0.15, 0)}:d=0.15[aout]")


def encode(inputs, filters, last, dur, out):
    script = out[:-4] + ".txt"
    with open(script, "w", encoding="utf-8") as fh:
        fh.write(";\n".join(filters))
    run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex_script", script,
         "-map", f"[{last}]", "-map", "[aout]", "-t", str(dur),
         "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", "30", "-c:a", "aac", "-b:a", "128k", out])


def with_subtitle(seg, i, x, w, inputs, f, last, dur):
    if not seg.get("voice"):
        return last
    png = os.path.join(WORK, f"sub_{i:02d}.png")
    subtitle(png, seg["voice"], x, w)
    n = inputs.count("-i")
    inputs += ["-loop", "1", "-i", png]
    f.append(f"[{last}][{n}:v]overlay=0:0:enable='between(t,{VOICE_IN},{max(dur - 0.2, VOICE_IN)})'[sub]")
    return "sub"


def segment(i, seg, bezel_png):
    speed = seg.get("speed", 1.0)
    dur = seg_dur(seg)
    bg = os.path.join(WORK, f"bg_{i:02d}.png")
    zoom_y = panel(bg, seg["eyebrow"], seg["title"], seg["sub"], seg["step"])
    sx, sy, sw, sh = SCREEN
    overlays = [f"delogo=x={CIRCLE[0]}:y={CIRCLE[1]}:w={CIRCLE[2]}:h={CIRCLE[3]}"]
    if seg.get("gear", True):
        overlays.insert(0, f"delogo=x={GEAR[0]}:y={GEAR[1]}:w={GEAR[2]}:h={GEAR[3]}")
    f = [f"[0:v]setpts=PTS-STARTPTS,fps=60,{','.join(overlays)}[clean]"]
    bl, cur = blur_chain("clean", seg.get("blurs", []))
    f += bl
    hold = round(dur - take_dur(seg), 3)
    pad = f",tpad=stop_mode=clone:stop_duration={hold}" if hold > 0 else ""
    f.append(f"[{cur}]setpts=PTS/{speed},fps=30{pad},split[p][q]")
    f.append(f"[p]scale={sw}:{sh}[ph]")
    f.append(f"[1:v][ph]overlay={sx}:{sy}[a]")
    f.append(f"[a][2:v]overlay={sx - BEZEL}:{sy - BEZEL}[b]")
    last = "b"
    if "zoom" in seg:
        x, y, w, h = seg["zoom"]
        max_w, max_h = 1000, SUB_Y - 18 - zoom_y
        scale = min(max_w / w, max_h / h)
        zw, zh = int(w * scale) // 2 * 2, int(h * scale) // 2 * 2
        f.append(f"[q]crop={w}:{h}:{x}:{y},scale={zw}:{zh},pad={zw + 12}:{zh + 12}:6:6:color=0xdbef9e[z]")
        f.append(f"[b][z]overlay=x='if(lt(t,0.45),{TEXT_X}+(1-t/0.45)*260,{TEXT_X})':y={zoom_y}[c]")
        last = "c"
    else:
        f.append("[q]nullsink")
    inputs = ["-ss", str(seg["a"]), "-t", str(seg["b"] - seg["a"]), "-i", SRC,
              "-loop", "1", "-i", bg, "-loop", "1", "-i", bezel_png]
    a_in, a_filter = audio_inputs(seg, dur)
    f.append(a_filter.format(n=inputs.count("-i")))
    inputs += a_in
    last = with_subtitle(seg, i, TEXT_X, 1012, inputs, f, last, dur)
    f.append(f"[{last}]fade=t=in:st=0:d=0.2:color=0x193e36,fade=t=out:st={max(dur - 0.2, 0)}:d=0.2:color=0x193e36,format=yuv420p[out]")
    out = os.path.join(WORK, f"seg_{i:02d}.mp4")
    encode(inputs, f, "out", dur, out)
    return out, dur


def card(i, spec):
    bg = os.path.join(WORK, f"card_{i:02d}.png")
    panel(bg, spec["eyebrow"], spec["title"], spec["sub"], -1, with_phone=False, big=True)
    out = os.path.join(WORK, f"seg_{i:02d}.mp4")
    d = spec["dur"]
    inputs = ["-loop", "1", "-i", bg]
    a_in, a_filter = audio_inputs(spec, d)
    f = [a_filter.format(n=1)]
    inputs += a_in
    last = with_subtitle(spec, i, 170, 1580, inputs, f, "0:v", d)
    f.append(f"[{last}]fade=t=in:st=0:d=0.3:color=0x193e36,fade=t=out:st={d - 0.3}:d=0.3:color=0x193e36,format=yuv420p[out]")
    encode(inputs, f, "out", d, out)
    return out, d


def plan():
    """Prints each part with its duration and whether its voice line fits; renders nothing."""
    parts, t, ok = [TITLE_CARD] + SEGMENTS + [END_CARD], 0.0, True
    room = lambda d: d - VOICE_IN - 0.2
    for seg in parts:
        d, text = seg_dur(seg), seg.get("voice", "")
        need = len(text) / CPS
        voice = voice_file(seg)
        real = probe_seconds(voice) if voice else None
        fits = (real if real is not None else need) <= room(d)
        ok &= fits
        took = f"{real:.2f}s audio" if real is not None else f"~{need:.2f}s at {CPS} cps"
        print(f"{t:6.2f}  {d:5.2f}s  {seg['name']:<10} {'ok ' if fits else 'LONG'} {took:<18} {text}")
        t += d
    print(f"total {t:.1f}s")
    return ok


def split_voice():
    """Cuts voz/narracion.* at its longest pauses into one file per part, in timeline order."""
    parts = [TITLE_CARD] + SEGMENTS + [END_CARD]
    src = next((os.path.join(VOICE, f"narracion.{e}") for e in ("wav", "mp3", "m4a")
                if os.path.exists(os.path.join(VOICE, f"narracion.{e}"))), None)
    if not src:
        sys.exit(f"no narration file: save it as {os.path.join(VOICE, 'narracion.mp3')}")
    total = probe_seconds(src)
    log = subprocess.run(["ffmpeg", "-hide_banner", "-i", src, "-af", "silencedetect=noise=-35dB:d=0.25",
                          "-f", "null", "-"], capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
    gaps = list(zip(starts, ends + [total] * (len(starts) - len(ends))))
    lead = gaps.pop(0)[1] if gaps and gaps[0][0] < 0.3 else 0.0
    tail = gaps.pop()[0] if gaps and gaps[-1][1] > total - 0.3 else total
    # The pause between two lines is longer than a pause inside one: keep the longest ones.
    cuts = sorted(sorted(gaps, key=lambda g: g[1] - g[0], reverse=True)[:len(parts) - 1])
    if len(cuts) < len(parts) - 1:
        sys.exit(f"found {len(cuts) + 1} lines in the narration, expected {len(parts)}")
    bounds = [lead] + [x for g in cuts for x in g] + [tail]
    for n, seg in enumerate(parts):
        a, b = max(bounds[2 * n] - 0.05, 0), min(bounds[2 * n + 1] + 0.05, total)
        out = os.path.join(VOICE, f"{seg['name']}.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-ss", f"{a:.3f}", "-to", f"{b:.3f}",
                        "-ar", "48000", out], check=True)
        print(f"{seg['name']:<10} {b - a:5.2f}s  {seg.get('voice', '')}")


def main():
    if "--split-voice" in sys.argv:
        split_voice()
        return
    if "--plan" in sys.argv:
        sys.exit(0 if plan() else 1)
    if not plan():
        print("a voice line does not fit its segment: lower that segment's speed")
        sys.exit(1)
    os.makedirs(WORK, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    bezel_png = os.path.join(WORK, "bezel.png")
    bezel(bezel_png)
    parts = [card(0, TITLE_CARD)]
    for i, seg in enumerate(SEGMENTS, start=1):
        parts.append(segment(i, seg, bezel_png))
    parts.append(card(len(SEGMENTS) + 1, END_CARD))
    listing = os.path.join(WORK, "concat.txt")
    with open(listing, "w", encoding="utf-8") as fh:
        fh.writelines(f"file '{p.replace(os.sep, '/')}'\n" for p, _ in parts)
    final = os.path.join(OUT, "knowni-demo.mp4")
    run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", listing, "-c", "copy",
         "-movflags", "+faststart", final])
    timeline, t = [], 0.0
    for (p, d), seg in zip(parts, [TITLE_CARD] + SEGMENTS + [END_CARD]):
        timeline.append(dict(start=round(t, 2), dur=d, name=seg["name"], title=seg["title"],
                             voice=seg.get("voice", ""), voice_file=bool(voice_file(seg))))
        t += d
    with open(os.path.join(OUT, "timeline.json"), "w", encoding="utf-8") as fh:
        json.dump(timeline, fh, ensure_ascii=False, indent=1)
    print("done", final, round(t, 1), "s")


if __name__ == "__main__":
    main()
