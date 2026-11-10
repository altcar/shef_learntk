---
title: Building an app
description: Project structure, SQLite storage, error handling, and a tkinter or Streamlit front end.
sidebar:
  order: 4
---

:::note[Before you start]
This module assumes the classes from **Object-oriented Python** and the charts
from **Charts with matplotlib**. Everything here uses the standard library
except Streamlit, which you only need for the web version:

```bash
pip install streamlit
```
:::

## What counts as "an app"?

A script you run once is a script. An app:

- has a clear entry point and can be installed or double-clicked,
- keeps its data somewhere that survives a restart,
- tells the user what went wrong instead of dumping a traceback,
- and can be handed to someone else who has never read your code.

## Layout

```
expenses/
├── pyproject.toml
├── README.md
└── src/
    └── expenses/
        ├── __init__.py
        ├── __main__.py      # python -m expenses
        ├── cli.py           # argument parsing
        ├── store.py         # database
        ├── models.py        # dataclasses
        └── ui.py            # tkinter or streamlit
```

Keep the layers apart: `store.py` never imports `ui.py`. That way you can swap
the interface without touching the data code, and you can test the store without
opening a window.

## The entry point

```python
# src/expenses/__main__.py
from .cli import main

if __name__ == "__main__":
    raise SystemExit(main())
```

`raise SystemExit(main())` turns a returned integer into the process exit code,
which is what shell scripts and CI check.

## Command line arguments

Stop parsing `sys.argv` by hand; `argparse` gives you help text, validation and
error messages for free.

```python
import argparse

def build_parser():
    parser = argparse.ArgumentParser(prog="expenses", description="Track spending")
    parser.add_argument("--db", default="expenses.db", help="database file")
    sub = parser.add_subparsers(dest="command", required=True)

    add = sub.add_parser("add", help="record an expense")
    add.add_argument("amount", type=float)
    add.add_argument("category")
    add.add_argument("--note", default="")

    report = sub.add_parser("report", help="print a summary")
    report.add_argument("--month", help="YYYY-MM")
    return parser
```

```console
$ python -m expenses add 12.50 "food" --note "lunch"
$ python -m expenses report --month 2026-11
```

Note `type=float`: argparse rejects `lunch` as an amount before your code runs.

## Storing data with SQLite

SQLite ships with Python, needs no server, and keeps everything in one file. It
is the right default until you have a reason to want something else.

```python
import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS expenses (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    spent_on  TEXT NOT NULL,
    amount    REAL NOT NULL CHECK (amount > 0),
    category  TEXT NOT NULL
);
"""

class Store:
    def __init__(self, path: str = "expenses.db"):
        self.connection = sqlite3.connect(Path(path))
        self.connection.row_factory = sqlite3.Row
        self.connection.executescript(SCHEMA)

    def add(self, spent_on: str, amount: float, category: str) -> int:
        cursor = self.connection.execute(
            "INSERT INTO expenses (spent_on, amount, category) VALUES (?, ?, ?)",
            (spent_on, amount, category),
        )
        self.connection.commit()
        return cursor.lastrowid

    def total_by_category(self, month: str | None = None):
        sql = "SELECT category, SUM(amount) AS total FROM expenses"
        params: tuple = ()
        if month:
            sql += " WHERE spent_on LIKE ?"
            params = (f"{month}-%",)
        sql += " GROUP BY category ORDER BY total DESC"
        return self.connection.execute(sql, params).fetchall()
```

:::caution[Always use placeholders]
`execute("... VALUES (?, ?)", (a, b))` escapes values for you. Building the
query with f-strings is how SQL injection happens, and it will also break the
moment a category contains an apostrophe.
:::

Use `with` for transactions you can abandon:

```python
with self.connection:            # commits on success, rolls back on error
    self.connection.execute(...)
```

## Failing well

Three rules:

1. Catch only what you can handle.
2. Give the user an action, not a stack trace.
3. Never silence an exception with a bare `except:`.

