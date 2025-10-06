# Windsurf Prompt: SoulTribe Jitsi Chat Guide

Instruct Windsurf to generate a complete, visually clear quick-start guide for first-time guests joining SoulTribe Jitsi video, audio, and text chats.

### Section 1 — Pre‑Join Instructions
Render a clear, numbered step-by-step section with the following:
1. Explain that Jitsi supports **text, audio, and video** — each optional.
2. On the **login page**, describe how to allow browser access to mic and cam.
3. Add subpoints showing how to:
   - Enter your name.
   - Enable/disable mic and camera via the first two icons.
   - Choose the correct input/output device from the small **arrow-up** menus.
   - Set or blur the background.
4. Add a **Browser Compatibility** block:
   - ✅ Works well on Firefox and Chrome.
   - ⚠️ DuckDuckGo browser supports chat only (no audio/video).
   - Include troubleshooting steps for permissions, trackers, and reload.

### Section 2 — In‑Room Interface Layout
Generate a paragraph summarizing:
- The **main video area** (center) shows participants.
- The **bottom control bar** contains mic, camera, screen share, chat, and more icons.
- The **top-right menu** manages participants, settings, and security.

### Section 3 — Toolbar Icons
Render a Markdown table with columns: **Icon (SVG)**, **Emoji**, **Label**, **Description**.  Include inline SVG previews from the following paths:

| Icon | Emoji | Label | Description |
|-------|--------|--------|-------------|
| `<svg viewBox="0 0 24 24"><path d="M12 1.5A4.5 4.5 0 0 0 7.5 6v6a4.5 4.5 0 1 0 9 0V6A4.5 4.5 0 0 0 12 1.5ZM15 12V6a3 3 0 1 0-6 0v6a3 3 0 1 0 6 0Z"/></svg>` | 🎙️ | **Microphone** | Toggle your microphone (arrow ↑ for device options). |
| `<svg viewBox="0 0 24 24"><path d="M17.25 16.226v.274a3 3 0 0 1-3 3H4.5a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3h9.75a3 3 0 0 1 3 3v.274l2.834-2.186c.986-.76 2.416-.058 2.416 1.188v10.448c0 1.246-1.43 1.949-2.416 1.188l-2.834-2.186ZM4.5 6h9.75a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 16.5v-9A1.5 1.5 0 0 1 4.5 6Zm12.75 8.331L21 17.224V6.776l-3.75 2.893v4.662Z"/></svg>` | 📷 | **Camera** | Toggle your camera (arrow ↑ for device options). |
| `<svg viewBox="0 0 24 24"><path d="M14.846 6.221c-.573-.544-1.519-.137-1.519.653V8.6c-4.698.322-8.48 3.639-8.805 7.847a.886.886 0 0 0 .62.919.9.9 0 0 0 1.011-.347c2.185-3.14 5.332-3.882 7.174-3.974V15.2c0 .799.962 1.202 1.531.642l4.308-4.24a.9.9 0 0 0-.012-1.295l-4.308-4.086Zm-.019 3.854V8.27l2.844 2.698-2.844 2.8v-2.195l-.718-.03c-1.526-.066-4.68.256-7.371 2.589 1.255-2.348 4-4.057 7.339-4.057h.75Z"/><path d="M4.5 3a3 3 0 0 0-3 3v11.25a3 3 0 0 0 3 3h.75a.75.75 0 0 0 0 1.5h13.5a.75.75 0 0 0 0-1.5h.75a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3h-15Zm15 1.5h-15A1.5 1.5 0 0 0 3 6v11.25a1.5 1.5 0 0 0 1.5 1.5h15a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5Z"/></svg>` | 🖥️ | **Screen Share** | Share your screen or window. |
| `<svg viewBox="0 0 24 24"><path d="M6.75 2.25A5.25 5.25 0 0 0 1.5 7.5v7.125a2.625 2.625 0 0 0 2.625 2.625c.621 0 1.125.504 1.125 1.125v.843c0 1.88 2.272 2.82 3.6 1.492l2.362-2.362a3.75 3.75 0 0 1 2.652-1.098h3.386c2.9 0 5.25-2.35 5.25-5.25V7.5c0-2.9-2.35-5.25-5.25-5.25H6.75ZM3 7.5a3.75 3.75 0 0 1 3.75-3.75h10.5A3.75 3.75 0 0 1 21 7.5V12a3.75 3.75 0 0 1-3.75 3.75h-3.386a5.25 5.25 0 0 0-3.712 1.538L7.79 19.649a.61.61 0 0 1-1.04-.43v-.844a2.625 2.625 0 0 0-2.625-2.625A1.125 1.125 0 0 1 3 14.625V7.5Z"/></svg>` | 💬 | **Chat** | Open text chat to send messages or share links. |
| `<svg viewBox="0 0 24 24"><path d="M17.25 9.75a.75.75 0 0 0 1.5 0v-3h3a.75.75 0 0 0 0-1.5h-3v-3a.75.75 0 0 0-1.5 0v3h-3a.75.75 0 0 0 0 1.5h3v3Z"/><path d="M11.25 9.75a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Zm-1.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0ZM13.5 18.75c0 2.071-2.686 3.75-6 3.75s-6-1.679-6-3.75c0-2.071 2.686-3.75 6-3.75s6 1.679 6 3.75Zm-1.5 0c0 .332-.22.859-1.052 1.38-.812.507-2.027.87-3.448.87-1.42 0-2.636-.363-3.448-.87C3.22 19.609 3 19.082 3 18.75c0-.332.22-.859 1.052-1.38.812-.507 2.027-.87 3.448-.87 1.42 0 2.636.363 3.448.87.833.521 1.052 1.048 1.052 1.38Z"/></svg>` | 👥 | **Participants / Invite** | Invite others or view participants. |
| `<svg viewBox="0 0 24 24"><path d="M16.5 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0Zm1.5 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0ZM9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0Zm1.5 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0ZM4.5 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm0-1.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"/></svg>` | ⚙️ | **More Options** | Open security options or additional settings. |
| `<svg viewBox="0 0 24 24"><path d="M15.535 14.214c.207.832.388 1.233.899 1.598.458.326 2.902.7 3.868.688.509-.007.952-.138 1.304-.462l.017-.016c.858-.851 1.034-3.173.753-4.411-.168-1.205-1.006-2.135-2.395-2.755l-.213-.09c-3.724-1.703-11.8-1.675-15.55.007-1.484.588-2.395 1.562-2.598 2.89-.27 1.067-.112 3.47.758 4.352.374.346.818.477 1.327.484.965.012 3.41-.362 3.867-.687.47-.334.66-.699.848-1.399l.067-.263c.126-.506.203-.652.394-.75 2.08-.95 4.164-.95 6.269.011.15.078.227.204.333.599l.052.204Z"/></svg>` | 🔴 | **Hang Up** | Leave the room. |

### Section 4 — Functional Guides
Render brief text blocks describing:
- How to **open chat** with 💬 icon.
- How to **share screen** using 🖥️ icon.
- How to **invite friends** with 👥 icon.
- How to **secure the room** using ⚙️ → Security Options.

### Section 5 — Quick Join Link
Display a centered, visually highlighted link block:

> 💫 Join instantly at [https://jitsi.bubuit.net/soultribe](https://jitsi.bubuit.net/soultribe) — meet random guests or test your setup.

### Section 6 — Closing Line
End the guide with a friendly closing sentence like:
> Enjoy connecting — in your own way, on your own terms.

