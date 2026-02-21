import requests
import os

BASE_URL = 'http://127.0.0.1:8000/api'
TEST_USER = 'test_flow_user'
TEST_PASS = 'password12345'
TEST_FILE = 'dummy_contract.txt'

def run_test():
    print("1. Creating dummy contract...")
    with open(TEST_FILE, 'w', encoding='utf-8') as f:
        f.write("Договор оказания услуг. Исполнитель обязуется оказать услуги, а Заказчик оплатить их. Штраф за просрочку: 100% от суммы.")

    print("2. Registering/Logging in...")
    # Try register
    resp = requests.post(f"{BASE_URL}/auth/register/", json={'username': TEST_USER, 'password': TEST_PASS, 'email': 'test@example.com'})
    if resp.status_code == 400 and 'already exists' in resp.text:
        # Try login
        resp = requests.post(f"{BASE_URL}/auth/login/", json={'username': TEST_USER, 'password': TEST_PASS})
    
    if resp.status_code not in [200, 201]:
        print(f"Auth failed: {resp.status_code} - {resp.text}")
        return

    token = resp.json().get('token')
    print(f"Auth successful, token received.")

    print("3. Uploading document for analysis...")
    headers = {'Authorization': f'Token {token}'}
    with open(TEST_FILE, 'rb') as f:
        files = {'file': (TEST_FILE, f, 'text/plain')}
        resp = requests.post(f"{BASE_URL}/analyze/", headers=headers, files=files)
        
    print(f"Upload Response Code: {resp.status_code}")
    print(f"Upload Response Body: {resp.text}")

    if resp.status_code == 201:
        print("SUCCESS! Document was uploaded without 500 error.")
    else:
        print("FAILED! Expected 201 Created.")

    # Cleanup
    if os.path.exists(TEST_FILE):
        os.remove(TEST_FILE)

if __name__ == '__main__':
    run_test()
