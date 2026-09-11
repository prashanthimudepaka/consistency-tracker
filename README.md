# 365 Consistency Tracker

A single-file, no-dependency HTML tracker for building daily consistency over a full year (Sep 11, 2026 – Sep 10, 2027).

## Features

- **Daily tracker** — mark each habit ✓ done / ◐ half / ✕ missed per day, with a wake-time column (green 4 am, orange 5–6 am, red 7–8 am), daily mood emoji, and live stats (consistency %, streak 🔥, perfect days, 4 am wake days).
- **Year heatmap** — GitHub-style view of all 365 days; hover for details, click to jump to a month.
- **Strict mode** — only today and yesterday are editable: no rewriting history, no pre-filling the future 🔒.
- **Hourly log** — 24 rows per day to note what you actually did each hour.
- **To-dos & Notes** — today's checklist up top; collapsible date-grouped sections for Left over, Backlog, and Done; checkbox or bullet display; per-task stopwatch ▶ and countdown timer ⏱ (with confetti when time's up); free-form notes.

## Usage

Open `index.html` in any browser. Progress is saved in the browser's localStorage (per device/browser).

> The hosted version on claude.ai additionally syncs across devices by saving new versions of the page itself.

## Tech

Plain HTML/CSS/JS in one file — no build step, no dependencies. Light and dark theme aware.
