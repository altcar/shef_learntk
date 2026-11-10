---
title: Python in Practice
description: The advanced course — classes, spreadsheets, charts, apps and AI, in five modules.
sidebar:
  order: 0
---

You can write Python. You can loop, branch, build functions, read a file and
split code into modules. **Python in Practice** takes the next five steps, in
the order you would actually take them on a real project.

| Module | You will build | New tools |
| --- | --- | --- |
| [Object-oriented Python](/advanced/oop) | A small library system | `class`, `dataclass`, inheritance |
| [Excel and files](/advanced/excel) | A gradebook report | `openpyxl`, `csv`, `pandas` |
| [Charts with matplotlib](/advanced/matplotlib) | A one-page data report | `matplotlib`, `pandas` plotting |
| [Building an app](/advanced/apps) | An expense tracker | `sqlite3`, `argparse`, tkinter, Streamlit |
| [AI with Python](/advanced/ai) | A course assistant | `scikit-learn`, LLM APIs, embeddings |

## How the course works

- **Recorded sessions.** Each module is a recording plus the notes on this site,
  about two hours end to end.
- **Every module ends in a checkpoint project.** Reading code does not teach you
  to write code; typing it does.
- **Modules build on each other.** The gradebook from module 2 becomes the charts
  in module 3 and the data behind the app in module 4.
- **The beginner course is the prerequisite.** If `for item in range(3):`,
  functions, dictionaries and `with open(...)` are not yet comfortable, finish
  [Python Foundations](/24b) first.

## Installing things

```bash
python -m pip install --upgrade pip
pip install openpyxl pandas matplotlib scikit-learn numpy streamlit
```

Then check it worked:

```bash
python -c "import openpyxl, pandas, matplotlib, sklearn; print('ok')"
```

:::tip[Use a virtual environment]
`python -m venv .venv` then activate it, so each project has its own libraries.
It costs one command and saves you from dependency conflicts later.
:::

## Before each module

1. Open the notes for the module.
2. Create `week-N.py` (or a folder for the app).
3. Type the examples by hand. Copy-paste teaches your fingers nothing.
4. Do the exercises before the checkpoint project.

## Getting unstuck

- The `## Checkpoint project` section of each module tells you exactly what to
  build.
- Ask in the community Discord — paste the error, not a screenshot of it, and
  say what you expected.
- Use AI tools as a last resort, and ask them to *explain* the error rather than
  to write the whole program. Module 5 explains why that distinction matters.
