# Testing Philosophy

## Journeys vs. Low-Level Tests
Journeys describe business outcomes that span multiple pages or flows (e.g., login + view dashboard). They use shared specs to stay readable and portable between TypeScript and Python implementations. Low-level tests verify individual components but are not the focus of this stack.

## Resilience
- Favor accessible selectors (`getByRole`, `getByLabel`) and `data-testid` attributes defined in product code.
- Use generous but bounded timeouts and expect retries where the platform provides them.
- Keep test data explicit and typed so journeys remain deterministic.

## Separation of Concerns
- Specs in `common/specs/` capture intent and stable selectors.
- JS and Python implementations translate specs into executable Playwright journeys.
- MCP servers expose both the executable tools and the spec resources so clients can reason over the same source of truth.
