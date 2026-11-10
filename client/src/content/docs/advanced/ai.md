---
title: AI with Python
description: Train a first scikit-learn model, call a language model API safely, and build a small course assistant.
sidebar:
  order: 5
---

:::note[Before you start]
Install what this module uses:

```bash
pip install scikit-learn numpy
# only if you want to call an LLM API from code:
pip install openai
```

You need the classes from **Object-oriented Python** for the assistant at the
end, and SQLite from **Building an app** if you want to cache answers.
:::

## Two different things called "AI"

It helps to separate them, because they have different costs, risks and uses.

| | Classic machine learning | Large language models |
| --- | --- | --- |
| Input | Rows of numbers (a table) | Text |
| Output | A label or a number | Text |
| You train it | Yes, on your own data | No, you call someone else's |
| Runs on | Your laptop | A remote API |
| Good for | Predictions, classification, ranking | Writing, summarising, explaining |
| Fails by | Being confidently wrong on new data | Making things up fluently |

Both are worth knowing. Start with the first because it is small, local and
teaches you what "training" really means.

## A first model with scikit-learn

The iris dataset: 150 flowers, four measurements, three species.

```python
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import accuracy_score, classification_report

data = load_iris()
X, y = data.data, data.target

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

model = DecisionTreeClassifier(max_depth=3, random_state=42)
model.fit(X_train, y_train)

predictions = model.predict(X_test)

print("accuracy:", accuracy_score(y_test, predictions))
print(classification_report(y_test, predictions, target_names=data.target_names))
```

Four things to take away:

- **`train_test_split`** exists so you can measure the model on data it has never seen. Testing on training data always looks good and means nothing.
- **`random_state`** makes runs reproducible. Without it, your accuracy changes every run and you cannot compare experiments.
- **`max_depth=3`** deliberately limits the tree. A deeper tree memorises the training data — that is *overfitting*.
- **`accuracy`** alone is misleading if one class dominates. Look at the per-class report.

Try it yourself: remove `max_depth`, or train on 10 rows, and watch training
accuracy rise while test accuracy falls. That gap *is* overfitting.

### Trying your own table

```python
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier

frame = pd.read_excel("grades.xlsx")
frame = frame.dropna(subset=["Passed"])

features = ["Week 1", "Week 2", "Week 3", "Week 4"]
X = frame[features]
y = frame["Passed"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=0)
model = RandomForestClassifier(n_estimators=200, random_state=0).fit(X_train, y_train)
print(model.score(X_test, y_test))
```

Before trusting any number here, ask: is 20% of this dataset enough to mean
anything? With 30 students, no. Small data gives unstable results.

## Calling a language model

An LLM API is an HTTP request with a list of messages. The shape is the same
across providers.

```python
import os
from openai import OpenAI

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "system", "content": "You are a concise Python tutor."},
        {"role": "user", "content": "Explain what a class is in two sentences."},
    ],
    temperature=0.2,
)

print(response.choices[0].message.content)
```

:::danger[Never hard-code an API key]
Read it from the environment (or a `.env` file loaded with `python-dotenv`) and
add `.env` to `.gitignore`. A key committed to git is a key that is public
forever — GitHub is scanned continuously for them. If one leaks, revoke it in
the provider dashboard immediately.
:::

What the parameters mean:

| Parameter | Effect | Sensible default |
| --- | --- | --- |
| `model` | Which model, and therefore cost and quality | The smallest that works |
| `temperature` | 0 = repeatable, 1 = varied | `0.2` for code, higher for writing |
| `max_tokens` | Caps the length (and the bill) | Set it |
| `messages` | Conversation so far, oldest first | Keep history short |

Wrap it so your app has one place to change:

