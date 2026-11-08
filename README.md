# Jotter Notarum: Feedback Generator
[![Accessibility](https://github.com/Lynsay/JotterNotarum/actions/workflows/a11y.yml/badge.svg)](https://github.com/Lynsay/JotterNotarum/actions/workflows/a11y.yml)
[![Licence: AGPL-3.0](https://img.shields.io/static/v1?label=licence&message=AGPL-3.0&color=4338ca)](LICENSE)
[![Last commit](https://img.shields.io/github/last-commit/Lynsay/JotterNotarum)](https://github.com/Lynsay/JotterNotarum/commits/main)
[![Latest release](https://img.shields.io/github/v/release/Lynsay/JotterNotarum)](https://github.com/Lynsay/JotterNotarum/releases)
![HTML/CSS/JavaScript](https://img.shields.io/badge/built%20with-HTML%20%7C%20CSS%20%7C%20JavaScript-4338ca)
![No data uploaded](https://img.shields.io/static/v1?label=your%20data&message=stays%20on%20your%20computer&color=4338ca)


A browser-based comment-bank generator for student feedback. Load a .txt file of your
commonly used comments, tick the phrases you want, and copy the finished feedback.
Open `index.html` in a browser; see `instructions.html` for how to format your comment file.

Features: choices inside comments (`[excellent, very good, good]`), add / edit / delete
comments (saved back to your file), word count and spellcheck, and on the Advanced page a
student list, Word export and in-memory drafts per student. Everything runs in the browser;
nothing is uploaded.

Written by Dr Lynsay Shepherd in 2019, updated in 2026.

## Licence

Copyright (C) 2019-2026 Lynsay A. Shepherd

This program is free software: you can redistribute it and/or modify it under the terms of
the GNU Affero General Public License version 3 as published by the Free Software
Foundation. It is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
See the [LICENSE](LICENSE) file for details.

## Third-party libraries

These are bundled under their own licences (MIT, or MIT/GPL-3.0 dual-licensed for JSZip), which remain in force for those files:

- Bootstrap 4.3.1 (css/, js/): https://getbootstrap.com/
- jQuery 3.4.1 (js/): https://jquery.com/
- clipboard.js 2.0.4 (js/): https://clipboardjs.com/
- he 1.2.0 (js/he.js): https://github.com/mathiasbynens/he
- JSZip 3.10.1 (js/jszip.min.js, used by the Advanced page; MIT or GPL-3.0): https://stuk.github.io/jszip/
