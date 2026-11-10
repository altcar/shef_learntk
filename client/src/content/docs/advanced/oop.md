---
title: Object-oriented Python
description: Classes, instances, inheritance and dataclasses - the step up from standalone functions.
sidebar:
  order: 1
---

:::note[Before you start]
You should be comfortable with functions, parameters, `return`, dictionaries and
scope from **Week 5** of the beginner course, and with modules and files from
**Week 6**. Everything here builds directly on those.
:::

## Why bother with classes?

In Week 5 you learned to group behaviour into functions. That works until you
need to keep several values **and** the operations that act on them together.

```python
# A bank account, held in a dictionary
account = {"owner": "Ada", "balance": 0}

def deposit(account, amount):
    account["balance"] += amount

def withdraw(account, amount):
    if amount > account["balance"]:
        raise ValueError("insufficient funds")
    account["balance"] -= amount
```

Two problems:

1. Nothing stops you passing the wrong dictionary — `deposit({"owner": "Ada"}, 10)` blows up three lines later.
2. The behaviour is not attached to the data. Every new function has to know the exact keys.

A **class** fixes both. It is a blueprint that bundles data with the code that
reads and changes it, and it can reject nonsense at the door.

## A first class

```python
class BankAccount:
    def __init__(self, owner: str, balance: float = 0.0):
        self.owner = owner
        self.balance = balance

    def deposit(self, amount: float) -> None:
        self.balance += amount

    def withdraw(self, amount: float) -> None:
        if amount > self.balance:
            raise ValueError("insufficient funds")
        self.balance -= amount
```

```python
account = BankAccount("Ada", 100)
account.deposit(50)
account.withdraw(30)
print(account.balance)  # 120
```

Four things to notice:

- `class BankAccount:` defines a new type. Capitalise class names by convention.
- `__init__` runs automatically when you call `BankAccount(...)`. It is the constructor, not a "setup function" you call yourself.
- `self` is the instance being worked on. `account.deposit(50)` is Python calling `BankAccount.deposit(account, 50)` for you.
- `self.balance = balance` creates an **attribute**. Attributes are per-instance, like dictionary entries with nicer syntax.

:::tip[`self` is not magic]
It is only a parameter name. `def deposit(account, amount)` inside the class
would work identically, but every Python developer expects `self`, and tools
assume it.
:::

## Same word, different meaning

You already met `dict` and `class` in Week 4. A class is a **type**; an instance
is a **value** of that type.

| Concept | Dictionary (Week 4) | Class (this module) |
| --- | --- | --- |
| Shape of the data | Whatever keys you happen to use | Fixed by `__init__` |
| Validating input | You must check every time | Do it once, in the constructor |
| Attaching behaviour | Free functions taking the dict | Methods on the object |
| Typos | `account["blance"]` fails at runtime | `account.blance` fails immediately |

## Class attributes vs instance attributes

```python
class BankAccount:
    currency = "GBP"          # class attribute: shared by every account

    def __init__(self, owner):
        self.owner = owner    # instance attribute: one per account
        self.history = []

    def deposit(self, amount):
        self.balance = getattr(self, "balance", 0) + amount
        self.history.append(("deposit", amount))
```

Be careful with mutable class attributes. This is a classic bug:

```python
class Bad:
    history = []          # ONE list, shared by every instance

class Good:
    def __init__(self):
        self.history = []  # a fresh list per instance
```

## Printing your objects

By default `print(account)` shows `<__main__.BankAccount object at 0x…>`, which
is useless. `__str__` controls `str()` and `print()`; `__repr__` controls the
developer-facing representation used in lists, tracebacks and the REPL.

```python
class BankAccount:
    # ...
    def __str__(self) -> str:
        return f"{self.owner}: {self.balance:.2f} {self.currency}"

    def __repr__(self) -> str:
        return f"BankAccount(owner={self.owner!r}, balance={self.balance!r})"
```

These are **dunder** methods (double underscore). You rarely call them directly;
Python calls them for you. Others worth knowing:

