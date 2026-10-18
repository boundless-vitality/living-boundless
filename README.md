# Living Boundless

Nutrition plan app for Boundless Vitality. Cristie builds a plan on the coach page, the plan travels to the patient inside a link or QR code, and the patient follows and logs it on their phone.

**Privacy by design:** no backend, no accounts, no analytics. The plan is compressed into the part of the link after `#`, which browsers never send to a server. Patient logs stay in the phone's local database.

## What's here

| Folder    | What it is                                                                 |
| --------- | -------------------------------------------------------------------------- |
| `shared/` | Plan types, link encode/decode, schedule logic, import rules, sample plans, tests |
| `coach/`  | The plan builder web page (Vite + React), hosted later on GitHub Pages      |
| `app/`    | The patient app (Expo / React Native), iPhone first                         |

## One-time setup

You need Node.js 20+ (LTS) and, for the iPhone, the **Expo Go** app from the App Store.

```bash
npm install
```

## Run the tests

```bash
npm test
```

Prints the link size and QR density for the sample plans:

```bash
npm run size
```

## Coach page (in the browser)

```bash
npm run coach
```

Open http://localhost:5173. To try it fast: **Templates → Examples → Use**, then **Create plan link**.

## Patient app (on your iPhone with Expo Go)

1. Put your iPhone and Mac on the **same Wi-Fi**.
2. In Terminal, from this folder:
   ```bash
   npm run app
   ```
3. A QR code appears in Terminal. Open the iPhone **Camera** app, point it at that QR, and tap the banner. It opens in Expo Go.
4. In the app: **Add your plan → Scan QR code**, and point the phone at the plan QR on the coach page.

Stop either server with `Ctrl + C`.

## Names and addresses that aren't final

- **App name + URL scheme:** `shared/src/brand.json`
- **Where plan links point:** `PLAN_LINK_BASE` in `shared/src/config.ts`. This has to match the GitHub Pages address.
- **GitHub repo name used by the site build:** `REPO` in `coach/vite.config.ts`

## Link format (for developers)

`<PLAN_LINK_BASE>#p1.<base64url(deflate(json, dictionary))>`

- `p1` is the format version. The compression dictionary in `shared/src/dictionary.ts` is frozen for `p1`; changing it breaks links already sent, so add a `p2` instead.
- Validation runs both when Cristie creates a link and when the app reads one.
- Versions: a new plan is v1. Editing an issued plan and creating the link again makes v2, v3… with the same plan id. The app replaces the active plan with a higher version, moves the old one to Previous plans, and refuses older versions.
