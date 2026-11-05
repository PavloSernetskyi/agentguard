"""Send the ignored local Groq key to the existing AWS secret without printing it."""
from pathlib import Path

import boto3


ROOT = Path(__file__).resolve().parents[1]
ACCOUNT = "783582650755"
REGION = "us-east-2"
SECRET_NAME = "demomart-demo/groq-api-key"


def local_key():
    path = ROOT / ".env.local"
    if not path.is_file():
        raise SystemExit("Missing ignored .env.local file")
    values = []
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        key, separator, value = line.strip().partition("=")
        if separator and key.strip() == "GROQ_API_KEY":
            value = value.strip().strip("\"'")
            if value:
                values.append(value)
    if len(values) != 1:
        raise SystemExit("Set exactly one nonempty GROQ_API_KEY in .env.local")
    return values[0]


def main():
    session = boto3.Session(profile_name="agentguard", region_name=REGION)
    if session.client("sts").get_caller_identity()["Account"] != ACCOUNT:
        raise SystemExit("AWS account does not match the AgentGuard project")
    client = session.client("secretsmanager")
    client.describe_secret(SecretId=SECRET_NAME)
    client.put_secret_value(SecretId=SECRET_NAME, SecretString=local_key())
    print("Groq secret version is ready in the expected AWS account and region")


if __name__ == "__main__":
    main()
