---
paths:
  - "spec/**"
  - "**/*_spec.rb"
  - "**/.rspec"
---

# RSpec

- **Run**: `bundle exec rspec spec/models/order_spec.rb:42` (one example by line), by tag with
  `--tag smoke`, show failures only with `--format progress`.
- **Files**: `spec/` mirroring `app/` or `lib/`, named `*_spec.rb`; shared setup in `spec/spec_helper.rb`
  and `spec/rails_helper.rb` (Rails), support files in `spec/support/`.
- **Structure**: `describe` the class or method, `context` for "when …" situations, `it` for one behaviour.
  Include the test case ID in the description or as metadata (`it "…", tc: "TC-US-012-03"`).
- **Setup**: `let` (lazy) and `let!` (eager) for data; `before` for actions. Use FactoryBot factories if the
  project has them, not fixtures written by hand.
- **Expectations**: `expect(actual).to eq(expected)`, `raise_error(Klass)`, `change { … }.by(1)`.
- **Doubles**: `instance_double(Klass)` (verifies the interface) over plain `double`; avoid
  `allow_any_instance_of`.
- **Rails**: request specs for APIs and controllers, system specs (Capybara) for UI flows.
