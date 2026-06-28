import time
from datetime import datetime
import requests

# Put your public Vercel endpoint here
VERCEL_API_URL = "https://longdo-a5os7rmhk-terdsakr-5718s-projects.vercel.app/api/api"


def trigger_sync():

    now = datetime.now()
    current_time_str = now.strftime("%H:%M:%S")
    current_hour = now.hour

    # TIME CHECK: Only run between 6:00 AM (6) and 9:00 PM (21)
    if current_hour < 6 or current_hour >= 21:
        print(f"[{current_time_str}] Outside active window (6 AM - 9 PM). Sleep mode.")
        return

    print(f"[{current_time_str}] Within active window. Triggering Vercel tracker...")

    try:
        # A simple request with no headers or secrets required
        response = requests.get(VERCEL_API_URL)
        data = response.json()

        if response.status_code == 200:
            print(f" -> Response: {data.get('message', 'Success!')}")
        else:
            print(f" -> Server returned error status {response.status_code}")

    except Exception as e:
        print(f" -> Connection failed: {e}")


if __name__ == "__main__":
    print("Local Python scheduler started. Pinging Vercel every 30 minutes.\n")

    while True:
        trigger_sync()
        time.sleep(30 * 60)  # Sleep for 30 minutes
