---
name: accessibility-check
description: Check pages or UI components against WCAG 2.2 level AA (labels, keyboard use, focus, contrast, alt text, headings, form errors, ARIA, reflow, target size) and report issues by success criterion with fixes. Use when asked about accessibility, a11y, WCAG, screen readers or keyboard support.
argument-hint: "<page, component, folder, or 'changes'>"
---

# Accessibility check

Target: $ARGUMENTS (if `changes` or empty: UI files changed on the current branch).

Report first; fix only when the user asks.

## 1. Use tools if the project has them

If the project already has axe-core (e.g. `@axe-core/playwright`, `jest-axe`, `cypress-axe`), pa11y or
Lighthouse set up, run them on the target and include the results. Automated tools find only part of the
problems, so always review the code as well.

## 2. Review the code against WCAG 2.2 AA

| Check | Success criterion |
|---|---|
| Images and icons have text alternatives; decorative ones are hidden from screen readers | 1.1.1 |
| Structure is in the markup: headings in order, lists, tables with headers, landmarks | 1.3.1 |
| Text contrast at least 4.5:1 (3:1 for large text); UI parts and focus indicators at least 3:1 | 1.4.3, 1.4.11 |
| Content works at 320 px wide and 200% zoom without horizontal scrolling | 1.4.10 |
| Everything works with the keyboard alone, with no traps | 2.1.1, 2.1.2 |
| Focus order is logical and focus is always visible | 2.4.3, 2.4.7 |
| Pages have meaningful titles; links make sense from their text | 2.4.2, 2.4.4 |
| Click and tap targets are at least 24 × 24 CSS pixels (or well spaced) | 2.5.8 |
| The page language is set | 3.1.1 |
| Form fields have labels; errors are identified in text and explain how to fix them | 3.3.1, 3.3.2, 3.3.3 |
| Custom controls expose name, role and state (prefer native elements over ARIA) | 4.1.2 |
| Status messages are announced without moving focus | 4.1.3 |

Work out contrast from the colours in the CSS or theme tokens when you can; otherwise mark it "check in the
browser".

## 3. Report

Per issue: criterion · severity (Blocker for keyboard traps, missing labels and missing alternatives on
essential content; otherwise Major or Minor) · `file:line` · who it affects (screen reader, keyboard, low
vision…) · the fix, with a code snippet. End with what to test manually: keyboard-only, a screen reader
(NVDA, VoiceOver), 200% zoom.