| Method | Triggered by |
| --- | --- |
| `__len__` | `len(obj)` |
| `__eq__` | `obj_a == obj_b` |
| `__lt__` | `obj_a < obj_b`, and sorting |
| `__iter__` | `for item in obj` |
| `__enter__` / `__exit__` | `with obj:` |

:::note[Back to Week 2]
In Lesson 2 you were told that `is` checks identity and that every value is an
object on the heap. Now it should click: `a == b` calls `__eq__` (value
comparison), while `a is b` asks whether both names point at the *same* object.
For `None` always use `is None`.
:::

## Validating with properties

Plain attributes can be set to anything. `@property` lets you run code on read
or write while keeping the nice `account.balance` syntax.

```python
class BankAccount:
    def __init__(self, owner, balance=0.0):
        self.owner = owner
        self.balance = balance          # goes through the setter below

    @property
    def balance(self):
        return self._balance

    @balance.setter
    def balance(self, value):
        if value < 0:
            raise ValueError("balance cannot be negative")
        self._balance = float(value)
```

`_balance` is a convention: "internal, do not touch from outside".

## Inheritance

Inheritance lets a class reuse and specialise another.

```python
class SavingsAccount(BankAccount):
    def __init__(self, owner, balance=0.0, rate=0.03):
        super().__init__(owner, balance)   # run the parent constructor
        self.rate = rate

    def add_interest(self):
        self.deposit(self.balance * self.rate)
```

- `super().__init__(...)` calls the parent's constructor. If you forget it, `self.owner` never gets set.
- Override a method by defining it again in the subclass and calling `super().method()` when you still want the parent behaviour.
- `isinstance(savings, BankAccount)` is `True` — a savings account **is a** bank account.

:::caution[Favour composition]
Deep inheritance trees ("a `SavingsAccount` is a `BankAccount` is an `Account`
is a `Ledger` is …") become fragile fast. If one object merely *uses* another,
hold it as an attribute instead of inheriting.
:::

```python
class Statement:                 # composition: a statement has accounts
    def __init__(self, accounts):
        self.accounts = accounts

    def total(self):
        return sum(account.balance for account in self.accounts)
```

## Dataclasses

For classes that mostly hold data, `@dataclass` writes `__init__`, `__repr__`
and `__eq__` for you.

```python
from dataclasses import dataclass, field

@dataclass
class Book:
    title: str
    author: str
    tags: list[str] = field(default_factory=list)
    borrowed_by: str | None = None
```

```python
book = Book("Dune", "Herbert")
print(book)          # Book(title='Dune', author='Herbert', tags=[], borrowed_by=None)
```

Use `field(default_factory=list)` rather than `= []`, for the same reason as the
shared-list bug above.

## Checkpoint project: a small library

Build `library.py` with:

1. A `Book` dataclass: `title`, `author`, `isbn`, `borrowed_by` (default `None`).
2. A `Library` class holding a list of books.
   - `add(book)` — reject duplicate ISBNs with `ValueError`.
   - `borrow(isbn, member)` — raise `ValueError` if already borrowed or unknown.
   - `return_book(isbn)` — clear `borrowed_by`, raise if the ISBN is unknown.
   - `available()` — return the unborrowed books.
   - `__len__` and `__str__` so `len(library)` and `print(library)` are useful.
3. A `ReferenceBook(Book)` subclass whose `borrow` always raises — reference
   copies stay in the building.

Aim for a `main()` guarded by:

```python
if __name__ == "__main__":
    # manual smoke test
    ...
```

That guard, and the file layout, matter more than you think — you will reuse
both in **Building an app**.

## Exercises

1. Add `__eq__` to `Book` that compares ISBNs only. What happens to `==` if you
   forget `__hash__` and put books in a `set`?
2. Give `BankAccount` a `history` list and a `statement()` method returning a
   multi-line string. Print it with `print()`.
3. Write a `Matrix` class supporting `__add__` and `__mul__` for 2×2 matrices.
   Check the maths by hand.
4. Refactor one of your beginner projects (the number guesser or the dice
   tally) into a class. What state moved from local variables into attributes?
