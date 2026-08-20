from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from mcp.server.context import CallNext, HandlerResult, ServerRequestContext
from mcp.shared.exceptions import MCPError
from mcp.types import INVALID_PARAMS


class RejectUnknownToolArguments:
    """Reject undeclared tool arguments before the SDK discards them."""

    def __init__(self, allowed_arguments: Mapping[str, frozenset[str]]) -> None:
        self._allowed_arguments = allowed_arguments

    async def __call__(
        self,
        ctx: ServerRequestContext[Any, Any],
        call_next: CallNext,
    ) -> HandlerResult:
        if ctx.method != "tools/call" or ctx.params is None:
            return await call_next(ctx)

        tool_name = ctx.params.get("name")
        arguments = ctx.params.get("arguments")
        allowed = self._allowed_arguments.get(tool_name) if isinstance(tool_name, str) else None
        if allowed is None or not isinstance(arguments, Mapping):
            return await call_next(ctx)

        unknown = sorted(str(name) for name in arguments if name not in allowed)
        if unknown:
            joined = ", ".join(unknown)
            raise MCPError(INVALID_PARAMS, f"Unknown argument(s) for {tool_name}: {joined}")

        return await call_next(ctx)
