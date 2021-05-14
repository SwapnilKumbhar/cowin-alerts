import requests
from datetime import datetime
from pprint import pprint  # Only for debugging
from time import sleep
import traceback
from yaml import safe_load
from pytz import timezone

from alerts.discord import sendAlert
from alerts.discord import sendError
from config import (
    AUTH_TOKEN,
    ASETU_PRODUCTION_SERVER,
    ASETU_CALENDAR_BY_DISTRICT,
    ASETU_DISTRICTS,
    DISCORD_DIST_WEBHOOKS,
    DISTRICTS,
    TIMEOUT,
)
from database.sqlite import getRolesForPincodes

# helper
def currentDate():
    return datetime.now(timezone("Asia/Kolkata")).strftime("%d-%m-%Y")


def getCalendarByDistrict(district_id):
    headers = {
        "authorization": f"Bearer {AUTH_TOKEN}",
        "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36",
    }
    url = f"{ASETU_PRODUCTION_SERVER}{ASETU_CALENDAR_BY_DISTRICT}"
    date = currentDate()
    parameters = {"district_id": district_id, "date": date}
    try:
        r = requests.get(url, headers=headers, params=parameters)
        # Return well formed dictionary
        return r.json()
    except Exception as e:
        # Alert Swapnil/Pooja that code broke!
        print("[!] SOMETHING BROKE!")
        print(f"[!] URL: {r.url}")
        print(f"[!] RECEIVED RESPONSE: {r.text}")
        traceback.print_exc()
        return None


def filterCenters(data):
    sessionFilter = lambda s: (s["min_age_limit"] == 18 and s["available_capacity"] > 0)
    filteredCenters = []
    for center in data["centers"]:
        sessions = list(filter(sessionFilter, center["sessions"]))
        if len(sessions) > 0:
            # We have sessions that meet our criteria
            # Copy all keys except sessions and append our filtered sessions
            # to it
            newCenter = {k: v for k, v in center.items() if k not in {"sessions"}}
            newCenter["sessions"] = sessions
            filteredCenters.append(newCenter)

    return filteredCenters


# 1. Get a distinct list of pincodes from the data
# 2. Get roles for all those pincodes from the database
def findRolesForPincodes(data):
    pincodes = list(set(map(lambda d: d["pincode"], data)))
    roles = getRolesForPincodes(pincodes)
    if len(roles) == 0:
        # Noone subscribed to pincodes of this district
        return None
    return roles


def findCentersForDistrict(district, district_id):
    allData = getCalendarByDistrict(district_id)
    if allData is None:
        # We had an issue... try again next time
        return None, None
    filteredData = filterCenters(allData)
    # We send the filtered data to the pincode filter
    if len(filteredData) > 0:
        return filteredData, findRolesForPincodes(filteredData)
    else:
        return None, None


if __name__ == "__main__":
    while True:
        # Loop forever
        print(f"---- Trying at: {datetime.now(timezone('Asia/Kolkata'))} ----")
        for district, districtId in ASETU_DISTRICTS.items():
            sleep(0.1)
            print(f"[+] Finding centers for district: {district}")
            try:
                filteredData, roles = findCentersForDistrict(district, districtId)
                if filteredData is not None:
                    sendAlert(
                        filteredData, district, DISCORD_DIST_WEBHOOKS[district], roles
                    )
            except Exception as e:
                print("[!] Something went wrong in the outer loop.")
                sendError(e)
            # We sleep for some time
        sleep(TIMEOUT)
