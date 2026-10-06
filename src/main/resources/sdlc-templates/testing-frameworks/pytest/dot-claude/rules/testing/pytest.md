---
paths:
  - "**/test_*.py"
  - "**/*_test.py"
  - "**/conftest.py"
  - "**/pytest.ini"
  - "**/pyproject.toml"
---

# pytest

- **Run**: `pytest tests/test_orders.py::TestOrders::test_rejects_expired -x` (`-x` stops at the first
  failure), select by name with `-k "expired and not slow"`, by marker with `-m smoke`; `-q` for short output.
- **Files**: `test_*.py` or `*_test.py`, functions `test_*`, classes `Test*` without `__init__`.
- **Fixtures**: shared setup in `conftest.py`; choose the narrowest scope that works (`function` by default);
  use `yield` fixtures for cleanup. Built-ins: `tmp_path`, `monkeypatch`, `capsys`, `caplog`.
- **Data-driven**: `@pytest.mark.parametrize("value, expected", [...], ids=[...])`.
- **Assertions**: plain `assert actual == expected`; `pytest.raises(ValueError, match="…")` for errors;
  `pytest.approx` for floats.
- **Markers**: register custom markers (`smoke`, `slow`, test case IDs) in `pytest.ini` or `pyproject.toml`,
  to avoid unknown-marker warnings.
- **Mocks**: `monkeypatch` or `unittest.mock` / `pytest-mock`'s `mocker`, as the project already does.
  Patch where the name is looked up, not where it's defined.
