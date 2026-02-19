#!/usr/bin/env python3
"""
CrateHQ Instagram DM Agent
===========================
Polls an Instagram account's DM inbox via instagrapi (Mobile API) and forwards
new inbound messages to the CrateHQ webhook.  Also fetches pending outbound
replies from CrateHQ and sends them through Instagram.

Designed to run as a long-lived background service on a Windows or Linux VM
alongside the FlowChat Chrome extension (which handles outbound DMs via the
Desktop web API).  A lock-file mechanism prevents both tools from hitting
Instagram at the same time.
"""

import hashlib
import json
import logging
import os
import platform
import random
import sys
import time
import traceback
from datetime import datetime, timedelta
from pathlib import Path

import pytz
import requests
from instagrapi import Client
from instagrapi.exceptions import (
    ChallengeRequired,
    LoginRequired,
    SelectContactPointRecoveryForm,
)

# ---------------------------------------------------------------------------
# Paths (resolved relative to the script's own directory)
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "config.json"
SESSION_PATH = BASE_DIR / "session.json"
LAST_SEEN_PATH = BASE_DIR / "last_seen.json"
LOG_PATH = BASE_DIR / "dm_agent.log"

# ---------------------------------------------------------------------------
# Android device profiles – real-world devices used for deterministic mapping
# ---------------------------------------------------------------------------
DEVICE_PROFILES = [
    {"manufacturer": "Samsung", "model": "SM-G998B",  "android_version": 33, "android_release": "13", "app_version": "302.1.0.36.111", "dpi": "640dpi", "resolution": "1440x3200"},
    {"manufacturer": "Samsung", "model": "SM-S908B",  "android_version": 34, "android_release": "14", "app_version": "305.0.0.34.110", "dpi": "600dpi", "resolution": "1440x3088"},
    {"manufacturer": "Google",  "model": "Pixel 7 Pro","android_version": 34, "android_release": "14", "app_version": "305.0.0.34.110", "dpi": "560dpi", "resolution": "1440x3120"},
    {"manufacturer": "Google",  "model": "Pixel 8",    "android_version": 34, "android_release": "14", "app_version": "306.0.0.35.109", "dpi": "420dpi", "resolution": "1080x2400"},
    {"manufacturer": "OnePlus", "model": "CPH2449",    "android_version": 33, "android_release": "13", "app_version": "302.1.0.36.111", "dpi": "450dpi", "resolution": "1240x2772"},
    {"manufacturer": "Xiaomi",  "model": "2210132G",   "android_version": 33, "android_release": "13", "app_version": "302.1.0.36.111", "dpi": "440dpi", "resolution": "1220x2712"},
    {"manufacturer": "Samsung", "model": "SM-A546B",   "android_version": 33, "android_release": "13", "app_version": "302.1.0.36.111", "dpi": "400dpi", "resolution": "1080x2340"},
    {"manufacturer": "Samsung", "model": "SM-G991B",   "android_version": 33, "android_release": "13", "app_version": "305.0.0.34.110", "dpi": "560dpi", "resolution": "1080x2400"},
    {"manufacturer": "Google",  "model": "Pixel 6a",   "android_version": 34, "android_release": "14", "app_version": "306.0.0.35.109", "dpi": "420dpi", "resolution": "1080x2400"},
    {"manufacturer": "OnePlus", "model": "NE2215",     "android_version": 34, "android_release": "14", "app_version": "305.0.0.34.110", "dpi": "525dpi", "resolution": "1440x3216"},
]

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------

