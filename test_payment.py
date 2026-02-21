import requests
import os
import hashlib
from urllib.parse import urlparse, parse_qs

BASE_URL = 'http://127.0.0.1:8000/api'
TEST_USER = 'payment_test_user'
TEST_PASS = 'password12345'
ROBOKASSA_PASSWORD_2 = 'test_pass_2_change_me' # From .env
PLAN_ID = 'pro' # 990, 20 checks

def run_test():
    print("1. Registering/Logging in...")
    resp = requests.post(f"{BASE_URL}/auth/register/", json={'username': TEST_USER, 'password': TEST_PASS, 'email': 'pay@example.com'})
    if resp.status_code == 400 and 'already exists' in resp.text:
         resp = requests.post(f"{BASE_URL}/auth/login/", json={'username': TEST_USER, 'password': TEST_PASS})
    
    if resp.status_code not in [200, 201]:
        print(f"Auth failed: {resp.text}")
        return

    token = resp.json().get('token')
    headers = {'Authorization': f'Token {token}', 'Content-Type': 'application/json'}
    
    print("\n2. Checking initial user profile...")
    info_resp = requests.get(f"{BASE_URL}/user/info/", headers=headers)
    print(f"Profile before: {info_resp.json()}")
    initial_checks = info_resp.json().get('profile', {}).get('checks_remaining', 0)

    print(f"\n3. Requesting payment for '{PLAN_ID}' plan...")
    pay_resp = requests.post(f"{BASE_URL}/payment/create/", headers=headers, json={'plan_id': PLAN_ID})
    if pay_resp.status_code != 200:
        print(f"Payment create failed: {pay_resp.text}")
        return
        
    payment_url = pay_resp.json().get('payment_url')
    print(f"Success! Redirect URL: {payment_url}")
    
    # Extract out_sum and inv_id from URL
    parsed_url = urlparse(payment_url)
    params = parse_qs(parsed_url.query)
    
    out_sum = params.get('OutSum', [''])[0]
    inv_id = params.get('InvId', [''])[0]
    
    print(f"\n4. Simulating Robokassa Webhook...")
    print(f"Extracted OutSum: {out_sum}, InvId: {inv_id}")
    
    # Calculate signature for webhook
    # Signature: OutSum:InvId:Password2
    sig_str = f"{out_sum}:{inv_id}:{ROBOKASSA_PASSWORD_2}"
    signature = hashlib.md5(sig_str.encode()).hexdigest()
    
    webhook_data = {
        'OutSum': out_sum,
        'InvId': inv_id,
        'SignatureValue': signature
    }
    
    webhook_resp = requests.post(f"{BASE_URL}/payment/webhook/", data=webhook_data)
    print(f"Webhook response: {webhook_resp.status_code} - {webhook_resp.text}")
    
    if webhook_resp.status_code == 200 and webhook_resp.text == f"OK{inv_id}":
         print("Webhook processed successfully!")
    else:
         print("Webhook failed!")
         return

    print("\n5. Checking updated user profile...")
    info_resp2 = requests.get(f"{BASE_URL}/user/info/", headers=headers)
    print(f"Profile after: {info_resp2.json()}")
    
    final_checks = info_resp2.json().get('profile', {}).get('checks_remaining', 0)
    print(f"\nResult: Added {final_checks - initial_checks} checks!")
    if final_checks > initial_checks:
        print("ALL TESTS PASSED: End-to-end payment flow works perfectly.")

if __name__ == '__main__':
    run_test()
