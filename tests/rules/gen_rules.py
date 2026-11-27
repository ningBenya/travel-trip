# Generates database.rules.json — edit rules here, then run:  python tests/rules/gen_rules.py database.rules.json
# (the JSON is what gets pasted into Firebase Console)
import json, sys

A = "auth.token.email == 'hwangning@travel.local'"
ADMIN = "auth != null && " + A
U = "root.child('planner/users/' + auth.uid).exists()"
USER = "auth != null && (" + U + " || " + A + ")"
MEM_HERE = "data.parent().child('members/' + auth.uid).exists()"   # for direct children of trips/$t
ISO = "/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/"
ID = "/^[A-Za-z0-9_-]{1,64}$/"

def member_field(validate):
    return {".write": "auth != null && " + MEM_HERE, ".validate": validate}

def photo_store(max_len):
    trip_of = "root.child('planner/photoTrip/' + $photoId).val()"
    return {
        "$photoId": {
            ".read": USER,
            ".write": "auth != null && (" + A + " || (" + U + " && ("
                      "(!data.exists() && newData.exists() && newData.parent().parent().child('photoTrip/' + $photoId).exists())"
                      " || (data.exists() && root.child('planner/trips/' + " + trip_of + " + '/members/' + auth.uid).exists()))))",
            ".validate": "newData.isString() && newData.val().beginsWith('data:image/') && newData.val().length < " + str(max_len)
        }
    }

rules = {"rules": {"planner": {
    "users": {
        ".read": USER,
        "$uid": {
            ".write": ADMIN,
            ".validate": "newData.hasChildren(['username', 'name']) && newData.child('username').isString() && newData.child('name').isString()",
            "name": {
                ".write": "auth != null && auth.uid == $uid && root.child('planner/users/' + $uid).exists()",
                ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 100"
            }
        }
    },
    "usernames": {
        ".read": USER,
        ".write": ADMIN,
        "$name": {".validate": "newData.isString() && $name.matches(/^[a-z0-9._-]{3,30}$/)"}
    },
    "trips": {
        ".read": ADMIN,
        "$t": {
            ".read": "auth != null && (" + A + " || data.child('members/' + auth.uid).exists())",
            ".write": "auth != null && (" + A + " || (" + U + " && ((!data.exists() && newData.child('ownerId').val() == auth.uid && newData.child('members/' + auth.uid).val() == true) || data.child('ownerId').val() == auth.uid)))",
            ".validate": "newData.hasChildren(['name']) && (newData.hasChild('ownerId') || " + A + ") && (!newData.hasChild('ownerId') || newData.child('members/' + newData.child('ownerId').val()).val() == true)",
            "ownerId": {".validate": "newData.isString() && (newData.val() == data.val() || (!data.exists() && newData.val() == auth.uid) || " + A + ")"},
            "members": {
                "$uid": {
                    ".write": "auth != null && $uid == auth.uid && !newData.exists() && data.exists()",
                    ".validate": "newData.val() == true && newData.parent().parent().parent().parent().child('users/' + $uid).exists()"
                }
            },
            # id: only the owner/admin (via $t) may write it, and it must equal the key
            "id": {".validate": "newData.val() == $t"},
            "name": member_field("newData.isString() && newData.val().length > 0 && newData.val().length <= 200"),
            "destination": member_field("newData.isString() && newData.val().length <= 200"),
            "start": member_field("newData.isString() && (newData.val() == '' || newData.val().matches(" + ISO + "))"),
            "end": member_field("newData.isString() && (newData.val() == '' || newData.val().matches(" + ISO + "))"),
            "people": member_field("newData.isNumber() && newData.val() >= 1 && newData.val() <= 999"),
            "theme": member_field("newData.isString() && newData.val().matches(/^[a-z]{1,20}$/)"),
            "coverId": member_field("newData.isString() && (newData.val() == '' || newData.val().matches(" + ID + "))"),
            "createdAt": member_field("newData.isNumber()"),
            "updatedAt": member_field("newData.isNumber()"),
            "days": {
                ".write": "auth != null && " + MEM_HERE,
                "$d": {
                    ".validate": "$d.matches(" + ISO + ")",
                    "tagline": {".validate": "newData.isString() && newData.val().length <= 300"},
                    "tips": {"$n": {".validate": "newData.isString() && newData.val().length <= 300"}}
                }
            }
        }
    },
    "userTrips": {
        "$u": {
            ".read": "auth != null && (auth.uid == $u || " + A + ")",
            ".write": ADMIN,
            "$t": {
                ".write": "auth != null && (" + A + " || root.child('planner/trips/' + $t + '/ownerId').val() == auth.uid || (!root.child('planner/trips/' + $t).exists() && newData.parent().parent().parent().child('trips/' + $t + '/ownerId').val() == auth.uid) || ($u == auth.uid && !newData.exists()))",
                ".validate": "newData.val() == true"
            }
        }
    },
    "items": {
        ".read": ADMIN,
        "$t": {
            ".read": "auth != null && (" + A + " || root.child('planner/trips/' + $t + '/members/' + auth.uid).exists())",
            ".write": "auth != null && (" + A + " || root.child('planner/trips/' + $t + '/members/' + auth.uid).exists() || newData.parent().parent().child('trips/' + $t + '/members/' + auth.uid).val() == true)",
            "$itemId": {
                ".validate": "newData.hasChildren(['cat', 'name', 'price']) && newData.child('name').isString() && newData.child('price').isNumber() && newData.child('price').val() >= 0 && (!newData.hasChild('id') || newData.child('id').val() == $itemId)",
                "cat": {".validate": "newData.isString() && newData.val().matches(/^[a-z]{1,20}$/)"},
                "date": {".validate": "newData.isString() && (newData.val() == '' || newData.val().matches(" + ISO + "))"},
                "qty": {".validate": "newData.isNumber() && newData.val() >= 1"},
                "timeStart": {".validate": "newData.isString() && (newData.val() == '' || newData.val().matches(/^[0-9]{2}:[0-9]{2}$/))"},
                "timeEnd": {".validate": "newData.isString() && (newData.val() == '' || newData.val().matches(/^[0-9]{2}:[0-9]{2}$/))"},
                "photoIds": {"$n": {".validate": "newData.isString() && newData.val().matches(" + ID + ")"}}
            }
        }
    },
    # which trip a photo belongs to: only members of that trip may overwrite or delete it
    "photoTrip": {
        ".read": ADMIN,
        "$photoId": {
            ".read": USER,
            ".write": "auth != null && (" + A + " || (" + U + " && ((!data.exists() && newData.exists()) || (data.exists() && !newData.exists() && root.child('planner/trips/' + data.val() + '/members/' + auth.uid).exists()))))",
            ".validate": "newData.isString() && newData.val().matches(" + ID + ")"
        }
    },
    # วันหยุดที่ admin เพิ่ม/แก้/ซ่อน ทับรายการใน holidays.js
    "holidays": {
        ".read": USER,
        "$d": {
            ".write": ADMIN,
            ".validate": "$d.matches(" + ISO + ") && (newData.child('off').val() == true || (newData.child('name').isString() && newData.child('name').val().length > 0 && newData.child('name').val().length <= 100))",
            "name": {".validate": "newData.isString()"},
            "off": {".validate": "newData.isBoolean()"},
            "$other": {".validate": False}
        }
    },
    "thumbs": photo_store(300000),
    "photos": photo_store(3000000)
}}}

out = sys.argv[1]
open(out, 'w', encoding='utf8', newline='\n').write(json.dumps(rules, ensure_ascii=False, indent=2) + '\n')
print('wrote', out)
