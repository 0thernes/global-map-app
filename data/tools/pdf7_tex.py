"""PDF 7 LaTeX helpers: find every table and figure in main.tex with its section, enclosing case file and page.

Pages: section numbers and start pages come from main.aux. A table's own page is located by searching the PDF's text
layer (pdftotext, one page at a time) for the first distinctive cell text, starting at the section's first page; if
not found, the section's first page is used and 'page_basis' says so."""
import os, re, subprocess

def tex2txt(s):
    s = re.sub(r'\\(?:phantomsection|leavevmode|centering|par|noindent|raggedright|arraybackslash|quad|qquad|hfill|newpage|clearpage|small|footnotesize|scriptsize|tiny|normalsize|large|Large|toprule|midrule|bottomrule|hline|endhead|endfirsthead|endfoot|endlastfoot)\b', ' ', s)
    s = re.sub(r'\\label\{[^}]*\}', '', s)
    s = re.sub(r'\\(?:cmidrule|cline)(?:\([^)]*\))?\{[^}]*\}', '', s)
    s = re.sub(r'\\newline', ' / ', s)
    s = s.replace('\\textperiodcentered', '·').replace('\\textasciicircum{}', '^').replace('\\textasciitilde{}', '~')
    s = re.sub(r'\\(?:hyperref|ref)\[[^\]]*\]', '', s)
    s = re.sub(r'\\href\{([^}]*)\}\{([^}]*)\}', r'\2 (\1)', s)
    s = re.sub(r'\\tb\{[^}]*\}', '', s)
    s = re.sub(r'\\F\{([^}]*)\}', r'\1: ', s)
    for _ in range(4):
        s = re.sub(r'\\[a-zA-Z]+\*?(?:\[[^\]]*\])?\{([^{}]*)\}', r'\1', s)
    s = re.sub(r'\\([&%$#_{}])', r'\1', s)
    s = re.sub(r'\\[a-zA-Z]+\*?', ' ', s)
    s = s.replace('~', ' ').replace('{', '').replace('}', '').replace('$', '').replace('``', '"').replace("''", '"')
    s = s.replace('---', '—').replace('--', '–')
    return re.sub(r'\s+', ' ', s).strip()

def split_top(s, sep):
    """split on sep at brace depth 0, ignoring escaped separators"""
    out, d, cur, i = [], 0, [], 0
    while i < len(s):
        ch = s[i]
        if ch == '\\' and i + 1 < len(s):
            if sep == '\\\\' and s[i + 1] == '\\' and d == 0:
                out.append(''.join(cur)); cur = []; i += 2; continue
            cur.append(s[i:i + 2]); i += 2; continue
        if ch == '{': d += 1
        elif ch == '}': d -= 1
        if sep == '&' and ch == '&' and d == 0:
            out.append(''.join(cur)); cur = []; i += 1; continue
        cur.append(ch); i += 1
    out.append(''.join(cur))
    return out

def load_aux(aux):
    sec = {}
    for m in re.finditer(r'\\newlabel\{([^}]+)\}\{\{([^}]*)\}\{(\d+)\}\{([^}]*)\}', open(aux, encoding='utf-8').read()):
        sec[m.group(1)] = (m.group(2), int(m.group(3)), m.group(4))
    toc = []
    for m in re.finditer(r'\\contentsline \{(section|subsection)\}\{\\numberline \{([\d.]+)\}(.*?)\}\{(\d+)\}', open(aux.replace('.aux', '.toc'), encoding='utf-8').read()):
        toc.append((m.group(2), m.group(3), int(m.group(4))))
    return sec, toc

class PdfPages:
    def __init__(self, pdf):
        self.pdf, self.cache = pdf, {}
        out = subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout
        self.n = int(re.search(r'Pages:\s+(\d+)', out).group(1))
    def text(self, p):
        if p not in self.cache:
            t = subprocess.run(['pdftotext', '-f', str(p), '-l', str(p), '-layout', self.pdf, '-'], capture_output=True, text=True).stdout
            self.cache[p] = re.sub(r'\s+', ' ', t)
        return self.cache[p]
    def label(self, p):
        """printed page number (running header 'PDF 7 · What Is What of the What N'); physical page minus one otherwise"""
        m = re.match(r'\s*PDF 7 · What Is What of the What (\d+)', self.text(p))
        return int(m.group(1)) if m else p - 1
    def find(self, needle, start, span=40):
        """start: printed page to start at; returns the printed page number of the first physical page containing needle"""
        n = re.sub(r'\s+', ' ', needle).strip()[:40]
        if len(n) < 6: return None
        for p in range(max(1, start), min(self.n, start + span) + 1):
            if n in self.text(p): return self.label(p)
        return None

def walk(tex_path):
    """yield ('table'|'figure', dict) in document order with section context"""
    t = open(tex_path, encoding='utf-8').read()
    heads = [(m.start(), m.group(1), m.group(2)) for m in re.finditer(r'\\(part|section|subsection)\*?\{((?:[^{}]|\{[^{}]*\})*)\}', t)]
    deeps = [(m.start(), m.group(1)) for m in re.finditer(r'\\begin\{deep\}\{[^}]*\}\{(G?[\d.]+)~~', t)]
    deep_ends = [m.start() for m in re.finditer(r'\\end\{deep\}', t)]
    def ctx(pos):
        part = sec = sub = ''
        for p, kind, title in heads:
            if p > pos: break
            if kind == 'part': part, sec, sub = tex2txt(title), '', ''
            elif kind == 'section': sec, sub = tex2txt(title), ''
            else: sub = tex2txt(title)
        case = ''
        for p, path in deeps:
            if p > pos: break
            end = next((e for e in deep_ends if e > p), 10**9)
            if end > pos: case = path
        line = t.count('\n', 0, pos) + 1
        return dict(part=part, section=sec, subsection=sub, case=case, line=line)
    for m in re.finditer(r'\\begin\{(longtable|tabular)\}', t):
        env = m.group(1); i = m.end()
        # skip the column spec
        if t[i] == '{':
            d = 0
            for j in range(i, len(t)):
                d += t[j] == '{'; d -= t[j] == '}'
                if d == 0: i = j + 1; break
        e = t.find('\\end{%s}' % env, i)
        body = t[i:e]
        cap = re.search(r'\\caption\{((?:[^{}]|\{[^{}]*\})*)\}', body)
        caption = tex2txt(cap.group(1)) if cap else ''
        if cap: body = body[:cap.start()] + body[cap.end():]
        rows = []
        for r in split_top(body, '\\\\'):
            cells = [tex2txt(c) for c in split_top(r, '&')]
            if any(cells): rows.append(cells)
        # preceding figure-style caption (\caption after a table in a figure/table env) or bold lead-in
        yield 'table', dict(env=env, caption=caption, rows=rows, **ctx(m.start()))
    for m in re.finditer(r'\\includegraphics(?:\[[^\]]*\])?\{([^}]*)\}(?:.{0,40}?)\\caption\{((?:[^{}]|\{[^{}]*\})*)\}', t, re.S):
        yield 'figure', dict(file=m.group(1), caption=tex2txt(m.group(2)), **ctx(m.start()))
