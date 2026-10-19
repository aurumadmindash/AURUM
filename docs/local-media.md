# Locally hosted website media

On 19 October 2026, the five externally referenced Unsplash images and Pexels background video were downloaded into `client/public/landing`. Google Fonts files and their stylesheet were downloaded into `client/public/fonts`, with the Inter and Montserrat SIL Open Font License notices retained alongside them.

The website references these files using same-origin paths. No Google Fonts preconnect or remote stylesheet remains. The video stays optional and uses the existing media preference. Cookie and privacy text describes the local configuration rather than implying that loading the video sets Pexels/Cloudflare cookies.

`media-sources.json` records each original URL, destination, byte count and SHA-256 checksum. The video is approximately 2.8 MB and is served as a static asset; it does not pass through an API function.

Original provider licences:

- [Unsplash licence](https://unsplash.com/license)
- [Pexels licence](https://www.pexels.com/license/)
- Inter and Montserrat: the bundled `OFL.txt` notices in `client/public/fonts`.

The images/video are incorporated into Aurum's website rather than offered as a standalone media library. Keep this source register and the font notices with future copies of the assets.

The 12 October audit described a previous externally hosted configuration. Its Pexels cookie findings remain historical evidence, not the inventory for the updated local-media build. Browser checks for this build verify that images, fonts and video load successfully from the Aurum origin with no third-party asset requests. Payment-provider redirects or external links initiated by a visitor are separate services.
