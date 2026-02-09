import json
import requests


def main():
    url = "http://localhost:8000/api/v1/generate"

    payload = {
        "process_name": "Simple login",
        "domain": "Demo",
        "actors": ["User", "System"],
        "actions": [
            {"actor": "User", "action": "Open login page"},
            {"actor": "User", "action": "Enter email and password"},
            {"actor": "User", "action": "Submit login form"},
            {"actor": "System", "action": "Verify credentials"},
        ],
        "decisions": [
            {
                "condition": "Credentials valid?",
                "branch_yes": "Show main dashboard",
                "branch_no": "Show error message",
            }
        ],
    }

    print(f"Calling {url} ...")
    resp = requests.post(url, json=payload)
    print(f"Status code: {resp.status_code}")

    if resp.status_code != 200:
        print("Error response:")
        print(resp.text)
        return

    data = resp.json()
    plantuml_code = data["plantuml_code"]

    print("\n===== RAW JSON (for reference) =====")
    print(json.dumps({"plantuml_code": plantuml_code}, indent=2))

    print("\n===== PRINTED PLANTUML CODE =====")
    print(plantuml_code)


if __name__ == "__main__":
    main()
