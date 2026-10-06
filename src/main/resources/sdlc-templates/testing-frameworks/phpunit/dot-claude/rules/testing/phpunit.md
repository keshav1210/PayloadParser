---
paths:
  - "tests/**/*.php"
  - "**/phpunit.xml*"
---

# PHPUnit

- **Run**: `vendor/bin/phpunit`, one test with `--filter testRejectsExpiredToken`, one file
  `vendor/bin/phpunit tests/Unit/OrderTest.php`, a group with `--group smoke`. In Laravel, `php artisan test`
  wraps PHPUnit (or Pest, if the project uses it).
- **Files**: `tests/Unit` and `tests/Feature` (or as configured in `phpunit.xml`), classes `*Test` extending
  `PHPUnit\Framework\TestCase`.
- **Test methods**: names starting with `test`, or the `#[Test]` attribute (PHPUnit 10+). Use attributes
  (`#[DataProvider('cases')]`, `#[Group('smoke')]`) on PHPUnit 10+, docblock annotations on older versions;
  check the version in `composer.json`.
- **Setup**: `setUp()`/`tearDown()` (call the parent); data providers are `public static` methods on PHPUnit 10+.
- **Assertions**: `assertSame` (strict) over `assertEquals` unless loose comparison is intended;
  `expectException()` before the call that throws.
- **Mocks**: `createMock()` / `createStub()`; mock only collaborators, not the class under test.
