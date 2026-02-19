
import requests
import os
import docx

# Create a simple DOCX
doc = docx.Document()
doc.add_paragraph("Договор аренды. Арендодатель имеет право расторгнуть договор в одностороннем порядке.")
doc.save("test_contract.docx")

# API Endpoint
url = "http://127.0.0.1:8000/api/analyze/"

# Send POST request
with open("test_contract.docx", "rb") as f:
    files = {"file": f}
    try:
        response = requests.post(url, files=files)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 201:
            data = response.json()
            if "improved_file" in data and data["improved_file"]:
                print(f"Improved file URL: {data['improved_file']}")
                # Try to download
                full_url = "http://127.0.0.1:8000" + data['improved_file']
                print(f"Attempting to download from: {full_url}")
                r_file = requests.get(full_url)
                if r_file.status_code == 200:
                    print("SUCCESS: Improved file downloaded.")
                else:
                    print(f"FAILURE: Could not download file. Status: {r_file.status_code}")
            else:
                print("No improved_file found in response.")
        else:
            print("Error:", response.text)
    except Exception as e:
        print(f"Request failed: {e}")

# Cleanup
if os.path.exists("test_contract.docx"):
    os.remove("test_contract.docx")
