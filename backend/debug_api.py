import urllib.request
import json
import urllib.error

def debug_api():
    # 1. Register/Login
    url = "http://127.0.0.1:8000/api/auth/register/"
    data = json.dumps({"email": "debug@example.com", "password": "password123", "username": "debuguser"}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    
    token = None
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode())
            token = res_data.get('token')
            print(f"Registered. Token: {token}")
    except urllib.error.HTTPError as e:
        if e.code == 400: # Probably already exists
             print("User probably exists, trying login...")
             url = "http://127.0.0.1:8000/api/auth/login/"
             req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
             with urllib.request.urlopen(req) as response:
                res_data = json.loads(response.read().decode())
                token = res_data.get('token')
                print(f"Logged in. Token: {token}")
        else:
            print(f"Error registering: {e}")
            return

    if not token:
        print("Failed to get token")
        return

    # 2. Fetch Documents
    url = "http://127.0.0.1:8000/api/documents/"
    req = urllib.request.Request(url, headers={"Authorization": f"Token {token}"})
    try:
        with urllib.request.urlopen(req) as response:
            print(f"Documents Status: {response.status}")
            data = json.loads(response.read().decode())
            print("Documents Response Type:", type(data))
            print("Documents Response:", json.dumps(data, indent=2))
    except urllib.error.HTTPError as e:
        print(f"Error fetching documents: {e}")
        print(e.read().decode())

if __name__ == "__main__":
    debug_api()
