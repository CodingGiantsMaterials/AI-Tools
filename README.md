# Web Album

A static browser application for opening local photos. It prepares a collection
in capture-date order and previews its first supported image. Collection,
metadata, C2PA and automatic local-note services are available for gallery UI
consumers.

Use Node.js 24 LTS (24.18.0 or later in the 24.x line):

```powershell
npm ci
npm run dev
```

The development server uses HTTPS with a locally generated, self-signed
certificate. Production assets are built for `/Web-Album/` and need only static
HTTPS hosting. The browser discovery probe also uses HTTPS for its reference SDK.

```powershell
npm test
npm run build
npx playwright install chromium firefox webkit
npm run test:browser
```

`npm run preview` serves `dist`. Browser tests build an additional integration
probe into `.discovery-build`; this directory is for tests and is not a release
artifact. See the [foundation contracts](docs/contracts/foundation.md) and
[collection and notes contracts](docs/contracts/local-data.md) for service
interfaces, lifecycle rules and capability limits.
