---
paths:
  - "**/*.jsx"
  - "**/*.tsx"
  - "**/src/components/**"
  - "**/src/hooks/**"
---

# React practices

Follow these unless the project already does it differently; existing patterns win.

## Components

- Function components and hooks. Keep components small; extract a component when part of the JSX has its own
  state or is reused.
- Follow the Rules of Hooks: call hooks only at the top level of components and custom hooks, never inside
  conditions or loops. Name custom hooks `useSomething`.
- Type props (TypeScript interfaces or the project's PropTypes). Don't spread unknown props onto DOM elements.
- Lists need stable `key`s from the data (an ID), not the array index when items can move.

## State and effects

- Keep state as close as possible to where it's used; lift it only when siblings need it. Don't store values
  you can calculate from props or other state; calculate them during render.
- Use effects only to sync with something outside React (subscriptions, timers, the DOM, non-React widgets).
  Don't use an effect to transform data for rendering or to respond to a user event; do that in the event
  handler. Clean up subscriptions and timers in the effect's return function.
- Fetch data with the library the project already uses (React Query, SWR, RTK Query, framework loaders)
  instead of writing new fetch-in-effect code.
- Add `useMemo`, `useCallback` or `memo` only for a measured performance problem or a library that needs
  stable references.

## UI quality

- Accessible by default: real `<button>` and `<a>` elements, labels for every form field, `alt` text for
  meaningful images, visible focus, keyboard support for custom widgets.
- Handle loading, empty and error states for every data-driven view.
- Never render user-provided HTML with `dangerouslySetInnerHTML` unless it's sanitised (e.g. DOMPurify).

## Tests

React Testing Library: render the component, find elements by role and label, interact with `user-event`,
and assert what the user sees. Don't test internal state or implementation details.
