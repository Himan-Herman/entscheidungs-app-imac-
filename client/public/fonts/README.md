# Bundled font assets

## `medscoutx-document-sans.ttf`

**What it is.** A subset of **DejaVu Sans 2.37**, renamed. It exists for one
purpose: embedding into the PDF that the patient document translation feature
generates in the browser. It is **not** a UI font — no stylesheet references it,
and the application's typography is unchanged.

**Why a bundled font at all.** jsPDF's built-in Helvetica is WinAnsi-encoded and
has no Cyrillic glyphs. MedScoutX ships six UI languages including Russian, so a
document translated into Russian could not be exported without a Unicode font.

**Why not the font already in `client/public/`.** `previsit-pdf-tahoma.ttf` is a
proprietary Microsoft typeface whose embedding and redistribution licence could
not be established from this repository. Reusing it here would have been assuming
a licence. It is left untouched for its existing Pre-Visit use.

### Provenance

| | |
|---|---|
| Upstream | DejaVu Fonts, `DejaVuSans.ttf` |
| Version | 2.37 |
| Obtained via | npm package `dejavu-fonts-ttf@2.37.3` |
| Licence | Bitstream Vera Fonts Copyright + Arev Fonts Copyright — see `LICENSE-DejaVu.txt` |
| Upstream size | 757 076 bytes |
| Bundled size | 267 740 bytes (subset) |

### Licence compliance

The Bitstream Vera licence grants the rights this use needs — reproduce,
distribute, use, copy, merge, publish, and embed — and permits sale as part of a
larger software package. Two conditions apply and both are met:

1. **The copyright and permission notice must accompany every copy.** It is in
   `LICENSE-DejaVu.txt` in this directory, which is served alongside the font.
2. **A modified font must be renamed** so that its name contains neither
   "Bitstream" nor "Vera". The subset is renamed to *MedScoutX Document Sans*;
   its `name` table records `MedScoutXDocumentSans-Regular;subset-of-DejaVuSans`
   so the derivation stays traceable.

The licence forbids selling the font by itself. MedScoutX does not distribute it
as a font product.

### What the subset contains

Basic Latin, Latin-1 Supplement, Latin Extended-A/B, IPA extensions, combining
diacritics, Greek, Cyrillic and Cyrillic Supplement, general punctuation,
currency, letterlike symbols, arrows, mathematical operators and a few
geometric/misc symbols — 2 002 codepoints.

Verified present for every character the six shipped UI languages need,
including `ä ö ü ß`, `é è ê ë à â ç œ`, `á í ó ú ñ ¿ ¡`, `à è ì ò ù` and the
full Cyrillic alphabet with `ё Ё`. The coverage assertion is a test, not a
claim: see `client/src/features/practiceDocuments/__tests__/`.

**Regular weight only.** Bold was deliberately not bundled — it would have added
roughly another 250 KB for headings that are already distinguished by size. The
PDF generator uses one weight.

### Regenerating the subset

```bash
npm pack dejavu-fonts-ttf@2.37.3
# extract, then subset with fontTools:
pyftsubset DejaVuSans.ttf \
  --unicodes="U+0020-007E,U+00A0-00FF,U+0100-024F,U+0250-02AF,U+0300-036F,U+0374-03FF,U+0400-052F,U+2000-206F,U+20A0-20BF,U+2100-214F,U+2190-21FF,U+2200-22FF,U+25A0-25FF,U+2600-26FF" \
  --layout-features='*' --name-IDs='*' --name-legacy \
  --output-file=medscoutx-document-sans.ttf
```

The name table must then be rewritten to *MedScoutX Document Sans*, as the
licence requires for a modified copy.
