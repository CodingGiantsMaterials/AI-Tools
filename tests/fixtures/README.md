# Integration fixtures

`images/static.png`, `images/animated.png` and `images/animated.webp` are generated
32 × 32 pixel color swatches. The animations alternate opaque red and blue every
250 ms, looping indefinitely; no external image assets are involved.

The C2PA fixtures originate from the MIT-licensed
[c2pa-js test assets](https://github.com/contentauth/c2pa-js/tree/main/packages/c2pa-web/test/assets).
The upstream license is retained in [c2pa/LICENSE.txt](c2pa/LICENSE.txt).

| Local file | Upstream file or derivation |
| --- | --- |
| `embedded.jpg` | `C.jpg` |
| `remote.jpg` | `PirateShip_save_credentials_to_cloud.jpg` |
| `no-algorithm.jpg` | `no_alg.jpg` |
| `corrupt.jpg` | First 1,000 bytes of `C.jpg` |
| `remote-icon.jpg` | `C.jpg` with the first claim generator's version replaced by a CBOR icon HashedUri for `https://privacy.invalid/icon.png`; JUMBF and JPEG segment lengths adjusted |

The derived icon fixture deliberately has invalid hashes/signatures and produces
a reader with an incomplete manifest. It tests external resource handling and
the distinction between detected structure and readable data. It is not a trust
or signature validation fixture. The embedded fixture also includes certificate
OCSP, issuer and CRL URLs. Tests disable CSP enforcement for the privacy probe
so blocked requests cannot masquerade as successful SDK configuration.
