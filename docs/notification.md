# Meetup Notifications

This document describes how SoulTribe.chat notifies users when a meetup is proposed or confirmed. It covers email templates, delivery timing, and user expectations.

## Overview

Meetup notifications are delivered via email and in-app banners. Each step of the meetup workflow triggers a specific notification so both parties stay aligned on scheduling.

## Notification Types

1. **Meetup Proposed**
   - Trigger: User A proposes a meetup time.
   - Email: Sent to User B (if their email is verified) with the proposed details, including UTC time and a prompt to confirm.
   - In-app: User B sees a notification banner and the proposed meetup inside the dashboard.

2. **Meetup Confirmed**
   - Trigger: User B confirms the proposed meetup.
   - Email: Sent to both User A and User B (verified addresses only) with the confirmed time and Jitsi link.
   - In-app: The dashboard updates the status to confirmed, with a reminder banner.

3. **Meetup Updated**
   - Trigger: Either user modifies the meetup details before confirmation.
   - Email: Notifies the other user of the update.

## Email Content

Emails include:
- Greeting with the recipient's display name (or email fallback)
- Meetup date/time in UTC
- Link to join or view the meetup details
- Reminder of cancellation or update policies

## In-App Notifications

- The dashboard shows status updates.
- Notification banners appear for pending action or confirmation acknowledgement.

## Summary

Meetup notifications ensure both users stay informed throughout the scheduling process. Emails and in-app notifications are triggered by proposals, confirmations, and updates, providing comprehensive coverage for all meetup-related events.
