"""Identity providers: local fixtures or server-validated Cognito identity."""
import secrets
from typing import Protocol


class AuthenticationUnavailable(Exception):
    pass


class Authenticator(Protocol):
    mode: str
    def authenticate(self, account: str, password: str) -> str | None: ...


class LocalDemoAuthenticator:
    mode = "local-demo"

    def authenticate(self, account, password):
        if account in ("alice", "bob") and secrets.compare_digest(password, account + "-demo"):
            return account
        return None


class CognitoAuthenticator:
    mode = "cognito"

    def __init__(self, client, client_id, storage):
        self.client, self.client_id, self.storage = client, client_id, storage

    def authenticate(self, account, password):
        try:
            response = self.client.initiate_auth(
                ClientId=self.client_id, AuthFlow="USER_PASSWORD_AUTH",
                AuthParameters={"USERNAME": account, "PASSWORD": password},
            )
            auth = response.get("AuthenticationResult", {})
            if not auth.get("AccessToken"):
                # New-password/MFA challenges are not silently treated as success.
                return None
            user = self.client.get_user(AccessToken=auth["AccessToken"])
        except Exception as error:
            code = getattr(error, "response", {}).get("Error", {}).get("Code", "")
            if code in {"NotAuthorizedException", "UserNotFoundException", "UserNotConfirmedException", "PasswordResetRequiredException"}:
                return None
            raise AuthenticationUnavailable() from error
        subject = next((a["Value"] for a in user.get("UserAttributes", []) if a["Name"] == "sub"), None)
        # Mapping is provisioned by an administrator, never by a request or model.
        identity = self.storage.get("identities", subject) if subject else None
        if not identity or not self.storage.get("customers", identity["customer_id"]):
            return None
        return identity["customer_id"]
