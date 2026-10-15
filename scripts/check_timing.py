#!/usr/bin/env python3
"""
Kiwi AI End-to-End Timing & Interactive Chat Benchmark CLI.

Usage:
  # Check timing (Health + HTTP Sync + WebSocket Streaming TTFT):
  ./services/orchestrator/.venv/bin/python scripts/check_timing.py

  # Send a custom message to Kiwi and measure timing:
  ./services/orchestrator/.venv/bin/python scripts/check_timing.py "hey kiwi, how fast are you?"

  # Start an interactive terminal chat session with live timing on every turn:
  ./services/orchestrator/.venv/bin/python scripts/check_timing.py -i
"""
import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path
import httpx
import websockets


def load_env_token() -> tuple[str, str]:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    token = os.environ.get("API_TOKEN", "")
    gateway_url = os.environ.get("GATEWAY_URL", "http://127.0.0.1:8080")
    if env_path.exists() and not token:
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("API_TOKEN="):
                token = line.split("=", 1)[1].strip()
                break
    return gateway_url.rstrip("/"), (token or "kiwi_secret_token_dev")


async def check_health(gateway_url: str) -> tuple[bool, float, dict]:
    t0 = time.perf_counter()
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(f"{gateway_url}/api/health")
        elapsed_ms = (time.perf_counter() - t0) * 1000
        return resp.status_code == 200, elapsed_ms, resp.json()


async def stream_chat_turn(gateway_url: str, token: str, message: str, session_id: str = "cli-timing-session"):
    ws_scheme = "wss" if gateway_url.startswith("https") else "ws"
    host_part = gateway_url.replace("https://", "").replace("http://", "")
    ws_url = f"{ws_scheme}://{host_part}/api/secure/ws"
    headers = {"Authorization": f"Bearer {token}"}

    t_conn_start = time.perf_counter()
    async with websockets.connect(ws_url, additional_headers=headers) as ws:
        conn_ms = (time.perf_counter() - t_conn_start) * 1000

        t_send = time.perf_counter()
        await ws.send(
            json.dumps({
                "type": "chat.message",
                "conversation_id": session_id,
                "content": message,
            })
        )

        thinking_ms = None
        ttft_ms = None
        token_times: list[float] = []
        tokens: list[str] = []
        full_text = ""

        sys.stdout.write("\n\033[1;32mKiwi [ ^ _ ^ ]:\033[0m ")
        sys.stdout.flush()

        while True:
            raw = await asyncio.wait_for(ws.recv(), timeout=30.0)
            now = time.perf_counter()
            frame = json.loads(raw)
            msg_type = frame.get("type")

            if msg_type == "status.thinking":
                thinking_ms = (now - t_send) * 1000
            elif msg_type == "chat.stream":
                tok = frame.get("content") or frame.get("payload", {}).get("token", "")
                if ttft_ms is None:
                    ttft_ms = (now - t_send) * 1000
                token_times.append(now)
                tokens.append(tok)
                sys.stdout.write(tok)
                sys.stdout.flush()
            elif msg_type == "chat.complete":
                full_text = frame.get("content") or frame.get("payload", {}).get("full_text", "".join(tokens))
                break
            elif msg_type == "error":
                err = frame.get("content") or frame.get("payload", {}).get("message", "unknown error")
                sys.stdout.write(f"\n[ERROR] {err}\n")
                break

        total_ms = (time.perf_counter() - t_send) * 1000
        sys.stdout.write("\n")

        deltas_ms = [
            (token_times[i] - token_times[i - 1]) * 1000
            for i in range(1, len(token_times))
        ]
        avg_inter_token_ms = sum(deltas_ms) / len(deltas_ms) if deltas_ms else 0.0
        tok_per_sec = (len(tokens) / (total_ms / 1000.0)) if total_ms > 0 else 0.0

        return {
            "ws_handshake_ms": round(conn_ms, 2),
            "thinking_ack_ms": round(thinking_ms or 0.0, 2),
            "ttft_ms": round(ttft_ms or total_ms, 2),
            "avg_inter_token_ms": round(avg_inter_token_ms, 2),
            "total_ms": round(total_ms, 2),
            "token_count": len(tokens),
            "tokens_per_sec": round(tok_per_sec, 1),
            "full_text": full_text,
        }


