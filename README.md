# Sip Happens

Windows Electron client and LAN admin application. This is an application-level reminder, not a Windows security boundary.

## Download for Windows

Download the installers from [GitHub Releases](https://github.com/lloydaarn/sip-happens/releases/tag/v0.1.5):

- [Client installer](https://github.com/lloydaarn/sip-happens/releases/download/v0.1.5/Sip-Happens-Client-Setup-0.1.5.exe): install on the reminder PC.
- [Admin installer](https://github.com/lloydaarn/sip-happens/releases/download/v0.1.5/Sip-Happens-Admin-Setup-0.1.5.exe): install on the controlling PC.

No Node.js or source checkout is needed. Both PCs should be on the same LAN. These are unsigned preview installers; hardware acceptance testing is still pending. SHA256SUMS.txt is included with the release for verifying downloads. If the repository is private, sign in to GitHub on the second PC with an account that has access.

## Run from source

Install Node.js 24, then run `npm.cmd ci`. Use `npm.cmd run client` on the client PC and `npm.cmd run admin` on the admin PC. Development uses separate role-specific Windows application-data directories.

1. Create a client password of at least 10 characters before reminders start.
2. On the admin, generate a pairing code. On the client, enter the admin LAN address, port 9443, the certificate fingerprint copied directly from the admin screen, and the code.
3. Allow the admin executable through Windows Firewall on **Private networks only**. Do not forward the port on your router. A DHCP reservation keeps the admin address stable.
4. Apply the schedule from the admin device card. The default interval is 120 minutes; equal active-hour boundaries mean all day. Pause suspends future reminders and preserves any current reminder.
5. Unlock the pending reminder from its device card. Only an acknowledged result confirms dismissal. Offline clients retain password fallback.

Game Mode defers on a single occupied monitor and uses a spare monitor when available. Detection samples visible borderless windows every two seconds, with a stabilization delay. Detector failure defers rather than covering a game. Disable Game Mode from the admin for a manual normal-mode override. Full-screen detection is heuristic; exclusive games and mixed-DPI configurations need hardware validation.

## Build and verify

- `npm.cmd run typecheck`
- `npm.cmd test`
- `npm.cmd run build`
- `npm.cmd run package:client`
- `npm.cmd run package:admin`

Installers are written to `release/client` and `release/admin`. They are unsigned and currently use the default Electron icon. Windows may show an unknown-publisher prompt.

## Storage and recovery

Settings and state are atomically replaced in `%APPDATA%/sip-happens-client/state.json` and the corresponding admin directory. Credentials and the TLS private key use Electron safeStorage (Windows DPAPI). Passwords use salted asynchronous scrypt. Pairing codes last two minutes, allow at most ten attempts globally, and are consumed on success. Pairing is explicitly certificate-pinned before credentials are transmitted.

There is no universal recovery password. For this initial build, recovery requires the Windows account owner to exit the process and rename its state file, then set up and pair again. This discards its reminder state. Revoking a client invalidates its existing credential; re-pair explicitly to restore access. This account-owner recovery policy is appropriate to an application-level interruption, not tamper-proof enforcement.

## Release status

This is an initial implementation, pending acceptance testing. The automated tests cover reminder transitions, active hours, password verification, command rejection and display selection. They do not establish two-PC LAN interoperability or Windows focus behavior. See [acceptance checklist](docs/ACCEPTANCE.md). The admin port can be changed in its state file while stopped; the client pairing form accepts the selected port. Preferred display selection is supported by the settings schema but currently lacks a UI control.

Electron window isolation and inactive presentation follow the [Electron BrowserWindow documentation](https://www.electronjs.org/docs/latest/api/browser-window).

## Admin-controlled demo (0.1.3+)

Update both apps, pair the normal client, then open its device card in the admin. **Demo controls** sends events directly to that client; no extra app or password setup is needed. Controls explain when a client is offline or needs an update.

- Trigger reminder now, simulate full-screen, no spare display, exit full-screen, or simulate overdue resume.
- Use the regular Unlock current reminder button to test authenticated dismissal.
- End demo / restore schedule returns to the original reminder deadline and policy. A demo cannot start while a real reminder is pending; dismiss that reminder first.
- The client displays a Demo active banner and an End demo button, including on overlays. Demo also ends on connection loss or after five minutes without demo commands.
- Normal state is preserved on disk throughout the demo, so restarting restores the real schedule. Password fallback works if already configured; admin unlock and End demo do not require a new password.
- Command outcomes show pending, acknowledged, rejected, expired or disconnected. Only acknowledgment confirms the client applied a demo event.
- Display simulation uses actual monitors: one occupied monitor means no spare display. Disconnect simulation is omitted because the admin needs its connection to control and end the demo.

## Automatic updates and startup (0.1.1+)

Install 0.1.1 manually once on each PC: 0.1.0 has no updater. Installed apps check GitHub Releases after ten seconds and every hour, download newer stable releases, and install on an explicit tray Exit. Closing the main window hides it; it does not quit or install an update. A downloaded update also offers Restart and install; pending client reminders must be dismissed first. Updates never force a restart while the app is running.

Enable **Launch minimized to tray at Windows sign-in** in each installed app. Startup uses `--startup` to keep the dashboard hidden; reminder overlays still appear when due. Open the dashboard from the tray or launch the shortcut again. Demo mode does not register sign-in or download updates.

The public GitHub repository supplies separate `client.yml` and `admin.yml` update channels, preventing either app from downloading the other installer. No GitHub token is included in the apps. For each future version: bump package.json/package-lock.json, test, build both installers, then publish a stable GitHub Release containing both EXEs, both blockmaps and both role YAML files. Keep the release draft until every file is uploaded. Source edits alone do not update installed apps.

If startup fails to decrypt credentials, the app now reports the error and exits. Preserve the state file before recovery; do not delete paired-device state casually. Windows-protected credentials may not transfer between test/installed builds or Windows accounts.

The version appears at the top of every app screen. Admin **Force update admin and clients now** queues a request for every paired client and immediately checks the admin. Connected clients check immediately; offline requests persist until reconnect. Each app downloads the latest stable release and restarts as soon as ready, even during a pending reminder (saved state restores it). This explicit action can interrupt the app; regular automatic checks still wait for Exit. The device card shows the last reported client version and update status. An accepted request is not proof installation completed: verify its version after reconnection. Clients older than 0.1.1 must first be upgraded manually.

## Reporting connection problems (0.1.2+)

Open **Connection diagnostics** on both PCs. It shows the current error code, attempted endpoint, timestamps, attempt count, retry time and suggested next step. **Copy diagnostic report** copies a bounded history from this session together with app/OS version. Review it before sharing: it includes the LAN address, but no passwords, pairing codes, device tokens, private keys or arbitrary server error text.

Update both apps for explicit expired-code, invalid-code, attempt-limit and revoked-device rejection messages. Older admins may only produce CLOSED. REFUSED means the destination rejected the TCP connection; TIMEOUT suggests checking network/firewall settings but does not diagnose a firewall by itself. FINGERPRINT and AUTH_REJECTED stop automatic retries until you correct the pairing. Game Mode detection errors are displayed separately and cannot erase connection diagnostics.

## Reminder presentation (0.1.4+)

Normal reminders use a borderless fullscreen window per display, above the taskbar. The left third contains reminder status and password unlock; the right two thirds displays bundled stock photographs illustrating thirst, fatigue and headache with general NHS-based symptom captions. Photos are posed illustrations, not diagnoses of the pictured people. Credits and sources are in docs/PHOTO_CREDITS.md. Slides rotate every 12 seconds, with Pause, Next and direct slide controls. Reduced-motion preferences start the slideshow paused and disable transitions.

Trigger reminder now in the admin demo explicitly returns to normal all-display mode. To test a spare display, trigger a reminder first, then simulate full-screen or no-spare-display placement. Game Mode continues to exclude occupied displays.


Version 0.1.5 adds four user-supplied memes as uncropped, image-only slides with no app-added captions. Slideshow controls live in the left panel so nothing covers meme text. The supplied headache image replaces the previous stock photo.