def setup_logging() -> logging.Logger:
    """Configure logging to both stdout and a log file with ISO-8601 timestamps."""
    logger = logging.getLogger("dm_agent")
    logger.setLevel(logging.DEBUG)
    fmt = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z",
    )
    # Stdout handler
    sh = logging.StreamHandler(sys.stdout)
    sh.setLevel(logging.INFO)
    sh.setFormatter(fmt)
    logger.addHandler(sh)
    # File handler
    fh = logging.FileHandler(str(LOG_PATH), encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(fmt)
    logger.addHandler(fh)
    return logger


log = setup_logging()

# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------

def load_config() -> dict:
    """Load and validate config.json."""
    if not CONFIG_PATH.exists():
        log.error("config.json not found at %s – copy the template and fill in your values.", CONFIG_PATH)
        sys.exit(1)
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    required = [
        "ig_account_id", "ig_username", "ig_password", "proxy",
        "cratehq_base_url", "webhook_secret", "timezone",
        "active_start_hour", "active_end_hour", "winddown_start_hour",
        "poll_interval_active_sec", "poll_interval_winddown_sec",
    ]
    for key in required:
        if key not in cfg:
            log.error("Missing required config key: %s", key)
            sys.exit(1)
    return cfg


def load_last_seen() -> dict:
    """Load last_seen.json mapping thread_id -> last_seen_message_id."""
    if LAST_SEEN_PATH.exists():
        with open(LAST_SEEN_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_last_seen(data: dict) -> None:
    """Persist last_seen.json to disk."""
    with open(LAST_SEEN_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

# ---------------------------------------------------------------------------
# Device fingerprinting
# ---------------------------------------------------------------------------

def pick_device_profile(ig_account_id: str) -> dict:
    """Deterministically select a device profile based on account ID hash."""
    h = int(hashlib.sha256(ig_account_id.encode()).hexdigest(), 16)
    return DEVICE_PROFILES[h % len(DEVICE_PROFILES)]


def apply_device_profile(cl: Client, ig_account_id: str) -> None:
    """Set a unique device profile on the instagrapi Client."""
    prof = pick_device_profile(ig_account_id)
    cl.set_device({
        "manufacturer": prof["manufacturer"],
        "model": prof["model"],
        "android_version": prof["android_version"],
        "android_release": prof["android_release"],
        "app_version": prof["app_version"],
        "dpi": prof["dpi"],
        "resolution": prof["resolution"],
    })
    log.info("Device profile set: %s %s (Android %s)", prof["manufacturer"], prof["model"], prof["android_release"])

# ---------------------------------------------------------------------------
# Instagram session management
# ---------------------------------------------------------------------------

def build_client(cfg: dict) -> Client:
    """Create, configure, and authenticate an instagrapi Client."""
    cl = Client()

    # Proxy – MUST be set before any network call
    cl.set_proxy(cfg["proxy"])
    log.info("Proxy configured: %s", cfg["proxy"].split("@")[-1])  # log host only

    # Unique device fingerprint
    apply_device_profile(cl, cfg["ig_account_id"])

    # Randomised delay between consecutive API calls within a cycle
    cl.delay_range = [1, 3]

    # Session persistence
    if SESSION_PATH.exists():
        log.info("Loading existing session from %s", SESSION_PATH)
        cl.load_settings(str(SESSION_PATH))
        cl.login(cfg["ig_username"], cfg["ig_password"])
        try:
            cl.get_timeline_feed()  # lightweight check that session is alive
            log.info("Session is valid.")
        except LoginRequired:
            log.warning("Saved session expired – performing fresh login.")
            cl = Client()
            cl.set_proxy(cfg["proxy"])
            apply_device_profile(cl, cfg["ig_account_id"])
            cl.delay_range = [1, 3]
            cl.login(cfg["ig_username"], cfg["ig_password"])
    else:
        log.info("No existing session found – performing fresh login.")
        cl.login(cfg["ig_username"], cfg["ig_password"])

    cl.dump_settings(str(SESSION_PATH))
    log.info("Session saved to %s", SESSION_PATH)
    return cl

# ---------------------------------------------------------------------------
# HTTP helpers (CrateHQ communication)
# ---------------------------------------------------------------------------

def _cratehq_headers(cfg: dict) -> dict:
    return {
        "Authorization": f"Bearer {cfg['webhook_secret']}",
        "Content-Type": "application/json",
    }


def _request_with_retry(method: str, url: str, cfg: dict, **kwargs) -> requests.Response | None:
    """Make an HTTP request with up to 3 retries and exponential backoff."""
    headers = _cratehq_headers(cfg)
    for attempt in range(3):
        try:
            resp = requests.request(method, url, headers=headers, timeout=30, **kwargs)
            resp.raise_for_status()
            return resp
        except Exception as exc:
            wait = 2 ** (attempt + 1)  # 2, 4, 8
            log.warning("HTTP %s %s attempt %d failed: %s – retrying in %ds", method, url, attempt + 1, exc, wait)
            time.sleep(wait)
    log.error("HTTP %s %s failed after 3 attempts.", method, url)
    return None


def forward_message(cfg: dict, payload: dict) -> None:
    """POST an inbound message to the CrateHQ webhook."""
    url = f"{cfg['cratehq_base_url']}/api/webhooks/instagram-dm"
    _request_with_retry("POST", url, cfg, json=payload)


def fetch_pending_replies(cfg: dict) -> list:
    """GET pending outbound replies from CrateHQ."""
    url = f"{cfg['cratehq_base_url']}/api/dm-agent/pending-replies"
    resp = _request_with_retry("GET", url, cfg, params={"ig_account_id": cfg["ig_account_id"]})
    if resp is not None:
        try:
            return resp.json().get("messages", [])
        except Exception:
            log.warning("Failed to parse pending-replies response.")
    return []


def confirm_sent(cfg: dict, pending_message_id: str, ig_message_id: str) -> None:
    """POST confirmation that a reply was sent."""
    url = f"{cfg['cratehq_base_url']}/api/dm-agent/confirm-sent"
    _request_with_retry("POST", url, cfg, json={
        "pending_message_id": pending_message_id,
        "ig_message_id": ig_message_id,
    })


def send_heartbeat(cfg: dict, status: str, messages_found: int, messages_sent: int, error_detail: str | None = None) -> None:
    """POST a heartbeat to CrateHQ."""
    url = f"{cfg['cratehq_base_url']}/api/dm-agent/heartbeat"
    _request_with_retry("POST", url, cfg, json={
        "ig_account_id": cfg["ig_account_id"],
        "status": status,
        "messages_found": messages_found,
        "messages_sent": messages_sent,
        "error_detail": error_detail,
    })

# ---------------------------------------------------------------------------
# FlowChat lock-file coordination
# ---------------------------------------------------------------------------

def _lock_file_path() -> Path:
    if platform.system() == "Windows":
        return Path("C:/temp/flowchat_active.lock")
    return Path("/tmp/flowchat_active.lock")


def is_flowchat_active() -> bool:
    """Return True if FlowChat is currently active (lock file fresh within 5 min)."""
    lf = _lock_file_path()
    if not lf.exists():
        return False
    try:
        mtime = datetime.fromtimestamp(lf.stat().st_mtime)
        return datetime.now() - mtime < timedelta(minutes=5)
    except OSError:
        return False

# ---------------------------------------------------------------------------
# Time / schedule helpers
# ---------------------------------------------------------------------------

def now_in_tz(tz_name: str) -> datetime:
    return datetime.now(pytz.timezone(tz_name))


def seconds_until_hour(tz_name: str, target_hour: int) -> float:
    """Seconds from now until the next occurrence of target_hour:00 in the given timezone."""
    tz = pytz.timezone(tz_name)
    now = datetime.now(tz)
    target = now.replace(hour=target_hour, minute=0, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return (target - now).total_seconds()

# ---------------------------------------------------------------------------
# Main polling loop
# ---------------------------------------------------------------------------

def poll_cycle(cl: Client, cfg: dict, last_seen: dict) -> tuple[int, int, dict]:
    """
    Execute one poll cycle:
      1. Fetch unread threads
      2. Forward new messages to CrateHQ
      3. Send pending replies
    Returns (messages_found, messages_sent, updated_last_seen).
    """
    messages_found = 0
    messages_sent = 0

    # --- Inbound: read new DMs ---
    threads = cl.direct_threads(selected_filter="unread")
    log.info("Fetched %d unread thread(s).", len(threads))

    for thread in threads:
        thread_id = str(thread.id)
        messages = cl.direct_messages(thread_id, amount=20)

        seen_id = last_seen.get(thread_id)
        new_msgs = []
        for msg in messages:
            if str(msg.id) == seen_id:
                break
            new_msgs.append(msg)

        if not new_msgs:
            continue

        # Process oldest-first
        new_msgs.reverse()
        messages_found += len(new_msgs)
        log.info("Thread %s: %d new message(s).", thread_id, len(new_msgs))

        for msg in new_msgs:
            # Resolve sender info
            sender_username = ""
            sender_full_name = ""
            if thread.users:
                for u in thread.users:
                    if str(u.pk) == str(msg.user_id):
                        sender_username = u.username or ""
                        sender_full_name = u.full_name or ""
                        break

            # Determine media URL if present
            media_url = None
            if msg.media and hasattr(msg.media, "thumbnail_url") and msg.media.thumbnail_url:
                media_url = str(msg.media.thumbnail_url)
            elif msg.media and hasattr(msg.media, "video_url") and msg.media.video_url:
                media_url = str(msg.media.video_url)

            payload = {
                "ig_account_id": cfg["ig_account_id"],
                "thread_id": thread_id,
                "sender_username": sender_username,
                "sender_full_name": sender_full_name,
                "message_text": msg.text or "",
                "message_id": str(msg.id),
                "timestamp": msg.timestamp.isoformat() if msg.timestamp else datetime.utcnow().isoformat(),
                "item_type": msg.item_type or "text",
                "media_url": media_url,
            }
            forward_message(cfg, payload)

        # Update last seen to newest message
        last_seen[thread_id] = str(messages[0].id)

    # --- Outbound: send pending replies ---
    pending = fetch_pending_replies(cfg)
    log.info("Fetched %d pending reply/replies.", len(pending))

    for item in pending:
        try:
            result = cl.direct_answer(item["thread_id"], item["message_text"])
            ig_message_id = str(result.id) if result else ""
            confirm_sent(cfg, item["id"], ig_message_id)
            messages_sent += 1
            log.info("Sent reply in thread %s (pending_id=%s).", item["thread_id"], item["id"])
        except Exception as exc:
            log.error("Failed to send reply (pending_id=%s): %s", item["id"], exc)

    return messages_found, messages_sent, last_seen


def calculate_sleep(base_interval: int) -> float:
    """Apply +/-30 % jitter with a hard floor of 120 seconds."""
    jitter = random.uniform(0.7, 1.3)
    sleep_sec = base_interval * jitter
    return max(sleep_sec, 120.0)


def main() -> None:
    log.info("=" * 60)
    log.info("CrateHQ DM Agent starting up")
    log.info("=" * 60)

    cfg = load_config()
    log.info("Config loaded for account %s (@%s).", cfg["ig_account_id"], cfg["ig_username"])

    try:
        cl = build_client(cfg)
    except (ChallengeRequired, SelectContactPointRecoveryForm) as exc:
        log.critical("MANUAL INTERVENTION NEEDED: Instagram requires verification. "
                     "Complete the challenge on the phone, then restart this agent. (%s)", exc)
        send_heartbeat(cfg, "challenge_required", 0, 0, str(exc))
        sys.exit(1)
    except Exception as exc:
        log.critical("Failed to log in to Instagram: %s", exc)
        send_heartbeat(cfg, "session_expired", 0, 0, str(exc))
        sys.exit(1)

    last_seen = load_last_seen()
    log.info("Loaded last_seen state for %d thread(s).", len(last_seen))
    log.info("Entering main polling loop.")

    while True:
        try:
            tz = cfg["timezone"]
            now = now_in_tz(tz)
            hour = now.hour

            active_start = cfg["active_start_hour"]
            active_end = cfg["active_end_hour"]
            winddown_start = cfg["winddown_start_hour"]

            # --- Outside active hours ---
            if hour < active_start or hour >= active_end:
                sleep_for = seconds_until_hour(tz, active_start)
                log.info("Outside active hours (%02d:00–%02d:00). Sleeping %.0f seconds until next active period.",
                         active_start, active_end, sleep_for)
                send_heartbeat(cfg, "ok", 0, 0)
                time.sleep(sleep_for)
                continue

            # --- FlowChat coordination ---
            if is_flowchat_active():
                log.info("FlowChat active, skipping cycle.")
                time.sleep(30)
                continue

            # --- Determine poll interval ---
            if hour >= winddown_start:
                base_interval = cfg["poll_interval_winddown_sec"]
                log.debug("In wind-down period, base interval = %ds.", base_interval)
            else:
                base_interval = cfg["poll_interval_active_sec"]

            # --- Execute poll cycle ---
            messages_found, messages_sent, last_seen = poll_cycle(cl, cfg, last_seen)

            # Persist last_seen
            save_last_seen(last_seen)

            # Heartbeat
            send_heartbeat(cfg, "ok", messages_found, messages_sent)

            # --- Sleep with jitter ---
            sleep_sec = calculate_sleep(base_interval)
            log.info("Cycle complete. Found %d msg(s), sent %d reply/replies. Sleeping %.0f seconds.",
                     messages_found, messages_sent, sleep_sec)
            time.sleep(sleep_sec)

        except LoginRequired:
            log.warning("Session expired mid-cycle – attempting re-login.")
            try:
                cl = Client()
                cl.set_proxy(cfg["proxy"])
                apply_device_profile(cl, cfg["ig_account_id"])
                cl.delay_range = [1, 3]
                cl.login(cfg["ig_username"], cfg["ig_password"])
                cl.dump_settings(str(SESSION_PATH))
                log.info("Re-login successful, session saved.")
            except (ChallengeRequired, SelectContactPointRecoveryForm) as exc:
                log.critical("MANUAL INTERVENTION NEEDED: Instagram requires verification. "
                             "Complete the challenge on the phone, then restart this agent. (%s)", exc)
                send_heartbeat(cfg, "challenge_required", 0, 0, str(exc))
                sys.exit(1)
            except Exception as exc:
                log.critical("Re-login failed: %s", exc)
                send_heartbeat(cfg, "session_expired", 0, 0, str(exc))
                sys.exit(1)

        except (ChallengeRequired, SelectContactPointRecoveryForm) as exc:
            log.critical("MANUAL INTERVENTION NEEDED: Instagram requires verification. "
                         "Complete the challenge on the phone, then restart this agent. (%s)", exc)
            send_heartbeat(cfg, "challenge_required", 0, 0, str(exc))
            sys.exit(1)

        except Exception as exc:
            log.error("Unexpected error during poll cycle:\n%s", traceback.format_exc())
            try:
                send_heartbeat(cfg, "error", 0, 0, str(exc))
            except Exception:
                pass
            # Continue to next cycle – don't crash
            sleep_sec = calculate_sleep(cfg["poll_interval_active_sec"])
            log.info("Sleeping %.0f seconds before retry.", sleep_sec)
            time.sleep(sleep_sec)


if __name__ == "__main__":
    main()
