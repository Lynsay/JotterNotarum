# Jotter Notarum: Feedback Generator
[![Accessibility](https://github.com/Lynsay/JotterNotarum/actions/workflows/a11y.yml/badge.svg)](https://github.com/Lynsay/JotterNotarum/actions/workflows/a11y.yml)
[![Licence: AGPL-3.0](https://img.shields.io/static/v1?label=licence&message=AGPL-3.0&color=4338ca)](LICENSE)
[![Last commit](https://img.shields.io/github/last-commit/Lynsay/JotterNotarum)](https://github.com/Lynsay/JotterNotarum/commits/main)
[![Latest release](https://img.shields.io/github/v/release/Lynsay/JotterNotarum)](https://github.com/Lynsay/JotterNotarum/releases)
![HTML/CSS/JavaScript](https://img.shields.io/badge/built%20with-HTML%20%7C%20CSS%20%7C%20JavaScript-4338ca)
![No data uploaded](https://img.shields.io/static/v1?label=your%20data&message=stays%20on%20your%20computer&color=4338ca)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.24574189.svg)](https://doi.org/10.5281/zenodo.24574189)


## ❓ What is Jotter Notarum?

Jotter Notarum is a comment-bank tool for marking. You load your own bank of frequently used feedback comments, tick the ones that apply to a student's work, and generate feedback that you can edit and copy into your marking system. It was first written in 2019 and given a new look in 2026, supported by Claude.

**Use it online:** https://lynsay.github.io/JotterNotarum/

Alternatively, download the files and open `index.html` in a browser. See the [Instructions page](https://lynsay.github.io/JotterNotarum/instructions.html) (`instructions.html`) for how to format your comment file.

Features: choices inside comments (`[excellent, very good, good]`), add / edit / delete
comments (saved back to your file), word count and spellcheck, and on the Advanced page a
student list, Word export and in-memory drafts per student. Everything runs in the browser;
nothing is uploaded.

## 📝 The name

A *jotter* is the term Scots use for a notebook, the kind used for taking notes at school. *Notarum* is Latin for "of the notes" (the genitive plural of *nota*, a note). Together: a notebook of notes.

## 👩‍💻 Who made it?

Written by [Dr Lynsay Shepherd](https://www.abertay.ac.uk/staff-search/dr-lynsay-shepherd/), a Reader in Cybersecurity and Human-Computer Interaction and a Senior Fellow of the Higher Education Academy (SFHEA). Her research looks at the human side of cybersecurity and gaming, from usable security and eye-tracking to serious games, embodied agents, extended reality and romance fraud prevention. She teaches secure web development, human-centred security and research methods, and is passionate about designing technology, and teaching, around how people really behave.

Any issues or ideas? Email [lynsay.shepherd@abertay.ac.uk](mailto:lynsay.shepherd@abertay.ac.uk?Subject=%5BIssue%5D%20Jotter%20Notarum%3A%20Feedback%20Generator).

## 🎓 Citing Jotter Notarum

### The tool

If you use Jotter Notarum in your teaching or research, please cite it as:

> Shepherd, L. A. (2026) *Jotter Notarum: Feedback Generator* [Software]. Available at: https://lynsay.github.io/JotterNotarum/ (Source code: https://github.com/Lynsay/JotterNotarum)

BibTeX:

```bibtex
@software{shepherd_jotter_notarum_2026,
  author    = {Shepherd, Lynsay A.},
  title     = {Jotter Notarum: Feedback Generator},
  year      = {2026},
  url       = {https://lynsay.github.io/JotterNotarum/},
  note      = {Software. Source code: https://github.com/Lynsay/JotterNotarum}
}
```

### The paper

> Paper details to follow.

## 📄 Licence

Copyright (C) 2019-2026 Lynsay A. Shepherd

This program is free software: you can redistribute it and/or modify it under the terms of
the GNU Affero General Public License version 3 as published by the Free Software
Foundation. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
See the [LICENSE](LICENSE) file for details.

## 📚 Third-party libraries

These are bundled under their own licences (MIT, or MIT/GPL-3.0 dual-licensed for JSZip), which remain in force for those files:

- Bootstrap 4.3.1 (css/, js/): https://getbootstrap.com/
- jQuery 3.4.1 (js/): https://jquery.com/
- clipboard.js 2.0.4 (js/): https://clipboardjs.com/
- he 1.2.0 (js/he.js): https://github.com/mathiasbynens/he
- JSZip 3.10.1 (js/jszip.min.js, used by the Advanced page; MIT or GPL-3.0): https://stuk.github.io/jszip/
