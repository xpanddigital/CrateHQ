# CrateHQ Instagram DM Agent

A background service that monitors an Instagram account's Direct Messages and forwards them to CrateHQ. It also picks up outbound replies queued in CrateHQ and sends them through Instagram.

This agent runs alongside **FlowChat** (a Chrome extension that handles outbound DMs via the browser). A lock-file mechanism prevents both tools from hitting Instagram at the same time.

## Prerequisites

- **Python 3.10 or newer** — check with `python3 --version` (Linux) or `python --version` (Windows)
- **pip** — comes bundled with Python. If missing: `python3 -m ensurepip` (Linux) or `python -m ensurepip` (Windows)
- A **static residential proxy** (e.g. IPRoyal) already configured on the VM
- Your Instagram account credentials
- Your CrateHQ webhook secret

---

## Installation

### Linux

```bash
cd ~
git clone <repo-url> dm-agent   # or copy the dm-agent folder to the VM
cd dm-agent
chmod +x install_linux.sh
./install_linux.sh
```

### Windows

1. Open **Command Prompt** (not PowerShell)
2. Navigate to the `dm-agent` folder
3. Run:

```bat
install_windows.bat
```

---

## Configuration

Open `config.json` in any text editor and fill in every field:

| Field | What to put here |
|---|---|
| `ig_account_id` | A unique identifier for this account (e.g. `acct_01`). Must match what CrateHQ expects. |
| `ig_username` | The Instagram username (without `@`). |
| `ig_password` | The Instagram password. |
| `proxy` | Your residential proxy URL in the format `http://user:pass@host:port`. **Must be the same proxy the VM's browser uses.** |
| `cratehq_base_url` | Your CrateHQ app URL, e.g. `https://your-app.vercel.app`. No trailing slash. |
| `webhook_secret` | The secret token from CrateHQ for authenticating webhook calls. |
| `timezone` | Your operating timezone, e.g. `America/Los_Angeles`, `America/New_York`, `Europe/London`. |
| `active_start_hour` | Hour (0-23) when the agent should start polling. Default `8` = 8 AM. |
| `active_end_hour` | Hour (0-23) when the agent should stop polling. Default `22` = 10 PM. |
| `winddown_start_hour` | Hour (0-23) when the agent switches to a slower poll rate. Default `20` = 8 PM. |
| `poll_interval_active_sec` | Seconds between polls during active hours. Default `180` (3 minutes). Minimum enforced: 120. |
| `poll_interval_winddown_sec` | Seconds between polls during wind-down. Default `600` (10 minutes). |

---

## Running Manually (for testing)

### Linux

```bash
cd ~/dm-agent
source venv/bin/activate
python dm_agent.py
```

### Windows

```bat
cd C:\Users\YourName\dm-agent
venv\Scripts\activate
python dm_agent.py
```

Press `Ctrl+C` to stop.

---

## Auto-Start on Boot

### Linux (systemd)

1. Edit the service file to replace `YOUR_USERNAME` with your actual Linux username:

```bash
sed -i 's/YOUR_USERNAME/your_actual_username/g' dm-agent.service
```

2. Copy it into systemd and enable:

```bash
sudo cp dm-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable dm-agent
sudo systemctl start dm-agent
```

3. Check status:

```bash
sudo systemctl status dm-agent
```

### Windows (Task Scheduler)

1. Open **Task Scheduler** (search for it in the Start menu)
2. Click **Create Basic Task**
3. Name: `CrateHQ DM Agent`
4. Trigger: **When the computer starts**
5. Action: **Start a program**
   - Program: `C:\Users\YourName\dm-agent\venv\Scripts\python.exe`
   - Arguments: `dm_agent.py`
   - Start in: `C:\Users\YourName\dm-agent`
6. Check **"Run whether user is logged on or not"** in the task properties
7. Click Finish

---

## Checking Logs

Logs are written to `dm_agent.log` in the dm-agent folder and also printed to the console.

### Linux

```bash
# Live tail
tail -f ~/dm-agent/dm_agent.log

# Last 50 lines
tail -n 50 ~/dm-agent/dm_agent.log

# Search for errors
grep "ERROR" ~/dm-agent/dm_agent.log
```

### Windows

```bat
type dm_agent.log
```

Or open `dm_agent.log` in Notepad.

---

## Stopping / Restarting

### Linux (systemd)

```bash
sudo systemctl stop dm-agent      # Stop
sudo systemctl restart dm-agent   # Restart
sudo systemctl status dm-agent    # Check status
```

### Linux (manual)

Press `Ctrl+C` in the terminal, or:

```bash
pkill -f dm_agent.py
```

### Windows

End the `python.exe` process in Task Manager, or stop the scheduled task.

---

## Troubleshooting

### `LoginRequired` error

The saved session has expired. The agent will automatically attempt a re-login. If it keeps failing:

1. Stop the agent
2. Delete `session.json`
3. Restart the agent — it will do a fresh login

If Instagram still rejects the login, the password may have changed or the account may be locked.

### `ChallengeRequired` or `SelectContactPointRecoveryForm`

Instagram is asking for a verification code (SMS, email, or in-app confirmation).

1. Open Instagram on the phone linked to the account
2. Complete the verification challenge
3. Restart the agent

This cannot be bypassed programmatically — it requires manual human action.

### Proxy errors (`ProxyError`, `ConnectionError`)

- Verify the proxy URL in `config.json` is correct
- Check that the proxy is online: `curl -x http://user:pass@host:port https://www.instagram.com`
- Make sure the proxy matches the VM's browser proxy exactly
- Contact your proxy provider (e.g. IPRoyal) if the proxy is down

### `Connection refused` to CrateHQ

- Check that `cratehq_base_url` in `config.json` is correct and accessible from the VM
- Try: `curl https://your-app.vercel.app/api/dm-agent/heartbeat`
- Check if Vercel is experiencing an outage

### Agent keeps restarting (systemd)

Check the logs for the root cause:

```bash
journalctl -u dm-agent -n 100 --no-pager
```

Common causes: bad credentials, expired proxy, Instagram challenge.

### "FlowChat active, skipping cycle" every time

The lock file exists and is being refreshed constantly. Check:

- Linux: `ls -la /tmp/flowchat_active.lock`
- Windows: `dir C:\temp\flowchat_active.lock`

If FlowChat is not actually running, delete the stale lock file and restart the agent.
