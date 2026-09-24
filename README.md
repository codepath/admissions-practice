# CodePath Admissions Practice

Free, browser-based practice for CodePath's HackerRank placement assessments. Every page is a single static HTML file. There is no build step and no server: answers are checked in the student's browser and never sent anywhere.

Students reach these pages from the HackerRank tips sheet. There is intentionally no home page.

| Page | Course | What it practices | How it checks |
|---|---|---|---|
| [`cyb101/`](cyb101/) | CYB101 | Three research puzzles | Passcode answers |
| [`web101/`](web101/) | WEB101 | Planning an event website: six short questions plus a wireframe | Word count only (open-ended) |
| [`ai110/`](ai110/) | AI110 | Lists and loops, functions, and classes, adapted from the AI110 Bridge Module | Python code runs in the browser (Pyodide) plus answer checks |
| [`cyb102/`](cyb102/) | CYB102 | Three bash command challenges plus a blue-team scenario | Command rules; scenario answers by word count |
| [`web102/`](web102/) | WEB102 | The JavaScript logic behind the Sea Monster Crowdfunding website, using its game data | JavaScript code runs in the browser plus answer checks |
| [`ai201/`](ai201/) | AI201 | The candidate guide's coding and prompt-writing examples, built up step by step | Python code runs in the browser plus answer checks |

## How a question works

1. The student answers and presses **Check**.
2. A wrong answer shows a targeted message and the first hint.
3. Hints are available at any time. After a hint, the student can reveal the answer with an explanation.

Answers are not hidden: this is practice, and the answer is available whenever a student asks for it.

## Files

- `assets/practice.css` holds the shared styles. Light and dark themes follow the student's system setting.
- `assets/practice.js` holds the shared engine. Each page declares its questions in `window.PRACTICE` and places a `<div data-item="id"></div>` where each question should appear.
- `web102/sea-monster-starter.zip` holds the Sea Monster starter code (HTML, CSS, JavaScript, game data, and images) for the optional build steps on the WEB102 page. The files are an exact copy of CodePath's public Sea Monster starter code, without its README and .gitignore. The files sit at the top level of the zip, so unzipping it on Windows or a Mac gives one `sea-monster-starter` folder.

Question types: `text` (optionally with a custom `validate` function), `choice`, `python`, `javascript`, `writing`, `checklist`. See any page's `window.PRACTICE` block for examples.

Python questions load [Pyodide](https://pyodide.org/) 0.27.7 from jsDelivr the first time a student clicks into a code box. JavaScript questions run in a fresh Web Worker. Both kinds of code have a 6-second limit, so an endless loop cannot freeze the page.

## Publishing

GitHub Pages serves the `main` branch from the repository root.
