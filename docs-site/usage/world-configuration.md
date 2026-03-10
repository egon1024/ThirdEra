---
contents: none
---

# World configuration

ThirdEra exposes several **world-level settings** that GMs can use to tune behavior for a given world. These are per-world options: each world can have different values.

## Where to find the settings

With a ThirdEra world loaded, open **Configure** (gear icon) in the right-hand sidebar, then choose **Configure Game Settings**. The ThirdEra options appear in the **System Settings** section.

## Available options

### Track Currency Weight

- **Default:** Off  
- If **enabled**, every 50 coins (of any type) add 1 lb to the character’s or NPC’s total carried weight, following the D&D 3.5 standard. Encumbrance and weight totals on the sheet reflect this.  
- If **disabled**, currency is not counted toward weight.

### Enable Audit Log

- **Default:** On  
- When **enabled**, the system sends whisper notifications to the GM in chat when actors or items are created, updated, or deleted. This helps GMs track changes made by players (e.g. level-up, inventory, spells).  
- When **disabled**, no audit log messages are sent.

### Filter GM Actions

- **Default:** Off  
- Only applies when **Enable Audit Log** is on.  
- When **enabled**, actions performed by a user with the GM role are not included in the audit log; only non-GM actions are reported.  
- When **disabled**, both GM and player actions are logged.

### First Level Full Hit Points

- **Default:** On  
- When **enabled**, the first level of the first class added to a character automatically receives **maximum** hit points from that class’s hit die (e.g. d8 → 8 HP). The value remains editable in the character’s level history.  
- When **disabled**, first-level HP is rolled or entered manually as for other levels.
