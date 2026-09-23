# CodePath Admissions Practice

Free, browser-based practice for CodePath's HackerRank placement assessments. Every page is a single static HTML file. There is no build step and no server: answers are checked in the student's browser and never sent anywhere.

Students reach these pages from the HackerRank tips sheet. There is intentionally no home page.

| Page | Course | What it practices | How it checks |
|---|---|---|---|
| [`cyb101/`](cyb101/) | CYB101 | Three research puzzles, adapted from the CYB101 prework | Passcode answers |
| [`web101/`](web101/) | WEB101 | Planning an event website: six short questions plus a wireframe | Word count only (open-ended) |
| [`ai110/`](ai110/) | AI110 | Lists and loops, functions, and classes, adapted from the AI110 Bridge Module | Python code runs in the browser (Pyodide) plus answer checks |

## How a question works

1. The student answers and presses **Check**.
2. A wrong answer shows a targeted message and the first hint.
3. After a hint, the student can see more hints or reveal the answer with an explanation.

Answers are not hidden: this is practice, and the answer is available whenever a student asks for it.

## Files

- `assets/practice.css` holds the shared styles. Light and dark themes follow the student's system setting.
- `assets/practice.js` holds the shared engine. Each page declares its questions in `window.PRACTICE` and places a `<div data-item="id"></div>` where each question should appear.

Question types: `text`, `choice`, `python`, `writing`, `checklist`. See any page's `window.PRACTICE` block for examples.

Python questions load [Pyodide](https://pyodide.org/) 0.27.7 from jsDelivr the first time a student clicks into a code box. Code runs in a Web Worker with a 6-second limit, so an endless loop cannot freeze the page.

## Publishing

GitHub Pages serves the `main` branch from the repository root.
