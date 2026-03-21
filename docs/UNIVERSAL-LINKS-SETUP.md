# Universal Links (iOS) & App Links (Android)

Use this when you want **https://committed.dreambig.org.za/...** links to **open the installed app** instead of only the browser.

The app already supports:

- **Custom scheme:** `committed://` (see `app.json` → `scheme`)
- **Expo Router origin:** `https://committed.dreambig.org.za` (expo-router plugin)

What is **not** automatic: OS-level verification files on your web host and native entitlements. Without them, **https** links stay in Safari/Chrome.

---

## 1. Apple — Universal Links

### A. Enable Associated Domains (EAS / Xcode)

1. In **Apple Developer** → Identifiers → your App ID → enable **Associated Domains**.
2. In **EAS**, use `app.json` / `app.config.js` `ios.associatedDomains`:

```json
"ios": {
  "associatedDomains": [
    "applinks:committed.dreambig.org.za",
    "applinks:www.committed.dreambig.org.za"
  ]
}
```

(Adjust hostnames if you use `www` or a different marketing domain.)

3. Rebuild the iOS app after changing this.

### B. Host `apple-app-site-association` (AASA)

Serve **without** `.json` extension, **HTTPS**, **200**, **`application/json`**:

`https://committed.dreambig.org.za/.well-known/apple-app-site-association`

Minimal example (replace `TEAMID` and bundle id):

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.com.committed.app",
        "paths": [
          "/post/*",
          "/reel/*",
          "/referral/*",
          "/auth-callback*",
          "/reset-password*",
          "/verify-email*"
        ]
      }
    ]
  }
}
```

- **TEAMID:** Apple Developer → Membership.
- **Bundle ID:** `com.committed.app` (from `app.json`).

Validate with Apple’s [AASA validator](https://search.developer.apple.com/appsearch-validation-tool/) after deploy.

---

## 2. Google — Android App Links

### A. Intent filters (Expo config plugin)

Use **`expo-linking`** or **`@react-native-community/cli`**-compatible config. With **Expo SDK 50+**, add to `app.json` under `android`:

```json
"android": {
  "intentFilters": [
    {
      "action": "VIEW",
      "autoVerify": true,
      "data": [
        {
          "scheme": "https",
          "host": "committed.dreambig.org.za",
          "pathPrefix": "/"
        }
      ],
      "category": ["BROWSABLE", "DEFAULT"]
    }
  ]
}
```

Rebuild Android after changing. `autoVerify: true` requires the Digital Asset Links file below.

### B. Host `assetlinks.json`

`https://committed.dreambig.org.za/.well-known/assetlinks.json`

Replace `YOUR_SHA256` with your **release** keystore’s SHA-256 (EAS credentials or Play Console):

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.committed.app",
      "sha256_cert_fingerprints": ["YOUR_SHA256"]
    }
  }
]
```

Verify: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://committed.dreambig.org.za&relation=delegate_permission/common.handle_all_urls`

---

## 3. Website HTML (optional fallback)

For pages that must open the app when installed, you can still offer:

- `committed://post/123` (deep link service already parses this)
- Branch / Firebase Dynamic Links (third-party)

---

## 4. QA checklist

- [ ] Tap https link **with app installed** → opens app to correct route (not browser only).
- [ ] Tap same link **without app** → opens website.
- [ ] Cold start from link → `Linking.getInitialURL()` path exercised (`app/_layout.tsx`).
- [ ] Warm link while app open → `Linking.addEventListener('url')` + `subscribePendingDeepLink` (`AppGate`).

---

## 5. Related app code

| Piece | Location |
|--------|-----------|
| Scheme + router origin | `app.json` |
| Initial / warm URLs | `app/_layout.tsx` |
| Parse + queue | `lib/deep-link-service.ts` |
| Auth-ready routing | `components/AppGate.tsx` |
| OAuth / verify / recovery | `app/auth-callback.tsx` |
