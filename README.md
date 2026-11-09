# Mobley-Wan Advisor

A static snapshot of the Mobley-Wan Kenobi fantasy basketball advisor (ATA Season 6), hosted on GitHub Pages.

- `index.html`: the page (8 tabs, phone-friendly, light and dark).
- `data/*.json`: the numbers for each section, refreshed by Claude from ESPN.
- `data.js`: built from `data/` by `build.ps1`; the page reads this.
- `serve.ps1`: local preview at http://localhost:8765/.

To rebuild after the data changes:

```
powershell -ExecutionPolicy Bypass -File build.ps1 "Mon Nov 9, 2026, 11 AM MYT"
```
