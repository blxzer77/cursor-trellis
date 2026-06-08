# ASCII-Art Diagram Alignment in Mintlify

> How to make box-drawing diagrams render correctly in browser, especially with CJK text.

---

## Problem Summary

ASCII-art diagrams using box-drawing characters (`─│┌┐└┘┬┤├┼`) break in the browser for two reasons:

| Problem                            | Root Cause                                                                               | Affected                |
| ---------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------- |
| Box-drawing chars wider than ASCII | JetBrains Mono (Mintlify default) renders `─│┌` at ~1.8× ASCII width                     | All languages           |
| CJK chars not exactly 2× ASCII     | Browser CJK fallback fonts render Chinese at ~1.7× ASCII instead of terminal-standard 2× | Chinese/Japanese/Korean |

---

## Solution 1: English-Only Diagrams (Font Override)

For diagrams with only ASCII text, switching the code block font to Menlo fixes everything — Menlo renders box-drawing chars at exactly 1× ASCII width.

**CSS in `styles.css`:**

```css
pre code {
  font-family: Menlo, Monaco, 'Courier New', monospace !important;
}
```

Use standard markdown code blocks (` ``` `). No other changes needed.

---

## Solution 2: Chinese CJK Diagrams (2ch Inline-Block)

For diagrams mixing Chinese text with box-drawing borders, **no font** can guarantee CJK = 2× ASCII in browsers. The solution is CSS-forced widths.

### Technique

1. Wrap each CJK character in `<b>` tags
2. CSS forces `<b>` to `display:inline-block;width:2ch` — exactly 2 monospace columns
3. Use `dangerouslySetInnerHTML` to bypass MDX parsing issues

**CSS in `styles.css`:**

```css
pre.cjk-diagram {
  display: block !important; /* Override Mintlify's display:flex on <pre> */
  padding: 14px 16px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 24px;
  font-family: Menlo, Monaco, 'Courier New', monospace;
  overflow-x: auto;
  white-space: pre;
  margin: 16px 0;
  background: #f8f8f8;
  color: #1e1e1e;
}

.dark pre.cjk-diagram {
  background: #1e1e1e;
  color: #d4d4d4;
}

pre.cjk-diagram b {
  display: inline-block;
  width: 2ch;
  text-align: center;
  font-weight: normal;
}
```

**MDX usage:**

```mdx
<pre
  className="cjk-diagram"
  dangerouslySetInnerHTML={{
    __html: `┌──────────────┐
│  <b>用</b><b>户</b>          │
└──────────────┘`,
  }}
/>
```

### Generator Script

Use `/tmp/gen_zh_html_diagrams.py` to automate CJK wrapping. Key functions:

- `is_cjk(ch)` — detect CJK characters (U+4E00-9FFF etc.)
- `display_width(s)` — calculate terminal-style display width (CJK=2, ASCII=1)
- `cjk_pad(content, width)` — pad content to exact display width
- `wrap_cjk(text)` — wrap each CJK char in `<b>` tags

---

## Gotchas (Learned the Hard Way)

### 1. Mintlify `<pre>` has `display:flex`

Mintlify's CSS sets `display:flex` on `<pre>` elements. This turns `<b>` children into flex items where `display:inline-block` becomes `display:block`. **Must** add `display:block !important` on `pre.cjk-diagram`.

### 2. MDX blank lines trigger markdown re-parsing

In MDX v2+, a blank line inside a JSX element (like `<pre>`) causes the parser to re-enter markdown mode. Content like `# Heading` after a blank line becomes an `<h1>` tag, breaking everything. Solutions:

- Use `dangerouslySetInnerHTML` (completely bypasses MDX parsing) **[recommended]**
- Or ensure no truly empty lines exist inside `<pre>` (replace with single space)

### 3. JSX special characters in `<pre>` children

If using direct JSX children (not `dangerouslySetInnerHTML`):

- `{` and `}` must be escaped as `{"{"}` and `{"}"}`
- `#` at line start after blank line becomes heading
- `===` can become setext heading marker

`dangerouslySetInnerHTML` avoids all of these.

### 4. `size-adjust` in `@font-face` doesn't work for CJK

Attempted using `@font-face { size-adjust: 118% }` to scale CJK font width to 2× ASCII. Failed because:

- `local()` in `@font-face` only matches system fonts, not web fonts
- Browser applies CJK from fallback font, not from the `@font-face` declaration
- Even when applied, it scales ALL metrics (height too), causing uneven line heights

### 5. Web font CJK subsets don't guarantee 2:1 ratio

LXGW WenKai Mono web font (`@callmebill/lxgw-wenkai-web`):

- Loads 217+ subset files via `unicode-range`
- ASCII glyphs fall through to Menlo (font doesn't include ASCII in web subset)
- CJK/ASCII ratio = 1.84 (LXGW CJK + Menlo ASCII), not 2.0

### 6. Browser CJK width varies by OS

| OS      | CJK Fallback Font      | CJK/ASCII Ratio |
| ------- | ---------------------- | --------------- |
| macOS   | PingFang SC / Hiragino | ~1.69           |
| Windows | Microsoft YaHei        | ~1.67           |
| Linux   | Noto Sans CJK          | varies          |

Character-level padding CANNOT fix this because the ratio is font-dependent. The `2ch` CSS technique is the only cross-platform solution.

---

## Measurement Reference

At `font-size: 14px` with Menlo:

| Character           | Width (px) | Ratio to ASCII |
| ------------------- | ---------- | -------------- |
| ASCII `a`           | 8.43       | 1.00           |
| Space               | 8.43       | 1.00           |
| Box `─`             | 8.43       | 1.00           |
| Box `│`             | 8.43       | 1.00           |
| CJK `中` (natural)  | 14.28      | 1.69           |
| CJK `中` (with 2ch) | 16.86      | 2.00           |

---

## Quick Decision Tree

````
Need ASCII-art diagram in docs?
├── English only?
│   └── Use standard ``` code block + Menlo font override ✓
└── Contains CJK text?
    └── Use <pre class="cjk-diagram"> + dangerouslySetInnerHTML
        + wrap each CJK char in <b> tags ✓
````
