import json
import os
import unittest
from decimal import Decimal
from unittest.mock import Mock, patch

from backend.soc_cloud import handle


class HostedReportingTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"PUBLIC_ORIGIN": "https://store.example", "COGNITO_POOL_ID": "pool", "COGNITO_SOC_CLIENT_ID": "client"})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.cognito = Mock()
        self.cognito.initiate_auth.return_value = {"AuthenticationResult": {"AccessToken": "private-token"}}
        self.cognito.get_user.return_value = {"Username": "soc-operator"}
        self.cognito.admin_list_groups_for_user.return_value = {"Groups": [{"GroupName": "agentguard-soc-operators"}]}
        self.table = Mock()
        self.table.query.return_value = {"Items": [{"value": {"schema_version": Decimal(1), "action": "orders.read"}}]}

    def request(self, method, path, cookie=None, body=None, query="", origin=None):
        event = {"version": "2.0", "rawPath": path, "rawQueryString": query,
                 "requestContext": {"http": {"method": method}}, "headers": {}}
        if cookie:
            event["cookies"] = [cookie]
        if body is not None:
            event["body"] = json.dumps(body)
        if origin:
            event["headers"]["origin"] = origin
        return handle(event, self.cognito, self.table)

    def test_operator_cookie_is_required_before_any_audit_query(self):
        self.assertEqual(self.request("GET", "/soc-api/events")["statusCode"], 401)
        self.cognito.get_user.return_value = {"Username": "alice"}
        self.assertEqual(self.request("GET", "/soc-api/events", cookie="soc_session=shopper-token")["statusCode"], 401)
        self.cognito.get_user.return_value = {"Username": "soc-operator"}
        self.cognito.admin_list_groups_for_user.return_value = {"Groups": []}
        self.assertEqual(self.request("GET", "/soc-api/events", cookie="soc_session=operator-token")["statusCode"], 401)
        self.table.query.assert_not_called()

    def test_sign_in_requires_origin_credentials_and_operator_group(self):
        self.assertEqual(self.request("POST", "/soc-api/session", body={"password": "x" * 16}, origin="https://attacker.example")["statusCode"], 403)
        self.assertEqual(self.request("POST", "/soc-api/session", body={"password": "x" * 16}, origin="https://store.example")["statusCode"], 200)
        response = self.request("POST", "/soc-api/session", body={"password": "x" * 16}, origin="https://store.example")
        self.assertIn("HttpOnly; Secure; SameSite=Strict", response["cookies"][0])
        self.assertNotIn("private-token", response["body"])
        self.cognito.admin_list_groups_for_user.assert_called_with(UserPoolId="pool", Username="soc-operator")

    def test_recent_feed_uses_bounded_index_query_and_never_returns_keys(self):
        response = self.request("GET", "/soc-api/events", cookie="soc_session=private-token", query="limit=25")
        self.assertEqual(response["statusCode"], 200)
        payload = json.loads(response["body"])
        self.assertEqual(payload["source"], "cloud-dynamodb")
        self.assertEqual(payload["events"], [{"schema_version": 1, "action": "orders.read"}])
        args = self.table.query.call_args.kwargs
        self.assertEqual(args["IndexName"], "by_time")
        self.assertEqual(args["Limit"], 25)
        self.assertFalse(args["ScanIndexForward"])
        self.assertNotIn("TableName", args)
        self.table.scan.assert_not_called()
        self.assertEqual(self.request("GET", "/soc-api/events", cookie="soc_session=private-token", query="limit=501")["statusCode"], 400)
        self.assertEqual(self.request("GET", "/soc-api/events", cookie="soc_session=private-token", query="cursor=bad!")["statusCode"], 400)
        self.assertEqual(self.request("POST", "/soc-api/events", cookie="soc_session=private-token")["statusCode"], 405)


if __name__ == "__main__":
    unittest.main()
