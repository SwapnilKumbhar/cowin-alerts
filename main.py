import requests
from datetime import datetime
from pprint import pprint  # Only for debugging
from time import sleep
import traceback
from yaml import safe_load

#### Load configs. This **cannot** fail.
#### TODO: Add schema validation
try:
    CONFIG = safe_load(open("config.yaml", "r"))
except Exception as e:
    print(e)
    exit()  # Please get your config in shape

CORE = CONFIG["core"]
DISTRICTS = CONFIG["districts"]

###############################################################################
##### API Setu configurations
###############################################################################
# Authentication constants
# Timeout
TIMEOUT = CORE["timeout"]
AUTH_TOKEN = CORE["auth_token"]
# API Endpoits
ASETU_PRODUCTION_SERVER = CORE["api"]["base"]

ASETU_CALENDAR_BY_DISTRICT = CORE["api"]["endpoints"]["calendarByDistrict"]

# State, District code, etc. constants
# Time to comprehend some lists...
ASETU_DISTRICTS = {k: v["id"] for k, v in DISTRICTS.items()}

###############################################################################
#### Discord configurations
###############################################################################

# We can have empty values here.
DISCORD_DIST_WEBHOOKS = {
    k: v["discord"]["webhooks"]["district"] for k, v in DISTRICTS.items()
}
DISCORD_PIN_WEBHOOKS = {
    k: v["discord"]["webhooks"]["pincode"] for k, v in DISTRICTS.items()
}

# This determines what channels to notify
# Format: {'mumbai': {'district': True, 'pincode': True}}
DISCORD_FILTER_CONFIG = {
    k: {
        "district": v["filters"]["district"],
        "pincode": v["filters"]["pincode"]["enabled"],
    }
    for k, v in DISTRICTS.items()
}

DISCORD_ROLES = {k: v["discord"]["role_id"] for k, v in DISTRICTS.items()}

# Less than total 10 slots in a day
RED_ALERT = "7798804"

# Total 10-40 slots in a day
AMBER_ALERT = "16760576"

# More than total 40 slots in a day
GREEN_ALERT = "3066993"

# helper
def currentDate():
    return datetime.today().strftime("%d-%m-%Y")


def getCalendarByDistrict(district_id):
    headers = {
        "authorization": f"Bearer {AUTH_TOKEN}",
    }
    url = f"{ASETU_PRODUCTION_SERVER}{ASETU_CALENDAR_BY_DISTRICT}"
    date = currentDate()
    parameters = {"district_id": district_id, "date": date}
    try:
        r = requests.get(url, headers=headers, params=parameters)
        # Return well formed dictionary
        if len(r.json()) == 0:
            return None
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


def alertDiscord(centers, district, hook):
    sessions = {}
    sessionSlots = {}
    mention = DISCORD_ROLES[district]

    for center in centers:
        for session in center["sessions"]:

            centerName = center["name"]
            availableCapacity = session["available_capacity"]
            pincode = center["pincode"]
            minAge = session["min_age_limit"]
            feeType = center["fee_type"]
            currentDescription = ""
            currentSlots = 0

            if session["date"] in sessions.keys():
                currentDescription = sessions[session["date"]]
                currentSlots = sessionSlots[session["date"]]

            currentDescription = f"""{currentDescription}Hospital Name: **{centerName}**,
            Slots: **{availableCapacity}**,
            Pincode: **{pincode}**,
            Min age: **{minAge}**,
            Fee type: **{feeType}**
            ------------------------------------------------
            """
            currentSlots = currentSlots + availableCapacity

            sessions[session["date"]] = currentDescription
            sessionSlots[session["date"]] = currentSlots

    for date, session in sessions.items():
        print(f"Sending alerts for date {date}...")

        totalSlots = sessionSlots[date]
        if totalSlots < 10:
            currentColor = RED_ALERT
        elif 10 <= totalSlots < 40:
            currentColor = AMBER_ALERT
        else:
            currentColor = GREEN_ALERT

        requests.post(
            hook,
            json={
                "content": f"{mention}",
                "embeds": [
                    {
                        "title": f"Total slots: {totalSlots} for {date}",
                        "description": session,
                        "color": currentColor,
                    }
                ],
            },
        )


if __name__ == "__main__":
    while True:
        # Loop forever
        print(f"---- Trying at: {datetime.now()} ----")
        try:
            for district, districtId in ASETU_DISTRICTS.items():
                print(f"[+] Finding centers for district: {district}")
                filteredData, filteredPincodeData = findCentersForDistrict(
                    district, districtId
                )
                if filteredData is not None:
                    alertDiscord(
                        filteredData, district, DISCORD_DIST_WEBHOOKS[district]
                    )
                if filteredPincodeData is not None:
                    alertDiscord(
                        filteredPincodeData, district, DISCORD_PIN_WEBHOOKS[district]
                    )
        except Exception as e:
            print(f"Something broke in the outer loop: {e}")
            traceback.print_exc()

        # We sleep for some time
        sleep(TIMEOUT)
