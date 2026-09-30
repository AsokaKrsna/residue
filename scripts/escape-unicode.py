"""Replace characters in source files with JS escape sequences.

Mode "invisible" (default): only invisible, format and control characters (safe for UI files).
Mode "all": every non-ASCII character (engine and tests, so lookalike letters are readable in source).
Characters inside // and /* */ comments are left as they are in "all" mode.
"""
import glob
import io
import sys
import unicodedata

BS = chr(92)
root = sys.argv[1]
mode = sys.argv[2] if len(sys.argv) > 2 else "invisible"
globs = sys.argv[3:] or ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts"]


def esc(ch):
    cp = ord(ch)
    return BS + ("u%04X" % cp if cp <= 0xFFFF else "u{%X}" % cp)


def invisible(ch):
    cat = unicodedata.category(ch)
    return cat in ("Cf", "Zl", "Zp", "Co", "Mn", "Me") and ord(ch) > 127 or (cat == "Zs" and ch != " ") or (cat == "Cc" and ch not in "\n\t\r")


fixed = {}
for g in globs:
    for p in glob.glob(root + "/" + g, recursive=True):
        s = io.open(p, encoding="utf-8").read()
        out = []
        n = 0
        i = 0
        in_line_comment = in_block_comment = False
        while i < len(s):
            ch = s[i]
            nxt = s[i + 1] if i + 1 < len(s) else ""
            if mode == "all":
                if in_line_comment and ch == "\n":
                    in_line_comment = False
                elif in_block_comment and ch == "*" and nxt == "/":
                    in_block_comment = False
                elif not in_line_comment and not in_block_comment and ch == "/" and nxt == "*":
                    in_block_comment = True
                elif not in_line_comment and not in_block_comment and ch == "/" and nxt == "/" and (i == 0 or s[i - 1] in " \t\n;,{}()"):
                    in_line_comment = True
            comment = in_line_comment or in_block_comment
            if invisible(ch) or (mode == "all" and ord(ch) > 127 and not comment):
                out.append(esc(ch))
                n += 1
            else:
                out.append(ch)
            i += 1
        if n:
            io.open(p, "w", encoding="utf-8", newline="").write("".join(out))
            fixed[p] = n
print(fixed)
