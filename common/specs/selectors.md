# Selector Policy

Shared guidance for building resilient selectors across the JS and Python stacks.

## Prefer
- `getByRole` with accessible name or level for headings.
- `getByLabel` / `getByPlaceholder` for form controls with proper labels.
- `getByTestId` using `data-testid` or `data-qa` attributes for stable anchors.
- Explicit `aria-*` attributes when semantics are unclear and accessibility allows.

## Avoid
- Brittle CSS class chains that encode layout concerns.
- Positional selectors such as `nth-child` or deep descendant chains.
- Text selectors that are likely to change with localization or marketing copy.

## Notes
- Prefer interactions that wait for visibility and stability (e.g., `getByRole('button', { name: /submit/i })`).
- When adding new selectors, update fixtures or test data so both JS and Python flows remain aligned.
