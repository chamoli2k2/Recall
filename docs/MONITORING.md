# External health monitoring

Recall's server never schedules requests to itself. All scheduling lives outside the application, on a machine that keeps running when Recall does not. This document covers the endpoints, the ping script, and how to schedule it.

## Endpoints

| Endpoint | Type | Checks | Success | Failure |
| --- | --- | --- | --- | --- |
| `GET /api/health` | Liveness | Express is handling requests. No database call. | `200` | Connection refused / timeout (process is down or asleep) |
| `GET /api/ready` | Readiness | MongoDB answers `ping` within `READINESS_TIMEOUT_MS` (default 2000 ms, clamped 100–10000). | `200 {"ok":true,"status":"ready","checks":{"database":"up"}}` | `503 {"ok":false,"status":"unavailable","checks":{"database":"down"}}` |

**Liveness** answers "is the process alive?" and is what you hit to wake an idle host. **Readiness** answers "can it serve users right now?", and a live process with a dead database is not ready. Alerting should watch readiness; wake-up pings can use liveness. Both are public, are rate limited with the rest of `/api` (300 requests/minute per IP, so a 5-minute schedule is nowhere near that), and never include connection strings, stack traces, or driver error text.

## The ping script

`scripts/healthcheck.js` needs Node 22 or newer, uses the built-in `fetch`, and has no npm dependencies, so it can be copied alone to the monitoring machine.

| Behaviour | Value |
| --- | --- |
| Target | `HEALTHCHECK_URL` environment variable (must be `http://` or `https://`) |
| Timeout | 10 seconds per attempt (`AbortController`) |
| Retries | At most one (two attempts total) |
| Healthy | HTTP `200` exactly; redirects and other 2xx/3xx are failures |
| Logs | One ISO-8601 timestamped line per attempt on stdout (`info`) or stderr (`warn`/`error`) |
| Exit code | `0` healthy, `1` unhealthy after retry, `2` `HEALTHCHECK_URL` missing or invalid |

```bash
HEALTHCHECK_URL=https://recall.example.com/api/health node scripts/healthcheck.js
# 2026-09-21T18:14:24.151Z [info] healthy: HTTP 200 in 42ms (attempt 1/2) https://recall.example.com/api/health
```

## Scheduling every 5 minutes

Pick one. Each runs on **your** always-on machine or a hosted runner, not on the Recall host. Replace `/path/to/Recall` and the URL.

### cron (Linux, macOS, any VPS)

`scheduling/crontab.example`:

```bash
crontab -e
```

```cron
HEALTHCHECK_URL=https://recall.example.com/api/health
*/5 * * * * /usr/bin/env node /path/to/Recall/scripts/healthcheck.js >> "$HOME/recall-healthcheck.log" 2>&1
```

If `node` is not on cron's minimal `PATH`, use its absolute path (`which node`). Verify with `tail -f ~/recall-healthcheck.log` after five minutes.

### systemd timer (Linux)

```bash
mkdir -p ~/.config/systemd/user
cp scheduling/systemd/recall-healthcheck.{service,timer} ~/.config/systemd/user/
# edit Environment= and ExecStart= in the .service file
systemctl --user daemon-reload
systemctl --user enable --now recall-healthcheck.timer
systemctl --user list-timers            # confirm next run
journalctl --user -u recall-healthcheck  # logs
```

Enable lingering (`loginctl enable-linger $USER`) so user timers run without an interactive login.

### GitHub Actions (hosted runner)

Copy `scheduling/github-actions-healthcheck.yml.example` to `.github/workflows/healthcheck.yml` in a repository you control, then add a repository **variable** `HEALTHCHECK_URL`. The example is intentionally not placed under `.github/workflows/` here so nothing becomes active by merely cloning this repo. GitHub's `schedule` trigger is best-effort: runs can be delayed under load, and schedules are disabled on repositories with no activity for 60 days.

### macOS launchd

Cron works on macOS, but a `launchd` agent survives sleep/wake better. A minimal `~/Library/LaunchAgents/com.recall.healthcheck.plist` with `StartInterval` `300`, `EnvironmentVariables` → `HEALTHCHECK_URL`, and `ProgramArguments` → `[/usr/local/bin/node, /path/to/Recall/scripts/healthcheck.js]`, loaded with `launchctl load -w`, is sufficient.

## Using a hosted HTTP monitor instead of the script

Any uptime service can call the endpoint directly; the script is not required:

- **Check URL:** `https://<your-host>/api/health` (liveness / keep-warm) and optionally `https://<your-host>/api/ready` (readiness / database).
- **Method:** `GET`. **Interval:** 5 minutes. **Expected status:** `200`. Optionally assert the body contains `"ok":true`.
- **Timeout:** 10 seconds is reasonable; a cold start on a sleeping host may take several seconds.
- Alert on readiness failures; treat a single liveness failure as a possible cold start and alert after two or more consecutive failures.

Examples of services with free tiers that support this: UptimeRobot, Better Stack, Healthchecks.io (in "ping the URL" mode), Cronitor, and cloud-provider uptime checks. This repository does not provision, configure, or pay for any of them. Sign up and paste the URL yourself.

## Expectations and limits

- **Fewer idle shutdowns, not zero.** Free-tier hosts that sleep after ~15 minutes of inactivity usually stay warm with a 5-minute ping, but the provider decides, and the policy can change.
- **No uptime guarantee.** The ping proves reachability at one moment from one network; it does not prevent crashes, deploy downtime, or database outages.
- **Usage limits still apply.** Pings consume the host's request/instance-hour allowance like any other traffic and cannot bypass monthly caps or forced sleeps once a quota is exhausted. If keeping the app warm exhausts the quota sooner, the ping made things worse, so measure.
- **Schedulers have their own gaps.** cron on a laptop stops when the lid closes; GitHub schedules drift; hosted monitors have outages. For meaningful availability numbers use a dedicated monitoring service with an SLA.
- **Why no self-ping.** `setInterval`/`node-cron` inside the server dies with the process it is supposed to keep alive, cannot fire while the host is asleep, and only proves the process can reach itself. It also runs once per replica, multiplying traffic. External scheduling has none of these problems.
