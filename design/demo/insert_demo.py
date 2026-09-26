# insert_demo.py: drops real iPhone takes into the Stellar pitch film (out/knowni-stellar.mp4).
# Each take is a phone that slides in on the right over the film, labelled as a real recording,
# with the same privacy blurs as the demo edit. The film's audio and subtitles stay untouched.
# Writes out/knowni-stellar-demo.mp4 and never overwrites the film.

import os
import sys

import build_demo as demo

FILM_NAME = "knowni-stellar.mp4"
OUT_NAME = "knowni-stellar-demo.mp4"
LABEL = "App real · iPhone · Stellar testnet"

# Film window (seconds) → demo segment it shows. The take starts at the segment's source start and
# holds its last frame if the window is longer than the segment.
INSERTS = [
    dict(at=20.0, to=24.0, seg="solicitud"),  # the request reaches the phone
    dict(at=27.0, to=32.0, seg="autoriza"),   # the person chooses what to authorize
    dict(at=47.0, to=50.0, seg="recibiran"),  # only "documento vigente: sí" crosses
    dict(at=57.0, to=65.0, seg="consulta"),   # payment accepted, then the real registry query
]


def find_film():
    path = os.path.join(demo.OUT, FILM_NAME)
    if not os.path.exists(path):
        sys.exit(f"{FILM_NAME} not found in {demo.OUT}")
    return path


def probe_size(path):
    out = demo.subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                               "stream=width,height", "-of", "csv=p=0", path],
                              check=True, capture_output=True, text=True).stdout
    w, h = out.strip().split(",")[:2]
    return int(w), int(h)


def phone_frame(path, sw, sh, bz, label_h):
    """Transparent canvas: label strip on top, then a bezel with a see-through screen.

    Returns the canvas size and the bezel's left edge; the label may be wider than the phone.
    """
    from PIL import Image, ImageDraw
    w, h = sw + 2 * bz, sh + 2 * bz
    fnt = demo.font(True, max(label_h * 11 // 20, 12))
    pad = label_h // 2
    tw = ImageDraw.Draw(Image.new("RGBA", (1, 1))).textlength(LABEL, font=fnt)
    cw = int(max(w, tw + 2 * pad + 2)) // 2 * 2
    px = (cw - w) // 2
    img = Image.new("RGBA", (cw, label_h + h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((cw / 2 - tw / 2 - pad, 0, cw / 2 + tw / 2 + pad, label_h * 4 // 5),
                        radius=label_h // 3, fill=demo.DEEP)
    d.text((cw / 2 - tw / 2, label_h // 10), LABEL, font=fnt, fill=demo.LIME)
    r_out, r_in = w * 62 // 490, w * 50 // 490
    d.rounded_rectangle((px, label_h, px + w - 1, label_h + h - 1), radius=r_out, fill="#0d1f1b")
    d.rounded_rectangle((px + bz, label_h + bz, px + w - 1 - bz, label_h + h - 1 - bz), radius=r_in,
                        fill=(0, 0, 0, 0))
    img.save(path)
    return cw, label_h + h, px


def main():
    film = find_film()
    fw, fh = probe_size(film)
    segs = {s["name"]: s for s in demo.SEGMENTS}
    os.makedirs(demo.WORK, exist_ok=True)

    # Phone size follows the film: 72 % of its height, right side, clear of bottom subtitles.
    sh = int(fh * 0.72) // 2 * 2
    sw = int(sh * 1290 / 2796) // 2 * 2
    bz, label_h = max(fh // 77, 4), max(fh // 27, 16)
    frame_png = os.path.join(demo.WORK, "insert_frame.png")
    cw, ch, px = phone_frame(frame_png, sw, sh, bz, label_h)
    x, y, slide = fw - cw - int(fw * 0.07), int(fh * 0.05), int(fw * 0.12)

    inputs, f = ["-i", film], []
    n_frame = len(INSERTS) + 1
    f.append(f"[{n_frame}:v]split={len(INSERTS)}" + "".join(f"[fr{i}]" for i in range(len(INSERTS))))
    cur = "0:v"
    for i, ins in enumerate(INSERTS):
        seg = segs[ins["seg"]]
        dur = round(ins["to"] - ins["at"], 3)
        take = min(seg["b"] - seg["a"], dur)
        inputs += ["-ss", str(seg["a"]), "-t", str(take), "-i", demo.SRC]
        overlays = [f"delogo=x={demo.CIRCLE[0]}:y={demo.CIRCLE[1]}:w={demo.CIRCLE[2]}:h={demo.CIRCLE[3]}"]
        if seg.get("gear", True):
            overlays.insert(0, f"delogo=x={demo.GEAR[0]}:y={demo.GEAR[1]}:w={demo.GEAR[2]}:h={demo.GEAR[3]}")
        f.append(f"[{i + 1}:v]setpts=PTS-STARTPTS,fps=60,{','.join(overlays)}[raw{i}]")
        bl, last = demo.blur_chain(f"raw{i}", seg.get("blurs", []), tag=f"i{i}_")
        f += bl
        hold = round(dur - take, 3)
        pad = f",tpad=stop_mode=clone:stop_duration={hold}" if hold > 0 else ""
        f.append(f"[{last}]fps=30{pad},scale={sw}:{sh},format=rgba,"
                 f"pad={cw}:{ch}:{px + bz}:{label_h + bz}:color=0x00000000[scr{i}]")
        f.append(f"[scr{i}][fr{i}]overlay=0:0,format=rgba,"
                 f"fade=t=in:st=0:d=0.3:alpha=1,fade=t=out:st={max(dur - 0.3, 0)}:d=0.3:alpha=1,"
                 f"setpts=PTS+{ins['at']}/TB[ph{i}]")
        f.append(f"[{cur}][ph{i}]overlay=x='{x}+(1-min(1,max(0,(t-{ins['at']})/0.35)))*{slide}':y={y}"
                 f":enable='between(t,{ins['at']},{ins['to']})':eof_action=pass[v{i}]")
        cur = f"v{i}"
    f.append(f"[{cur}]format=yuv420p[vout]")
    inputs += ["-loop", "1", "-i", frame_png]

    script = os.path.join(demo.WORK, "insert.txt")
    with open(script, "w", encoding="utf-8") as fh_:
        fh_.write(";\n".join(f))
    out = os.path.join(demo.OUT, OUT_NAME)
    demo.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex_script", script,
              "-map", "[vout]", "-map", "0:a?", "-c:v", "libx264", "-preset", "medium",
              "-crf", "18", "-c:a", "copy", "-movflags", "+faststart", out])
    for ins in INSERTS:
        print(f"{ins['at']:5.1f}-{ins['to']:5.1f}s  {ins['seg']}")
    print("done", out)


if __name__ == "__main__":
    main()
