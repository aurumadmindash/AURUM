# Browser storage changes: 19 October 2026

- Landing video is hosted locally and no longer gated by the cookie decision. No media toggle remains.
- `aurum-cookie-preference` stores the accept/reject decision for 180 days. Neither decision activates advertising or analytics: none are currently integrated. This decision is not consent for a future purpose. The previous `aurum-media-preference` key is removed.
- `aurum-auth` now uses sessionStorage. Legacy localStorage credentials are deleted, requiring existing users to sign in again. Tabs have their own account state (browser restore/duplicated-tab behaviour is browser-dependent). Server JWT lifetime remains 24 hours; expired tokens are cleared at hydration/request, and sign-out removes the entry. Tokens remain JavaScript-readable, so this is not equivalent to an HttpOnly server session.
- Privacy notice now maps supported purposes to lawful bases, explains required enquiry information and the right to object; the quote form links directly to it.
- Footer contact details have separate labelled rows, valid mailto/tel links and larger mobile targets.

Before final legal approval, the owner must confirm the legal controller identity and service address, registration details if applicable, actual production processors/regions and transfer arrangements, operational retention periods and deletion process, and ICO fee status. Do not invent these details or treat this code change as legal certification. Re-audit production account/payment/hosting flows when configuration changes. The cookie notice remains a publication draft pending that review.
