from backend.security import Decision


class AgentGuardAuthorizer:
    """Allow only explicitly supported store actions for the authenticated owner."""

    ACTIONS = {
        "assistant.message",
        "cart.read",
        "cart.update",
        "orders.list",
        "orders.read",
        "checkout.simulate",
    }

    def authorize(self, principal, action, resource):
        if action not in self.ACTIONS:
            return Decision(False, "action_not_allowed")
        owner = resource.get("customer_id")
        if owner != principal.customer_id:
            return Decision(False, "ownership_mismatch")
        return Decision(True, "owner_match")
