from config import (
    DISCORD_ROLES,
    DISCORD_RED_ALERT,
    DISCORD_AMBER_ALERT,
    DISCORD_GREEN_ALERT,
)
import requests


def sendAlert(centers, district, hook):
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
            vaccine = session["vaccine"]
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
            Vaccine: **{vaccine}**
            ------------------------------------------------
            """
            currentSlots = currentSlots + availableCapacity

            sessions[session["date"]] = currentDescription
            sessionSlots[session["date"]] = currentSlots

    for date, session in sessions.items():
        print(f"Sending alerts for date {date}...")

        totalSlots = sessionSlots[date]
        if totalSlots < 10:
            currentColor = DISCORD_RED_ALERT
        elif 10 <= totalSlots < 40:
            currentColor = DISCORD_AMBER_ALERT
        else:
            currentColor = DISCORD_GREEN_ALERT

        if totalSlots < 5:
            # If slots are less than 5, do not @mention them. Just notify still.
            content = f"Slots available at {district}!"
        else:
            # Else, we @mention and let everyone know.
            content = mention

        requests.post(
            hook,
            json={
                "content": content,
                "embeds": [
                    {
                        "title": f"Total slots: {totalSlots} for {date}",
                        "description": session,
                        "color": currentColor,
                    }
                ],
            },
        )
