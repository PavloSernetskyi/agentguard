from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class Principal:
    customer_id: str


@dataclass(frozen=True)
class Decision:
    allowed: bool
    reason: str


class Authorizer(Protocol):
    def authorize(self, principal: Principal, action: str, resource: dict) -> Decision: ...


class OwnershipAuthorizer:
    def authorize(self, principal, action, resource):
        owner = resource.get("customer_id")
        return Decision(owner == principal.customer_id, "owner_match" if owner == principal.customer_id else "ownership_mismatch")
