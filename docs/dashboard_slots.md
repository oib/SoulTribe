---
title: Dashboard Availability Slots — User Guide
last_updated: 2025-10-02
---

# Dashboard Availability Slots — User Guide

Welcome to the availability section of the SoulTribe.chat dashboard. This guide explains how to share the times you are free to meet with matches and how the app keeps everything consistent across timezones.

## What Is an Availability Slot?
- **Definition**: A slot is a block of time when you are free for SoulTribe meetups. Each slot has a start time, an automatically calculated end time, and is tied to your profile timezone.
- **Why it matters**: The matching engine compares your slots against other members to find overlapping windows. When an overlap exists, it appears in the Matches section as a suggested meetup time.
- **Where it appears**: Slots you create show up in the Availability list on the dashboard. When a compatible member is found, their overlaps with your slots appear under `Matches → Overlaps`.
- **System behaviour**: The backend saves both the UTC and local timestamps, so cross-timezone members see your availability in their own locale while the system stays consistent.

## Slot Workflow: From Availability to Meetup
- **Step 1 — Publish your free time**: Add one or more slots covering the days and hours you are genuinely available. Each slot is broadcast to the matching engine immediately.
- **Step 2 — Matching runs on demand**: When you or another member requests matches, the backend looks for time overlaps between both members' slots (in UTC) and filters out anything in the past.
- **Step 3 — Review overlaps**: In the `Matches` section, overlap chips list three columns: `UTC`, `You`, and `Other`. These show the exact shared window and duration.
- **Step 4 — Propose a meetup**: Click `Propose this time` on an overlap. The system creates or updates a match record and opens the meetup flow with the shared slot pre-filled.
- **Step 5 — Keep slots current**: After a meetup is confirmed or if your schedule changes, edit or delete outdated slots so the matching engine only suggests times that still work for you.

## Getting Started
- **Open the dashboard**: Log in and navigate to `dashboard.html`.
- **Check your profile timezone**: The scheduler uses the timezone saved in your profile (`Profile.live_tz`). Update it first if it is incorrect.
- **Locate the slots panel**: The "Availability" card shows existing slots and the form to create new ones.

## Reading the Slot List
- **Timezone banner**: A banner such as `Using timezone: Europe/Vienna` confirms the timezone applied to times you enter.
- **Slot cards**: Each entry shows
  - `Local time`: The start and end in your profile timezone.
  - `UTC time`: The same interval converted to Coordinated Universal Time.
  - `Duration`: Calculated from start to end (minimum one hour).
  - `Actions`: `Edit` and `Delete` buttons appear for every future slot.

## Creating a Slot
1. **Pick the date**: Slots must start and end on the same calendar day.
2. **Choose start time**: The field accepts whole-hour values (e.g. 09:00, 14:00).
3. **Set duration**: Select a duration between 1 and 3 hours. The end time is filled automatically.
4. **Submit**: Press `Add slot`. The frontend converts your local time to UTC (for example, 12:00 Europe/Vienna → 10:00 UTC) and sends both to the server.
5. **Success toast**: A toast confirms the slot was saved and the list refreshes to include it.

### Slot Validation Rules
- Slots must be at least 1 hour long and aligned to whole hours.
- You cannot create slots in the past.
- Overlapping slots are prevented automatically.

## Editing a Slot
1. Click `Edit` on the desired slot.
2. Update the date/time/duration fields. The same validation rules apply as when creating a slot.
3. Submit to save changes. The interface updates both local and UTC displays.

## Deleting a Slot
- Press `Delete` on the slot card.
- Confirm the prompt. The slot disappears immediately after backend confirmation.

## How Timezones Work
- The scheduler uses your profile timezone to interpret any time you enter.
- The backend stores both the local timestamp, the timezone, and the converted UTC time. This ensures matches in other regions see overlaps correctly.
- Even if you change your timezone later, historical slots retain the original timezone metadata for accuracy.

## Troubleshooting
- **Wrong timezone shown**: Update your profile at `dashboard → Profile` and refresh the page.
- **Cannot pick desired end time**: Ensure the duration selector covers the span you need; all slots must be multiples of one hour.
- **Slot rejected as "past"**: Double-check the date and that your device clock matches your actual timezone.
- **Still stuck?**: Contact support with the slot date/time and the timezone shown in the banner.

## Tips
- Keep at least three upcoming slots to improve match chances.
- Delete stale slots if you become unavailable so matches are not offered outdated times.
- If you travel, update your profile timezone before creating new slots; existing slots stay as-is.