```python
from dataclasses import dataclass

@dataclass
class Answer:
    text: str
    model: str

class Tutor:
    def __init__(self, client, model="gpt-4o-mini"):
        self.client = client
        self.model = model

    def ask(self, question: str, context: str = "") -> Answer:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        if context:
            messages.append({"role": "system", "content": f"Course notes:\n{context}"})
        messages.append({"role": "user", "content": question})

        response = self.client.chat.completions.create(
            model=self.model, messages=messages, temperature=0.2, max_tokens=400
        )
        return Answer(response.choices[0].message.content, self.model)
```

## Making it answer from *your* notes

An LLM does not know your course. The simplest fix is to put the relevant notes
in the prompt ("retrieval augmented generation", RAG). For a handful of pages
you can skip a database entirely.

```python
from pathlib import Path

CHUNK = 1200

def load_notes(folder: str) -> list[str]:
    chunks = []
    for path in sorted(Path(folder).glob("*.md")):
        text = path.read_text(encoding="utf-8")
        for start in range(0, len(text), CHUNK):
            chunks.append(text[start : start + CHUNK])
    return chunks
```

Picking the right chunk by keyword is crude but effective for a five-page
course:

```python
def keyword_search(question: str, chunks: list[str], limit: int = 3) -> list[str]:
    words = {word.lower() for word in question.split() if len(word) > 3}
    scored = []
    for chunk in chunks:
        hits = sum(chunk.lower().count(word) for word in words)
        if hits:
            scored.append((hits, chunk))
    scored.sort(reverse=True)
    return [chunk for _, chunk in scored[:limit]]
```

### Embeddings, when keywords are not enough

Embeddings turn text into vectors; similar meaning gives similar vectors. That
handles "how do I store data?" matching a paragraph about SQLite.

```python
import numpy as np

def cosine(a: np.ndarray, b: np.ndarray) -> float:
    return float(a @ b / (np.linalg.norm(a) * np.linalg.norm(b)))

vectors = [client.embeddings.create(model="text-embedding-3-small", input=c).data[0].embedding
           for c in chunks]
matrix = np.array(vectors)

question_vector = np.array(
    client.embeddings.create(model="text-embedding-3-small", input=question).data[0].embedding
)
scores = matrix @ question_vector / (
    np.linalg.norm(matrix, axis=1) * np.linalg.norm(question_vector)
)
best = chunks[int(np.argmax(scores))]
```

Embeddings cost money too, so cache them in a file or in SQLite — they never
change for a fixed text.

## Safety and honesty

- **It can be confidently wrong.** Tell users the assistant can make mistakes, and never let it write to your database or send email without confirmation.
- **Prompt injection is real.** Text fetched from a website or a file can contain instructions ("ignore previous instructions and …"). Treat retrieved text as data, not as commands.
- **Cost scales with usage.** Cap `max_tokens`, cache answers, and put a rate limit on anything public.
- **Privacy.** Anything you put in the prompt leaves your machine. Do not send student data without a lawful basis and consent.
- **Use the free options.** `scikit-learn` runs locally at zero cost; try it before reaching for an API.

## Checkpoint project: a course assistant

Build a CLI that answers questions about this course:

1. Load the module Markdown from `src/content/docs/advanced/`.
2. Split it into chunks and build an embedding index (or start with keyword search).
3. Given a question, retrieve the top three chunks and ask the model to answer **using only those notes**, with the source file names.
4. If nothing relevant is found, say "I don't know" instead of guessing.
5. Cache question → answer pairs in SQLite so repeated questions cost nothing.
6. Print the sources alongside the answer so the learner can check them.

The "say I don't know" rule is the important one: it is what separates a useful
assistant from a plausible one.

## Exercises

1. Compare `DecisionTreeClassifier(max_depth=1)` with the default. Which one generalises better on iris, and why?
2. Add a confusion matrix (`sklearn.metrics.confusion_matrix`) to the gradebook example.
3. Add `--no-llm` to the assistant so it runs with keyword search only, for zero cost.
4. Ask the assistant something definitely outside the course. Does it admit it does not know?
5. Estimate the cost of answering 1 000 questions a day with your current chunk size.
