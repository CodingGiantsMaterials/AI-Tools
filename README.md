# AI-Tools

Static browser applications kept in one npm workspaces repository and published
together on GitHub Pages. Each application has its own Vite build, base path
and content security policy.

| Application | Address | Workspace |
| --- | --- | --- |
| Album | `https://codinggiantsmaterials.github.io/AI-Tools/Album/` | [`@ai-tools/album`](apps/album/README.md) |
| Player | `https://codinggiantsmaterials.github.io/AI-Tools/Player/` | `@ai-tools/player` |

Applications live in `apps/<app>`. Shared TypeScript and Vite configuration is
in `tsconfig.base.json` and `vite.shared.ts`. The
[shared contract](docs/contracts/shared.md) describes the build, addresses and
origin rules.

## Development and checks

Use Node.js 24 LTS (24.18.0 or later in the 24.x line) and run every command
from the repository root:

| Purpose | Command |
| --- | --- |
| Install dependencies | `npm ci` |
| Start one application's development server | `npm run dev -w @ai-tools/<app>` |
| Type-check every workspace | `npm run typecheck` |
| Build every application into `dist/<App>/` | `npm run build` |
| Preview one built application | `npm run preview -w @ai-tools/<app>` |

Development servers use HTTPS with a locally generated, self-signed
certificate.

## GitHub Pages

In repository **Settings → Pages**, choose **GitHub Actions** as the publishing
source. The [workflow](.github/workflows/pages.yml) installs dependencies, checks
the publication helper and builds all applications for pull requests and pushes
to `main`. It publishes `dist` only from `main` and can also be run manually
on that branch.

Every deployment contains all applications, so a failed build of one blocks
publication of the others. Verify the Actions run and the published asset
requests of each application after deployment before treating the hosted
release as accepted.

## Shared origin

All applications run at the origin `https://codinggiantsmaterials.github.io`,
like the organization's other Pages projects. They share IndexedDB,
localStorage, Cache Storage and the storage quota. A
`navigator.storage.persist()` grant applies to the whole origin, and clearing
site data removes the data of every application. Distinct data identifiers
prevent collisions but are not a security boundary; see the
[shared contract](docs/contracts/shared.md#shared-origin).
