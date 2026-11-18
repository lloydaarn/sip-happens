# Sip Happens — Master Plan

Status: Initial implementation available. Automated core checks pass; hardware and two-PC acceptance pending.
Created: 2026-11-19
Project directory: D:\lab\dev\sip-happens

## 1. Product goal

Build a Windows hydration reminder that displays a blocking overlay at scheduled intervals. An administrator on another PC on the same LAN can dismiss the overlay. A local password provides a secondary, offline unlock method. Game Mode moves the reminder to a spare monitor while a full-screen application remains usable.

This is an application-level interruption, not a Windows security boundary. Task Manager, administrator actions, Windows security controls, and restarting the PC remain outside its enforcement guarantees. Unlocking acknowledges a reminder; it does not prove that water was consumed.

## 2. Confirmed requirements

- Product name: Sip Happens.
- Windows desktop client and a separate admin application on another PC.
- Both PCs communicate over the same LAN; no cloud service is required.
- Scheduled water reminders display an overlay.
- Primary dismissal method: remote admin unlock.
- Secondary dismissal method: a local password.
- Game Mode: when a full-screen app is present, show the overlay on another monitor instead of covering the full-screen app.

## 3. Proposed defaults and decisions to validate

These are implementation proposals, not additional user-confirmed requirements.

- Reminder interval: 120 minutes, configurable; this is a scheduling default, not medical advice.
- Optional daily active hours.
- Successful dismissal restarts the interval from the time of dismissal.
- Normal mode covers every connected monitor.
- Game Mode is admin-controlled and avoids stealing keyboard focus.
- Prefer a configured spare display; otherwise choose one not occupied by a full-screen app.
- If every display is occupied, or only one display exists, defer the overlay until a display becomes available. Show the pending reminder to the admin.
- When full-screen mode ends, an outstanding reminder returns to the normal all-monitor overlay after a short stabilization delay.
- Separate “Unlock current reminder” from “Pause future reminders.”
- Launch at sign-in is optional and explicitly enabled during setup.
- Start with one admin and one client; use device identities so additional clients can be supported later.
- Password recovery policy must be chosen before distribution. Do not ship a universal bypass password.

## 4. Technology

Recommended stack: Electron, TypeScript, and React for the client and admin applications. This replaces the earlier native C#/WPF proposal, subject to confirmation during implementation kickoff.

- Electron main process: scheduling, overlay lifecycle, tray integration, local storage, and privileged operations.
- React renderer: settings, reminder presentation, and admin dashboard.
- Node.js service embedded in the admin application: LAN pairing, authenticated sessions, device status, and unlock commands.
- Secure WebSockets: persistent client-to-admin connection with acknowledgments.
- Windows-native helper or Node addon: inspect external window bounds, visibility, and display placement to detect full-screen applications. Select the maintained integration approach in a technical spike.
- Local JSON: validated configuration and non-secret preferences. No database required for the initial version.
- Windows-backed secret storage: device credentials and private keys; salted password hash for local password verification.
- Shared TypeScript schemas: protocol messages, settings, and state definitions.
- Unit/integration test runner selected during scaffolding; packaged Windows smoke tests for native behavior.
- Produce separate Windows client and admin installers. Select the Electron packaging tool during scaffolding.

Keep Node integration disabled in renderers, enable context isolation and sandboxing, expose narrow preload APIs, validate IPC senders and arguments, and load only packaged UI content.

## 5. Application responsibilities

### Client

- First-run password setup and admin pairing.
- Configurable reminder interval and active hours, subject to admin policy.
- Tray status with time until the next reminder and connection status.
- One overlay window per target display.
- Reject ordinary overlay close actions while a reminder remains pending.
- Handle remote unlock and password fallback through the same state transition.
- Preserve local scheduling when the admin is offline.
- Reconnect automatically with bounded exponential backoff.
- Handle sleep/resume, monitor changes, mixed display scaling, and application restarts.
- Prevent duplicate client instances.

