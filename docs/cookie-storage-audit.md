# Cookie and browser storage review — 12 October 2026

## Scope and evidence

A fresh Chrome browser context checked `https://www.aurumite.com/`, `/legal/cookies`, `/request-quote` and `/login`, including a scroll through the home page to load deferred assets. No production credentials were used and no enquiry or payment was submitted. The raw report is stored locally under `.tools/cookie-audit/public-audit.json` and excludes cookie values and tokens.

The public pages contacted the Aurum origin, Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`), Unsplash (`images.unsplash.com`) and Pexels (`videos.pexels.com`). No local/session storage entries were present during the anonymous check. No advertising or analytics script was identified in the application code or this limited public check.

Loading the original automatic Pexels video set `__cf_bm` and `_cfuvid` cookies on `.pexels.com`. The first had an approximately 30-minute expiry; the second was a session cookie. They remained in the browser context on subsequent page visits. This does not imply that those subsequent pages independently set them. Provider purposes are documented in [Cloudflare's cookie reference](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/).

## Corrections implemented

- Pexels video is disabled until the visitor explicitly enables it. The local hero image remains available without connecting to Pexels.
- Home and `/legal/cookies` provide enable/disable controls. Disabling unmounts the video and blocks future media loads by Aurum. It cannot erase cookies on Pexels's domain or undo previous disclosures.
- `aurum-media-preference` remembers that choice, with a version and a 180-day expiry. Expired preferences are removed on the next application load. Storage failure defaults to no saved permission.
- Sign-out clears authentication state and removes `aurum-auth`. The current backend issues login tokens with a 24-hour lifetime; local storage itself has no automatic expiry. The authenticated API interceptor also signs out after a rejected authenticated request.
- The notice now lists these entries and differentiates an observed security purpose from the legal necessity assessment for Aurum. Optional video is handled through permission rather than an assumption that its cookies are necessary for the public website.
- The Privacy Notice now discloses external images, fonts and optional video connection data.

## Publication status

The client's notice is retained as a clearly identified publication draft with the supplied 12 October 2026 header date. No bracketed inventory placeholders are published. The trailing 21 October date was not used as a future publication date.

Authenticated production pages, payment provider flows, alternative browsers and hosting/security configuration changes remain outside this public-browser audit. They require verification before approving the notice as final. The signed-in cleanup and optional-video logic are verified locally with browser tests; this is not a claim of a comprehensive production audit.

No statistical-purpose or appearance exception is currently claimed for analytics. Future changes must include the appropriate consent or objection controls before activation, consistent with [ICO guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/).

## Verification

`client/e2e/cookie-storage.spec.ts` checks no Pexels request before permission, consent persistence/withdrawal, expiry, sign-out deletion and mobile presentation of the inventory and pricing. The local media request is intercepted; real third-party cookie names and timing come from the separate live anonymous audit.
