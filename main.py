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
    DISCORD_FILTER_CONFIG,
    ASETU_DISTRICTS,
    DISCORD_DIST_WEBHOOKS,
    DISCORD_PIN_WEBHOOKS,
    DISTRICTS,
    TIMEOUT,
)

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


# For creating filter functions
def filterFactory(startsWithFilter):
    def x(s):
        p = str(s["pincode"])
        f = str(startsWithFilter)
        return p.startswith(f)

    return x


def filterByPincode(district, data):
    # We assume that the `enabled` condition is checked outside
    # Another assumption (guarantee) is that data is never empty
    filters = DISTRICTS[district]["filters"]["pincode"]
    exactFilter = lambda s: (s["pincode"] in filters["exact"])
    startsWithFilters = [filterFactory(f) for f in filters["starts_with"]]

    exactSessions = list(filter(exactFilter, data))

    startsWithSessions = []
    for f in startsWithFilters:
        sess = list(filter(f, data))
        startsWithSessions.append(sess)

    # Merge and deduplicate
    merged = exactSessions + startsWithSessions
    dedupedList = []
    for m in merged:
        if m not in dedupedList:
            dedupedList.append(m)
    return dedupedList


def findCentersForDistrict(district, district_id):
    allData = getCalendarByDistrict(district_id)
    if allData is None:
        # We had an issue... try again next time
        return None, None
    filteredData = filterCenters(allData)
    # We send the filtered data to the pincode filter
    if len(filteredData) > 0 and DISCORD_FILTER_CONFIG[district]["pincode"]:
        filteredDataByPincode = filterByPincode(district, filteredData)
        return (filteredData, filteredDataByPincode)
    return filteredData, None


if __name__ == "__main__":
    while True:
        # Loop forever
        print(f"---- Trying at: {datetime.now()} ----")
        for district, districtId in ASETU_DISTRICTS.items():
            sleep(0.2)
            print(f"[+] Finding centers for district: {district}")
            try:
                filteredData, filteredPincodeData = findCentersForDistrict(
                    district, districtId
                )
                if filteredData is not None:
                    sendAlert(filteredData, district, DISCORD_DIST_WEBHOOKS[district])
                if filteredPincodeData is not None:
                    sendAlert(
                        filteredPincodeData, district, DISCORD_PIN_WEBHOOKS[district]
                    )
            except Exception as e:
                print("[!] Something went wrong in the outer loop.")
                sendError(e)
            # We sleep for some time
        sleep(TIMEOUT)
