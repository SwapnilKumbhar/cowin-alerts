from config import (
    DISCORD_ROLES,
    DISCORD_RED_ALERT,
    DISCORD_AMBER_ALERT,
    DISCORD_GREEN_ALERT,
    DISCORD_ERROR_HOOK,
    DISCORD_ERROR_ROLES,
)
import requests
import traceback


def sendAlert(centers, district, hook, mentions=None):
    sessions = {}
    sessionSlots = {}
    mention = (
        "".join(
            list(map(lambda s: "<@{}>".format(s), mentions))
        )  # I know, this is ugly
        if mentions is not None
        else ""
    )  # Basically, if mentions are provided explicity, we alert those mentions. For pincodes only.
    districtMention = DISCORD_ROLES[district]

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
            # Notify and return from the function here.
            content = f"Slots available at {district}!"
            resp = requests.post(
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
            if resp.status_code in range(200, 300):
                print("[+] Alerted Discord!")
            else:
                print("[!] Failed to alert discord")
                print(f"[!] Response Code: {resp.status_code}")
            return

        content = districtMention + mention

        if len(content) < 2000:
            resp = requests.post(
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
            if resp.status_code in range(200, 300):
                print("[+] Alerted Discord!")
            else:
                print("[!] Failed to alert discord")
                print(f"[!] Response Code: {resp.status_code}")

        elif mentions is not None:  # We are notifying for pincodes
            if availableCapacity >= 5:  # Notify only if more than 5 slots open
                # Split the message into multiple messages.
                # I know. This is redundant, but I feel this case will be less common
                # so I can go with the 0.00001 seconds of overhead.
                allMentions = content.split(" ")

                #
                # Time for some Quicc Maths! We will alert people like this: '@district @user1 @user2 @user3 ...'
                # In order to do this, you have to put a districtMention and the individual user mentions. Discord will not
                # allow more than 2000 characters in their messages, so we have to split them and send it across.
                # Each districtMention (which is a role mention) is 23 characters long and each user mention is 22 characters long.
                #
                # So I'll be conservative and take the least of the two, multiply it close enough to get to 2000 and then send it across.
                # .: 23 + 22 * x < 2000
                # .: x < 1977/22 =~ 89
                # For good measure, to **ensure** it is never greater than 2000 ever, lets reduce 1. So that's 88.
                # Now we send alerts for chunks of 88 items.
                i = 0
                while i < len(allMentions):
                    currentMentions = " ".join(allMentions[i : i + 88])
                    if len(currentMentions) == 0:
                        break
                    resp = requests.post(
                        hook,
                        json={
                            "content": currentMentions,
                            "embeds": [
                                {
                                    "title": f"Total slots: {totalSlots} for {date}",
                                    "description": session,
                                    "color": currentColor,
                                }
                            ],
                        },
                    )
                    if resp.status_code in range(200, 300):
                        print("[+] Alerted Discord!")
                    else:
                        print("[!] Failed to alert discord")
                        print(f"[!] Response Code: {resp.status_code}")

                    i += 86


def sendError(message):
    notifyRoles = "".join(DISCORD_ERROR_ROLES)
    description = traceback.format_exc()

    print("-- Notifying our dear admins...")
    resp = requests.post(
        DISCORD_ERROR_HOOK,
        json={
            "content": notifyRoles,
            "embeds": [
                {
                    "title": message.__str__(),
                    "description": description,  # stacktrace
                    "color": DISCORD_RED_ALERT,
                }
            ],
        },
    )