```python
class ExpenseError(Exception):
    """Something the user can fix."""

def parse_amount(raw: str) -> float:
    try:
        amount = float(raw)
    except ValueError as exc:
        raise ExpenseError(f"{raw!r} is not a number") from exc
    if amount <= 0:
        raise ExpenseError("amount must be greater than zero")
    return amount
```

```python
def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    try:
        ...
    except ExpenseError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 0
```

`raise ... from exc` keeps the original traceback attached while showing your
message — useful when debugging, invisible when it works.

## A tkinter front end

tkinter is in the standard library, so this needs no install.

```python
import tkinter as tk
from tkinter import ttk

def build_window(store):
    window = tk.Tk()
    window.title("Expenses")

    frame = ttk.Frame(window, padding=12)
    frame.grid(row=0, column=0, sticky="nsew")

    ttk.Label(frame, text="Amount").grid(row=0, column=0, sticky="w")
    amount = ttk.Entry(frame, width=12)
    amount.grid(row=0, column=1)

    ttk.Label(frame, text="Category").grid(row=1, column=0, sticky="w")
    category = ttk.Combobox(frame, values=["food", "travel", "books"])
    category.grid(row=1, column=1)

    output = tk.StringVar(value="No entries yet")
    ttk.Label(frame, textvariable=output).grid(row=3, column=0, columnspan=2)

    def on_add():
        try:
            store.add("2026-11-10", float(amount.get()), category.get())
            output.set("Saved")
        except (ValueError, ExpenseError) as exc:
            output.set(f"error: {exc}")

    ttk.Button(frame, text="Add", command=on_add).grid(row=2, column=0, columnspan=2)
    return window
```

Event handlers must never raise: tkinter will print to stderr and the user sees
nothing. Catch, then update a label.

## A Streamlit front end

Streamlit turns a script into a web app with no HTML. It is the quickest way to
put a chart in front of someone.

```python
import streamlit as st
import pandas as pd

from expenses.store import Store

st.set_page_config(page_title="Expenses", page_icon="💸")
st.title("Expenses")

store = Store()

with st.form("new"):
    amount = st.number_input("Amount", min_value=0.01, step=0.5)
    category = st.selectbox("Category", ["food", "travel", "books"])
    if st.form_submit_button("Add"):
        store.add("2026-11-10", amount, category)
        st.success("Saved")

rows = store.total_by_category()
if rows:
    frame = pd.DataFrame([dict(row) for row in rows])
    st.bar_chart(frame, x="category", y="total")
else:
    st.info("Nothing recorded yet.")
```

Run it with:

```bash
streamlit run src/expenses/ui.py
```

:::caution[Streamlit re-runs the whole script]
Every interaction re-executes the file from top to bottom. Anything expensive
belongs in `@st.cache_data`; anything that must persist belongs in SQLite, not
in a module-level variable.
:::

## Packaging

`pyproject.toml` is enough to make the project installable:

```toml
[project]
name = "expenses"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = ["streamlit", "pandas"]

[project.scripts]
expenses = "expenses.cli:main"

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.setuptools.packages.find]
where = ["src"]
```

```bash
pip install -e .          # editable install, for development
expenses report           # the console script
```

## Checklist before you call it done

- [ ] `python -m expenses --help` explains every command.
- [ ] Bad input (text where a number belongs) produces a readable message.
- [ ] Data survives quitting and reopening.
- [ ] No absolute paths or hard-coded user names.
- [ ] `README.md` says how to install and how to run.
- [ ] No secrets or `.db` files committed to git.

## Checkpoint project

Build the expense tracker end to end:

1. `Store` with SQLite, `add` and `total_by_category`.
2. `argparse` CLI with `add` and `report`.
3. A Streamlit (or tkinter) front end over the same `Store`.
4. A bar chart of spending by category.
5. A test that inserts two expenses and asserts the totals — plain `assert` is
   fine, `pytest` is better.

## Exercises

1. Add `--month` filtering to the report and a `delete <id>` command.
2. Add a `budget` table and warn in the UI when a category exceeds its budget.
3. Make the store swappable: an in-memory SQLite (`":memory:"`) for tests.
4. Package it, install it with `pip install -e .`, and run it from a different
   directory.