### Admin

- Run the LAN service while the admin app is running, including when minimized to the tray.
- Pair and revoke clients.
- Display device name, connection status, last seen time, reminder state, and Game Mode/deferred status.
- Unlock the current reminder on a selected device.
- Report success only after the client acknowledges dismissal.
- Distinguish pending, acknowledged, expired, rejected, and disconnected command outcomes.
- Offer separate controls for schedule configuration and pausing reminders.
- Record minimal local events for pairing, reminder activation, and unlock outcomes. Never log passwords or credentials.

## 6. LAN connection and authorization

1. Admin starts a TLS-protected WebSocket service on a configurable port.
2. Client enters the admin IP/hostname and completes an explicit pairing flow.
3. Use a short-lived, rate-limited pairing code plus certificate fingerprint verification or an equivalent authenticated pairing mechanism. Do not blindly trust an arbitrary certificate on first contact.
4. Issue unique device credentials and persist the trusted admin identity.
5. Authenticate subsequent connections and authorize commands per paired device.
6. Give commands a unique ID, target device ID, current reminder ID, and expiry time.
7. Reject expired, duplicate, wrong-device, and stale-reminder commands; duplicate delivery must not cause a second action.
8. Client acknowledges the applied result with the matching command and reminder IDs.

Use a private-network Windows Firewall rule for the admin service. Do not require port forwarding. Start with manual address entry and recommend a DHCP reservation; automatic LAN discovery is optional later work.

When the admin PC is off or unreachable, reminders continue locally and password unlock remains available. Unlocking offline must not be reversed by a stale command after reconnecting.

## 7. Reminder state and timing

Core reminder states:

- Scheduled: waiting for the next due time.
- Pending: due, with normal or Game Mode presentation selected.
- Deferred: due, but Game Mode has no spare display.
- Paused: future reminders suspended by policy.

Connection state is independent of reminder state. The client must not lose or dismiss a reminder simply because it disconnects.

Events include deadline reached, remote unlock, successful password entry, pause/resume, full-screen detection change, display change, sleep/resume, and active-hours boundary.

- Allow at most one outstanding reminder; do not stack missed reminders.
- Use monotonic elapsed timing during a running session and explicit wall-clock rules for active hours and restart recovery.
- Define sleep/resume policy: propose a short grace period, then at most one overdue reminder during active hours.
- Persist enough state to recover an outstanding reminder after restart without replaying previous acknowledgments.
- Password verification must not freeze the UI. Rate-limit repeated failures.
- Apply remote and local unlock atomically so simultaneous attempts dismiss only once.

## 8. Overlay and Game Mode

Normal presentation covers each monitor with a borderless overlay containing the reminder, connection status, and password fallback entry. Remote unlock closes all overlay windows associated with the same reminder.

Game Mode detection must examine external visible windows, exclude Sip Happens and desktop/shell windows, and compare window bounds to monitor bounds with DPI-aware tolerances. A maximized window should not automatically count as full-screen. Test both borderless and exclusive full-screen games; detection is heuristic and must have a manual override if needed.

In Game Mode:

- Keep the display occupied by the full-screen application usable.
- Show the reminder on a spare monitor without activating the overlay window or grabbing global keyboard input.
- Password input receives focus only after an intentional user interaction.
- Re-evaluate monitor placement after hot-plug, resolution, DPI, or full-screen changes.
- If the spare monitor disconnects, use the no-spare-display policy rather than unexpectedly covering the game.
- Debounce transitions to avoid flicker or repeated window creation.
- Avoid relying solely on the foreground window: a game may remain full-screen when the user clicks the password field on another display.

The Game Mode overlay does not lock the gaming display. The admin should clearly see that the reminder is pending while the game remains available.

## 9. Suggested repository structure

