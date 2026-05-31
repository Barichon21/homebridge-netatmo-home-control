# homebridge-netatmo-home-control

[![npm](https://img.shields.io/npm/v/homebridge-netatmo-home-control)](https://www.npmjs.com/package/homebridge-netatmo-home-control)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

Homebridge plugin for **Netatmo Home + Control** — exposes Legrand / BTicino / Netatmo wired smart-home devices (switches, dimmable lights, shutters) to Apple HomeKit.

## Supported devices

| Type | Netatmo model IDs | HomeKit service |
|------|-------------------|-----------------|
| On/Off switch | NLL, NLM, NLIS, BNCS | Switch |
| Power outlet | NLP, NLPM, NLPO, NLPT | Switch |
| Cable outlet (radiator, towel warmer…) | NLC | Switch |
| Dimmer | NLF, NLFN, NLFE | Lightbulb (with brightness) |
| Shutter / roller blind | NLV, NLLV, NBR, NLJ | WindowCovering |

## Requirements

- A **Netatmo developer account** and registered app at [dev.netatmo.com](https://dev.netatmo.com/apps/createanapp)
- Netatmo Home + Control gateway paired with your devices
- Homebridge ≥ 1.3.0 / Node.js ≥ 18

## Installation

```bash
npm install -g homebridge-netatmo-home-control
```

Or install via the [Homebridge UI](https://github.com/homebridge/homebridge-config-ui-x).

## OAuth2 setup (first time only)

1. Create an app at [dev.netatmo.com](https://dev.netatmo.com/apps/createanapp).
2. Set the redirect URI to `http://localhost:3001/callback`.
3. Run the interactive helper:

```bash
npx homebridge-netatmo-home-control
```

4. Follow the prompts — it will open a browser, complete the OAuth2 flow, and print the `refresh_token` to paste into your Homebridge config.

## Configuration

Add to your Homebridge `config.json`:

```json
{
  "platforms": [
    {
      "platform": "NetatmoHomeControl",
      "name": "Netatmo Home + Control",
      "client_id": "YOUR_CLIENT_ID",
      "client_secret": "YOUR_CLIENT_SECRET",
      "refresh_token": "YOUR_REFRESH_TOKEN",
      "home_id": "",
      "poll_interval": 30
    }
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `client_id` | Yes | Client ID from dev.netatmo.com |
| `client_secret` | Yes | Client Secret from dev.netatmo.com |
| `refresh_token` | Yes | OAuth2 refresh token (obtained with the helper above) |
| `home_id` | No | Limit to a specific Netatmo home (leave empty for all) |
| `poll_interval` | No | Device state refresh interval in seconds (default: 30, min: 10) |

## How it works

The plugin polls the Netatmo API every `poll_interval` seconds to keep HomeKit state in sync. Commands (on/off, brightness, position) are sent immediately via the API when you control a device in the Home app.

Token refresh is handled automatically — no need to re-run the helper unless you revoke the app.

## Troubleshooting

- **No devices found** — check your credentials and that the app scopes include `read_magellan write_magellan read_bubendorff write_bubendorff`.
- **Token expired** — re-run `npx homebridge-netatmo-home-control` to get a new refresh token.
- Enable debug logging: add `"debug": true` in the Homebridge settings.

## License

MIT
