#!/usr/bin/env python3
import asyncio
import json
import os
import signal
import subprocess
import time
import websockets

GATEWAY_WS = "ws://127.0.0.1:8080/api/secure/ws"
API_TOKEN = "kiwi_secret_token_dev"

async def test_kill_midstream():
    print("\n--- Scenario 2A: SIGKILL Mid-Stream ---")
    res = subprocess.run(["pm2", "pid", "kiwi-brain"], capture_output=True, text=True, check=True)
    brain_pid = int(res.stdout.strip())
    print(f"kiwi-brain PID: {brain_pid}")
    assert brain_pid > 0, "Brain must be running"

    headers = {"Authorization": f"Bearer {API_TOKEN}"}
    ws = await websockets.connect(GATEWAY_WS, additional_headers=headers)
    await ws.send(json.dumps({
        "type": "chat.message",
        "content": "write a long essay about building personal artificial intelligence systems"
    }))

    token_count = 0
    received_frames = []
    closed = False
    timed_out = False

    try:
        while True:
            raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
            msg = json.loads(raw)
            mtype = msg.get("type")
            received_frames.append(mtype)
            print(f"Received frame: {mtype}")
            if mtype == "chat.stream":
                token_count += 1
                if token_count == 2:
                    print(f"Killing brain PID {brain_pid} with SIGKILL...")
                    os.kill(brain_pid, signal.SIGKILL)
            elif mtype in ("error", "chat.error", "chat.complete"):
                break
    except websockets.exceptions.ConnectionClosed as e:
        closed = True
        print(f"Connection closed by server: code={e.code}, reason={e.reason}")
    except asyncio.TimeoutError:
        timed_out = True
        print("CLIENT TIMED OUT: 5 seconds elapsed without any frame or closure from Gateway!")
    finally:
        await ws.close()
        print("Restarting kiwi-brain...")
        subprocess.run(["pm2", "restart", "kiwi-brain"], check=True)
        await asyncio.sleep(1.0)

    print(f"Scenario 2A summary: frames={received_frames}, closed_by_server={closed}, timed_out={timed_out}")


async def test_pm2_restart_midstream():
    print("\n--- Scenario 2B: PM2 Restart Mid-Stream ---")
    res = subprocess.run(["pm2", "pid", "kiwi-brain"], capture_output=True, text=True, check=True)
    brain_pid = int(res.stdout.strip())
    print(f"kiwi-brain PID: {brain_pid}")
    assert brain_pid > 0, "Brain must be running"

    headers = {"Authorization": f"Bearer {API_TOKEN}"}
    ws = await websockets.connect(GATEWAY_WS, additional_headers=headers)
    await ws.send(json.dumps({
        "type": "chat.message",
        "content": "write a long essay about building personal artificial intelligence systems"
    }))

    token_count = 0
    received_frames = []
    closed = False
    timed_out = False

    try:
        while True:
            raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
            msg = json.loads(raw)
            mtype = msg.get("type")
            received_frames.append(mtype)
            print(f"Received frame: {mtype}")
            if mtype == "chat.stream":
                token_count += 1
                if token_count == 2:
                    print("Restarting kiwi-brain via pm2 restart kiwi-brain...")
                    subprocess.run(["pm2", "restart", "kiwi-brain"], check=True)
            elif mtype in ("error", "chat.error", "chat.complete"):
                break
    except websockets.exceptions.ConnectionClosed as e:
        closed = True
        print(f"Connection closed by server: code={e.code}, reason={e.reason}")
    except asyncio.TimeoutError:
        timed_out = True
        print("CLIENT TIMED OUT: 5 seconds elapsed without any frame or closure from Gateway!")
    finally:
        await ws.close()
        await asyncio.sleep(1.0)

    print(f"Scenario 2B summary: frames={received_frames}, closed_by_server={closed}, timed_out={timed_out}")


async def main():
    await test_kill_midstream()
    await test_pm2_restart_midstream()

if __name__ == "__main__":
    asyncio.run(main())
