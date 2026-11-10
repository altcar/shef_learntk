---
title: Charts with matplotlib
description: Line, bar, scatter and histogram plots, subplots, styling, and plotting from pandas.
sidebar:
  order: 3
---

:::note[Before you start]
Install matplotlib:

```bash
pip install matplotlib pandas
```

In the Cursor/VS Code REPL and in some notebooks, `plt.show()` opens a window.
From a plain script on a server there is no window, so save to a file instead.
:::

## The mental model

matplotlib has two APIs and mixing them is the usual source of confusion.

- **pyplot** (`plt.plot(...)`) keeps an implicit "current figure". Great for
  quick plots and for scripts.
- **Object-oriented** (`fig, ax = plt.subplots()`) gives you explicit handles.
  Use this in anything longer than a few lines, especially with subplots.

From here on we use the object-oriented style.

```python
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(8, 5))
ax.plot([1, 2, 3, 4], [1, 4, 9, 16], marker="o")
ax.set(xlabel="Week", ylabel="Score", title="Progress over the course")
fig.tight_layout()
fig.savefig("progress.png", dpi=150)
```

`Fig` is the canvas, `Axes` is one plot on it. `fig.savefig` writes the file;
call `fig.tight_layout()` first or your labels get clipped.

## The four plots you will actually use

```python
fig, axes = plt.subplots(2, 2, figsize=(11, 8))

# 1. Line: something changing over time
axes[0, 0].plot(weeks, averages, marker="o")
axes[0, 0].set_title("Average per week")

# 2. Bar: comparing categories
axes[0, 1].bar(streams, counts)
axes[0, 1].set_title("Students per stream")

# 3. Scatter: relationship between two numbers
axes[1, 0].scatter(hours_studied, scores)
axes[1, 0].set_title("Study time vs score")

# 4. Histogram: the shape of one distribution
axes[1, 1].hist(scores, bins=8, edgecolor="white")
axes[1, 1].set_title("Score distribution")

fig.tight_layout()
```

| Plot | Answers | Typical mistake |
| --- | --- | --- |
| `plot` | How does a value change across an ordered axis? | Using it for unordered categories |
| `bar` | How do categories compare? | Forgetting `ax.set_xticks` labels |
| `scatter` | Are two measurements related? | Overplotting thousands of points |
| `hist` | What shape does one variable have? | Choosing too few or too many `bins` |

## Labels, legends, limits

```python
ax.plot(x, y_a, label="Cohort A")
ax.plot(x, y_b, label="Cohort B")

ax.set_xlabel("Week")
ax.set_ylabel("Average score")
ax.set_title("Two cohorts compared")
ax.set_ylim(0, 100)
ax.set_xticks(range(1, 8))
ax.grid(True, alpha=0.3)
ax.legend(loc="lower right")
```

Without a legend, multiple lines are unreadable. Without `set_ylim(0, 100)` a
bar chart can exaggerate differences — for bars, always start the value axis at
zero unless you have a reason not to.

## Styling without fighting it

```python
plt.style.use("ggplot")          # or "seaborn-v0_8", "bmh"
```

For individual series, pass colour and style explicitly:

```python
ax.plot(x, y, color="#2563eb", linewidth=2, linestyle="--", marker="s", markersize=4)
```

Accessible colours matter more than pretty ones. Avoid red/green as the only
distinction.

## Plotting straight from pandas

This is where the previous module pays off.

```python
import pandas as pd

frame = pd.read_excel("grades.xlsx")

weekly = frame.groupby("Week")["Score"].mean()
weekly.plot(kind="line", marker="o", title="Average score by week")

frame.plot(kind="scatter", x="Hours studied", y="Score")
```

`Series.plot()` and `DataFrame.plot()` return an `Axes`, so you can keep styling
it afterwards:

```python
ax = weekly.plot(kind="bar")
ax.set_ylabel("Average score")
ax.set_ylim(0, 100)
ax.figure.savefig("weekly.png", dpi=150)
```

## Saving figures

```python
fig.savefig("chart.png", dpi=150, bbox_inches="tight")
fig.savefig("chart.svg")          # vector, scales for print
```

- `dpi=150` is a sensible default; 300 for print.
- `bbox_inches="tight"` crops the whitespace.
- Prefer `.svg` for anything that goes on a webpage or into a report.
- Close figures in long scripts with `plt.close(fig)`, otherwise a loop that
  creates a plot per student will eat all your memory.

## Twelve-line template

```python
import matplotlib
matplotlib.use("Agg")             # no display needed; safe on servers
import matplotlib.pyplot as plt

def save_chart(x, y, path, title):
    fig, ax = plt.subplots(figsize=(8, 4.5))
    ax.plot(x, y, marker="o", color="#2563eb")
    ax.set(title=title, xlabel="Week", ylabel="Score")
    ax.set_ylim(0, 100)
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)
```

`matplotlib.use("Agg")` before importing pyplot avoids the "no display" crash on
headless machines — you will want this in **Building an app**.

## Checkpoint project

Take the gradebook from the previous module and produce a one-page PDF report:

1. A line chart of the cohort's average score per week.
2. A bar chart of students per stream.
3. A histogram of final scores.
4. A scatter of hours studied against final score, with a note about correlation
   never implying causation.
5. Save as `report.pdf` using `PdfPages`:

```python
from matplotlib.backends.backend_pdf import PdfPages

with PdfPages("report.pdf") as pdf:
    for figure in figures:
        pdf.savefig(figure)
```

## Exercises

1. Plot the same data as a bar chart and as a line chart. Which is honest, and
   why?
2. Add error bars showing the standard deviation per week (`ax.errorbar`).
3. Draw two cohorts on one plot with different colours and a legend, then split
   them into two stacked subplots. Which reads better?
4. Annotate the highest point on a line with `ax.annotate`.