apps/client/          Electron client main, preload, and renderer
apps/admin/           Electron admin main, LAN service, preload, and renderer
packages/protocol/    Shared validated messages and types
packages/core/        Reminder state machine and scheduling logic
packages/windows/     Windows full-screen detection integration
packages/ui/          Shared UI components and theme
 tests/               Integration and packaged Windows test scenarios
 docs/                Architecture, setup, and operational decisions

## 10. Delivery phases

### Phase 1 — Foundation and feasibility

- Scaffold the TypeScript workspace and two Electron applications.
- Verify overlay placement on multiple displays with mixed DPI.
- Verify no-focus display while a game is active.
- Prototype full-screen detection for borderless and exclusive modes.
- Select the native helper and packaging approach based on the spike results.

Exit: both apps launch, and Game Mode feasibility is demonstrated on Windows.

### Phase 2 — Local reminder MVP

- Implement the reminder state machine, interval settings, and tray status.
- Add first-run password setup, secure hash storage, and verification.
- Implement normal overlays and password dismissal.
- Handle one-instance enforcement, sleep/resume, and restart recovery.

Exit: one client completes a scheduled reminder and password unlock cycle reliably.

### Phase 3 — LAN administration

- Add authenticated pairing, TLS, device identity, and revocation.
- Add reconnect behavior and client status reporting.
- Implement reminder-specific unlock commands and acknowledgments.
- Add admin dashboard and local event history.

Exit: the second PC can reliably unlock the client over LAN; offline password fallback works.

### Phase 4 — Game Mode

- Integrate full-screen detection and preferred spare-monitor selection.
- Add no-focus overlays, deferred reminders, and stable transitions.
- Handle multiple full-screen applications and monitor disconnection.
- Expose Game Mode status and controls to the admin.

Exit: a game remains usable while the reminder appears on the spare monitor, and both unlock paths work.

### Phase 5 — Packaging and acceptance

- Produce client and admin installers.
- Add optional launch at sign-in and document the private-network firewall rule.
- Finalize password recovery and configuration permissions.
- Verify installation, upgrade, uninstall, and clean-machine startup.
- Document setup, pairing, troubleshooting, and known limitations.

Exit: two PCs can install, pair, run reminders, and unlock without developer tools.

## 11. Acceptance tests

- A due reminder covers all monitors in normal mode.
- Incorrect passwords cannot dismiss it; the correct password dismisses all windows.
- Escape, Alt+F4, and ordinary window-close actions do not dismiss a pending overlay.
- An authorized admin unlock dismisses only the intended current reminder.
- Unpaired, revoked, expired, replayed, and wrong-reminder commands have no effect.
- Admin success is shown only after acknowledgment; disconnects show an uncertain or failed outcome accurately.
- When offline, scheduling and password fallback continue to work.
- Reconnection cannot unlock a newer reminder with an older command.
- In Game Mode, the overlay appears on a spare monitor without taking game focus.
- Full-screen browsers/video applications are supported as well as games.
- If no display is spare, the reminder follows the documented deferral policy.
- Exiting full-screen mode restores normal presentation for an outstanding reminder.
- Display hot-plug and DPI changes do not leave invisible blocking windows.
- Sleep/resume and restart do not produce duplicate reminders.
- Concurrent local and remote unlocks resolve once and schedule one next reminder.
- Packaged apps operate on a supported Windows machine without Node.js installed.

Use unit tests for state transitions, timing, protocol validation, and password verification; integration tests for pairing and command delivery; manual two-PC Windows tests for focus, full-screen games, firewall behavior, and monitor changes.

## 12. Out of scope for the first release

- Internet-based remote administration or cloud accounts.
- Kernel drivers, suppression of Windows security controls, or tamper-proof enforcement.
- Verification that a user actually drank water.
- Medical hydration prescriptions.
- Mobile apps, analytics services, or organization-wide fleet management.

## 13. Next implementation step

Run docs/ACCEPTANCE.md against the initial implementation. See README.md for setup and remaining release work.
