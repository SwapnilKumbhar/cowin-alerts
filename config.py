from yaml import safe_load
from os.path import exists

# We hardcoded for now
if not exists("config.yaml"):
    print("[!!!] Could not find a `config.yaml` file. Exiting...")
    exit(-1)

CONFIG = safe_load(open("config.yaml", "r"))

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
DISCORD_RED_ALERT = "7798804"

# Total 10-40 slots in a day
DISCORD_AMBER_ALERT = "16760576"

# More than total 40 slots in a day
DISCORD_GREEN_ALERT = "3066993"

# Discord errors channel, notify here when anything breaks
DISCORD_ERROR_HOOK = CORE["discord"]["errors"]["hook"]

# Notify these people in case of an error
DISCORD_ERROR_ROLES = CORE["discord"]["errors"]["notify"]
