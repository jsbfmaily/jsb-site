#!/usr/bin/env python3
"""
Generate a QR code SVG using the system libqrencode (no pip/npm needed).
Usage: python3 generate_qr.py "https://example.com" output.svg [box_size] [#fgcolor] [#bgcolor]
"""
import sys
import ctypes
import ctypes.util

LIB_PATH = "/usr/lib/x86_64-linux-gnu/libqrencode.so.4"


class QRcode(ctypes.Structure):
    _fields_ = [
        ("version", ctypes.c_int),
        ("width", ctypes.c_int),
        ("data", ctypes.POINTER(ctypes.c_ubyte)),
    ]


def encode(text, ec_level=1):
    """ec_level: 0=L,1=M,2=Q,3=H"""
    lib = ctypes.CDLL(LIB_PATH)
    lib.QRcode_encodeString.restype = ctypes.POINTER(QRcode)
    lib.QRcode_encodeString.argtypes = [
        ctypes.c_char_p, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int
    ]
    # version=0 (auto), hint=2 (QR_MODE_8 / byte mode), casesensitive=1
    qptr = lib.QRcode_encodeString(text.encode("utf-8"), 0, ec_level, 2, 1)
    if not qptr:
        raise RuntimeError("QR encoding failed")
    qr = qptr.contents
    width = qr.width
    buf = ctypes.cast(qr.data, ctypes.POINTER(ctypes.c_ubyte * (width * width))).contents
    matrix = [[buf[y * width + x] & 1 for x in range(width)] for y in range(width)]
    lib.QRcode_free(qptr)
    return matrix


def to_svg(matrix, box=10, quiet=4, fg="#1f2a1f", bg="#ffffff"):
    n = len(matrix)
    size = (n + quiet * 2) * box
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" '
        f'width="{size}" height="{size}" shape-rendering="crispEdges">',
        f'<rect width="{size}" height="{size}" fill="{bg}"/>',
    ]
    path = []
    for y in range(n):
        for x in range(n):
            if matrix[y][x]:
                px = (x + quiet) * box
                py = (y + quiet) * box
                path.append(f"M{px},{py}h{box}v{box}h-{box}z")
    parts.append(f'<path d="{"".join(path)}" fill="{fg}"/>')
    parts.append("</svg>")
    return "\n".join(parts)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    text = sys.argv[1]
    out = sys.argv[2]
    box = int(sys.argv[3]) if len(sys.argv) > 3 else 10
    fg = sys.argv[4] if len(sys.argv) > 4 else "#1f2a1f"
    bg = sys.argv[5] if len(sys.argv) > 5 else "#ffffff"
    matrix = encode(text)
    svg = to_svg(matrix, box=box, fg=fg, bg=bg)
    with open(out, "w") as f:
        f.write(svg)
    print(f"Wrote {out} ({len(matrix)}x{len(matrix)} modules) for: {text}")
