# Sip Happens

Windows Electron client and LAN admin application. This is an application-level reminder, not a Windows security boundary.

## Download for Windows

Download the installers from [GitHub Releases](https://github.com/lloydaarn/sip-happens/releases/tag/v0.1.1):

- [Client installer](https://github.com/lloydaarn/sip-happens/releases/download/v0.1.1/Sip-Happens-Client-Setup-0.1.1.exe): install on the reminder PC.
- [Admin installer](https://github.com/lloydaarn/sip-happens/releases/download/v0.1.1/Sip-Happens-Admin-Setup-0.1.1.exe): install on the controlling PC.

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

## Demo mode

Click **Open demo mode** in the client, or run `npm.cmd run demo` from source. The packaged client also accepts `--demo`. Create a demo password on first launch. The demo uses a separate `sip-happens-client-demo` profile and can run alongside the regular client. Its password and pairing persist; its schedule and simulation reset each launch.

The demo panel is available in the main window and reminder overlays:

- **Trigger reminder now** bypasses the wait and active-hours/pause policy for this demo event. Repeated clicks retain the same pending reminder.
- **Simulate full-screen** treats the first physical display as occupied. A spare monitor gets the overlay; a single monitor defers it.
- **No spare display** marks every physical display occupied; **Exit full-screen** restores normal all-monitor coverage. Trigger a reminder separately to see these placements.
- **Disconnect admin** closes the real demo connection and holds reconnect attempts. **Reconnect admin** uses the saved demo pairing; it does not pretend an unreachable admin is connected.
- **Simulate overdue resume** sets the deadline overdue and applies the normal 15-second grace period. Pause and active hours still apply. Reset first for a fresh default schedule.
- **Reset demo** clears the demo reminder, returns scheduling and display behavior to defaults, and restores connection attempts. Password and pairing are retained.

Pair this separate demo client with the admin to test real remote acknowledgments. The admin labels its device card `(demo)`. Password and remote unlock use the normal dismissal paths. Normal clients cannot invoke demo events or use the demo reset. Display simulation does not launch games or emulate physical hot-plug/focus behavior.

## Automatic updates and startup (0.1.1+)

Install 0.1.1 manually once on each PC: 0.1.0 has no updater. Installed apps check GitHub Releases after ten seconds and every hour, download newer stable releases, and install on an explicit tray Exit. Closing the main window hides it; it does not quit or install an update. A downloaded update also offers Restart and install; pending client reminders must be dismissed first. Updates never force a restart while the app is running.

Enable **Launch minimized to tray at Windows sign-in** in each installed app. Startup uses `--startup` to keep the dashboard hidden; reminder overlays still appear when due. Open the dashboard from the tray or launch the shortcut again. Demo mode does not register sign-in or download updates.

The public GitHub repository supplies separate `client.yml` and `admin.yml` update channels, preventing either app from downloading the other installer. No GitHub token is included in the apps. For each future version: bump package.json/package-lock.json, test, build both installers, then publish a stable GitHub Release containing both EXEs, both blockmaps and both role YAML files. Keep the release draft until every file is uploaded. Source edits alone do not update installed apps.

If startup fails to decrypt credentials, the app now reports the error and exits. Preserve the state file before recovery; do not delete paired-device state casually. Windows-protected credentials may not transfer between test/installed builds or Windows accounts.
