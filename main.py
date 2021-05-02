import requests
from datetime import datetime
from pprint import pprint  # Only for debugging
from time import sleep

# Authentication constants
# Timeout
TIMEOUT = 180
AUTH_TOKEN = ""  # Add your token here

# State, District code, etc. constants
ASETU_DISTRICTS = {"mumbai": 395}

# Webhook URLs per district
WEBHOOKS = {"mumbai":""}

# API Endpoits
ASETU_PRODUCTION_SERVER = "https://cdn-api.co-vin.in/api"  # This may change anytime

ASETU_CALENDAR_BY_DISTRICT = "/v2/appointment/sessions/calendarByDistrict"
ASETU_CALENDAR_BY_PINCODE = "/v2/appointment/sessions/calendarByPincode"

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
        return r.json()
    except Exception as e:
        # Alert Swapnil/Pooja that code broke!
        print(e)
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


def findCentersForDistrict(district_id):
    allData = getCalendarByDistrict(district_id)
    if allData is None:
        # We had an issue... try again next time
        return None
    filteredData = filterCenters(allData)
    return filteredData

def alertDiscord(centers, district):
    sessions = {}
    sessionSlots = {}

    for center in centers:
        for session in center["sessions"]:

            centerName = center["name"]
            availableCapacity = session["available_capacity"]
            pincode = center["pincode"]
            minAge = session["min_age_limit"]
            feeType = center["fee_type"]
            currentDescription = ""
            currentSlots = 0

            if(session["date"] in sessions.keys()):
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
        if(totalSlots < 10):
            currentColor = RED_ALERT
        elif(10 <= totalSlots < 40):
            currentColor = AMBER_ALERT
        else:
            currentColor = GREEN_ALERT

        requests.post(
            WEBHOOKS[district],
            json={
                "content": f"@{district}",
                "embeds": [
                    {
                        "title": f"Total slots: {totalSlots} for {date}",
                        "description": session,
                        "color": currentColor
                    }
                ]
            }
        )


if __name__ == "__main__":
    while True:
        # Loop forever
        for district, districtId in ASETU_DISTRICTS.items():
            print(f"[+] Finding centers for district: {district}")
            filteredData = findCentersForDistrict(districtId)
            if filteredData is not None:
                alertDiscord(filteredData, district)

        # We sleep for some time
        sleep(TIMEOUT)
