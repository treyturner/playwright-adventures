# Testing Philosophy

## Journeys vs. Low-Level Tests
Journeys describe business outcomes that span multiple pages or flows (e.g., login + view dashboard). They use shared specs to stay readable and portable between TypeScript and Python implementations. Low-level tests verify individual components but are not the focus of this stack.

## Resilience
- Favor accessible selectors (`getByRole`, `getByLabel`) and `data-testid` attributes defined in product code.
- Use generous but bounded timeouts and expect retries where the platform provides them.
- Keep test data explicit and typed so journeys remain deterministic.

## Separation of Concerns
- `common/specs/journeys.yaml` captures executable intent, composition, and stable selectors.
- Generated JS and Python adapters keep both implementations and their MCP journey IDs synchronized with the YAML; hand-written runners translate the shared action vocabulary into Playwright calls.
- MCP servers expose both the executable tools and the spec resources so clients can reason over the same source of truth.
