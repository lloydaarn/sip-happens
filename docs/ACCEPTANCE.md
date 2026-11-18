# Windows acceptance checklist

Run on two Windows PCs before distribution; record OS, display topology/scaling, application, and result for each case.

- Install both unsigned installers on machines without Node.js; launch, upgrade, uninstall.
- Set a one-minute schedule. Verify every monitor is covered and Escape/Alt+F4 cannot dismiss.
- Verify wrong password rejection and throttling; correct password closes every overlay.
- Pair with copied fingerprint; reject mismatched fingerprint, wrong/expired code, and revoked credentials.
- Unlock remotely; verify success appears only after client acknowledgment. Disconnect during delivery and verify disconnected/expired outcome.
- Disconnect admin; complete a password unlock, reconnect, and verify stale commands cannot dismiss a newer reminder.
- Try simultaneous password and remote dismissal; verify only one next deadline.
- Restart while pending; verify reminder restored. Sleep past deadline; verify 15-second resume grace and only one reminder.
- Enable Game Mode with borderless game, exclusive game, and browser full-screen; verify spare-monitor overlay does not steal focus.
- Click password on spare display; verify game stays excluded. Unplug spare display; verify deferral.
- Exit full-screen; verify normal presentation after stabilization. Test mixed DPI, resolution changes, and multiple occupied displays.
- Verify private-network firewall behavior, startup checkbox and tray lifecycle.

Pending engineering follow-up: automated TLS pairing/revocation integration suite; installer signing and branded icon; preferred-monitor UI; schedule acknowledgment and persistence visibility in admin; heartbeat-based silent network failure detection; storage corruption recovery. Do not treat the manual acceptance criteria as completed by unit tests.
