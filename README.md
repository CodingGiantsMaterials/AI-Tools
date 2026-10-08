# Web Album

A static browser application for browsing local photos in capture-date order.
A looping carousel, thumbnail strip and enlarged preview display original
images, including animations. The active-image panel shows recorded metadata,
C2PA declarations and automatically saved local notes. The interface supports
Polish, English, German and Spanish, with light and dark themes.

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
interfaces, lifecycle rules and capability limits. The
[gallery contract](docs/contracts/gallery.md) describes the UI integration.
