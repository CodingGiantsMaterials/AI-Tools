# Web Album

A static browser application for opening local photos. The foundation currently
opens a folder, previews its first supported image, and reads C2PA locally.

Use Node.js 24 LTS (24.18.0 or later in the 24.x line):

```powershell
npm ci
npm run dev
```

The development server uses HTTPS with a locally generated, self-signed
certificate. The C2PA SDK requires an HTTPS worker URL. Production assets are
built for `/Web-Album/` and need only static HTTPS hosting.

```powershell
npm test
npm run build
npx playwright install chromium firefox webkit
npm run test:browser
```

`npm run preview` serves `dist`. Browser tests build an additional integration
probe into `.discovery-build`; this directory is for tests and is not a release
artifact. See the [foundation contracts](docs/contracts/foundation.md) for
service interfaces, lifecycle rules and capability limits.
