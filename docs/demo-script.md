# 3-minute demo script (on an Android phone)

**Before you start (1 minute, off-stage)**
- Open https://itadakimashu.github.io/Pani-shakki/ in Chrome. Tap ⋮ › **Add to Home screen** (or **আরও › হোম স্ক্রিনে যোগ করুন**). Launch it from the home-screen icon.
- Allow **location** and **microphone** when asked.
- For read-aloud: Android **Settings › Text-to-speech › Google › Install voice data › বাংলা (Bangladesh)**.
- Optional fresh start: **আরও › ডেমো তথ্য আবার শুরু করুন**.
- Turn the volume up.

---

**0:00–0:20 · The problem**
> "In Bangladesh's chars, haors and coast, millions face floods every year. Official forecasts exist, but they rarely reach a farmer in plain Bangla, and responders can't see what's happening village by village. পানি সাক্ষী, 'Water Witness', makes every villager a witness."

**0:20–1:05 · Villager reports by voice** (রিপোর্ট tab)
1. Point at the header: **ডেমো** badge, green **অনলাইন** dot.
2. Show **📍 GPS যুক্ত হয়েছে** and the union filled in automatically. (If you're not in one of the demo districts, pick **অষ্টমীর চর (চিলমারী)** from the list.)
3. Tap the big 🎙️ and say clearly: **"উঠোনে কোমর পানি, গরু ভেসে যাচ্ছে, নৌকা দরকার"**.
4. Point at the live transcript and the **যা বুঝলাম** chips: severity, **কোমর পানি**, **নৌকা**, **গবাদিপশু**.
   > "No AI server needed. A Bangla rule engine runs right in the phone, and it understands spelling variants and Bangla digits."
5. Tap **📤 রিপোর্ট পাঠান**. Show the green confirmation and the **nearest shelter + distance**.
   *(If voice fails, type it or tap **দ্রুত বাক্য** chips.)*

**1:05–1:35 · Works offline**
1. **আরও** › tick **অফলাইন অনুকরণ করুন** (or switch on Airplane mode).
2. Back to **রিপোর্ট**, tap the quick phrase **আটকা পড়েছি** › **পাঠান**. Show **"অফলাইনে সংরক্ষিত"** and the ⏳ count in the header.
3. Untick it (or turn Airplane mode off). The ⏳ disappears as the report syncs by itself.
   > "Networks drop during floods. Nothing is lost."

**1:35–2:05 · Alerts in plain Bangla** (সতর্কতা tab)
1. Union **অষ্টমীর চর** shows a red **বিপদ** card: "…পানি প্রায় ১ ফুট বাড়তে পারে… এখনই আশ্রয়কেন্দ্রে যান। নিকটতম: …"
2. Tap **🔊 শুনুন**. The phone reads it aloud in Bangla.
   > "For people who can't read, the alert is spoken. Same text can go out by SMS and IVR voice calls; the backend has those adapters."
3. Scroll to the Brahmaputra card: current vs danger level, 48-hour forecast line, red danger mark.

**2:05–2:45 · Responder dashboard** (ড্যাশবোর্ড tab)
1. Tiles: open reports, **জরুরি**, **সন্দেহজনক** (flagged), stations above danger.
2. Map: clusters coloured by the worst severity inside, plus river stations (〰) and shelters (⌂).
3. Priority list: #1 is an emergency. Tap **📍 ম্যাপে দেখুন**. The map zooms in and draws dashed lines to the 3 nearest shelters with km and free capacity.
4. Tap **✅ সাড়া দেওয়া হয়েছে**. It drops off the open list.
5. Filter severity **৩ · জরুরি**, then scroll to a card with ⚠ chips: **একই ফোন থেকে বারবার** (Gabura spam) or **অবস্থান ইউনিয়ন থেকে দূরে** (GPS in Dhaka).
   > "Trust scoring catches spam, duplicates, impossible locations and reports that contradict their neighbours."

**2:45–3:00 · Close**
1. Tap **English** in the header. The whole UI switches language.
   > "Bangla first, voice first, offline first. It runs today as a PWA with no server, and the full Django backend, with SMS/IVR and an FFWC forecast plug-in, is one tap away on Render."

---
**Backup lines if something fails**
- Mic not working → "Chrome needs internet for speech recognition. Here's typed input." Use quick phrases.
- No Bangla voice → the app shows a note explaining how to install it. Read the alert out yourself.
- Map tiles blank (no data) → the pins, clusters and list still work. Tiles you've seen before are cached.