def print_timing_box(metrics: dict, health_ms: float | None = None, brain_status: str | None = None):
    print("\n\033[1;36m┌──────────────────────────────────────────────────────────┐\033[0m")
    print("\033[1;36m│                 KIWI CHAT TIMING REPORT                  │\033[0m")
    print("\033[1;36m├──────────────────────────────────────────────────────────┤\033[0m")
    if health_ms is not None:
        print(f"\033[1;36m│\033[0m Gateway + Brain Health : {health_ms:>7.2f} ms (brain: {brain_status or 'ok':<10}) \033[1;36m│\033[0m")
    print(f"\033[1;36m│\033[0m WebSocket Handshake    : {metrics['ws_handshake_ms']:>7.2f} ms                     \033[1;36m│\033[0m")
    print(f"\033[1;36m│\033[0m Thinking Status Ack    : {metrics['thinking_ack_ms']:>7.2f} ms                     \033[1;36m│\033[0m")
    print(f"\033[1;36m│\033[0m \033[1;32mTime To First Token    : {metrics['ttft_ms']:>7.2f} ms (TTFT)\033[0m              \033[1;36m│\033[0m")
    print(f"\033[1;36m│\033[0m Avg Inter-Token Gap    : {metrics['avg_inter_token_ms']:>7.2f} ms / token             \033[1;36m│\033[0m")
    print(f"\033[1;36m│\033[0m Total Stream Latency   : {metrics['total_ms']:>7.2f} ms ({metrics['token_count']} chunks, {metrics['tokens_per_sec']} tok/s)\033[1;36m│\033[0m")
    print("\033[1;36m└──────────────────────────────────────────────────────────┘\033[0m")


async def main():
    parser = argparse.ArgumentParser(description="Check Kiwi chat timing or chat interactively.")
    parser.add_argument("message", nargs="?", default="hey kiwi! let's check our streaming timing.", help="Message to send")
    parser.add_argument("-i", "--interactive", action="store_true", help="Start interactive chat loop with timing")
    args = parser.parse_args()

    gateway_url, token = load_env_token()

    try:
        ok, health_ms, health_data = await check_health(gateway_url)
        brain_status = health_data.get("brain", "unknown")
    except Exception as e:
        print(f"\033[1;31m[!] Could not reach Kiwi Gateway at {gateway_url}: {e}\033[0m")
        sys.exit(1)

    if args.interactive:
        print(f"\033[1;32mConnected to Kiwi Gateway ({gateway_url}) | Brain: {brain_status}\033[0m")
        print("Type your message and press Enter (type 'exit' or 'quit' to leave).")
        session_id = f"cli-chat-{int(time.time())}"
        while True:
            try:
                user_msg = input("\n\033[1;33mYou:\033[0m ").strip()
                if not user_msg:
                    continue
                if user_msg.lower() in ("exit", "quit"):
                    print("\033[1;32mKiwi [ ^ _ ^ ]:\033[0m catch you on the next deploy!")
                    break
                metrics = await stream_chat_turn(gateway_url, token, user_msg, session_id=session_id)
                print(
                    f"\033[2m  ⚡ TTFT: {metrics['ttft_ms']}ms | "
                    f"Avg token: {metrics['avg_inter_token_ms']}ms | "
                    f"Total: {metrics['total_ms']}ms ({metrics['token_count']} tok)\033[0m"
                )
            except (KeyboardInterrupt, EOFError):
                print("\n\033[1;32mKiwi [ ^ _ ^ ]:\033[0m catch you on the next deploy!")
                break
    else:
        print(f"\033[2mSending to {gateway_url} -> \"{args.message}\"\033[0m")
        metrics = await stream_chat_turn(gateway_url, token, args.message)
        print_timing_box(metrics, health_ms=health_ms, brain_status=brain_status)


if __name__ == "__main__":
    asyncio.run(main())
