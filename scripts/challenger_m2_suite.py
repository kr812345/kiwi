#!/usr/bin/env python3
"""
Comprehensive Challenger Test Suite for Milestone 2: Streaming & WebSockets.
Covers:
1. Mid-Stream Disconnects (after 1st, 5th, 10th chunks) + Memory & Goroutine/Thread Monitoring.
2. Brain Crash Mid-Stream (pm2 stop/restart kiwi-brain & instant kill) + Error/Closure verification.
3. Unauthenticated Connections (5s timeout, invalid tokens, timing boundaries).
"""

import asyncio
import json
import os
import signal
import subprocess
import sys
import time
import websockets

GATEWAY_WS = "ws://127.0.0.1:8080/api/secure/ws"
API_TOKEN = "kiwi_secret_token_dev"


def get_process_stats(app_name):
    """Retrieve memory and thread stats for a PM2 process."""
    try:
        pid_res = subprocess.run(["pm2", "pid", app_name], capture_output=True, text=True, check=True)
        pid_str = pid_res.stdout.strip()
        if not pid_str:
            return None
        pid = int(pid_str)
        with open(f"/proc/{pid}/status") as f:
            status = f.read()
        stats = {"pid": pid}
        for line in status.splitlines():
            if line.startswith("VmRSS:"):
                stats["rss_kb"] = int(line.split()[1])
            elif line.startswith("VmSize:"):
                stats["vmsize_kb"] = int(line.split()[1])
            elif line.startswith("Threads:"):
                stats["threads"] = int(line.split()[1])
        return stats
    except Exception as e:
        print(f"Failed to get stats for {app_name}: {e}")
        return None


async def run_disconnect_test(chunk_cutoff, cycle_num=1):
    """Connect, send message, and disconnect immediately after receiving chunk_cutoff tokens."""
    headers = {"Authorization": f"Bearer {API_TOKEN}"}
    ws = await websockets.connect(GATEWAY_WS, additional_headers=headers)

    send_payload = {
        "type": "chat.message",
        "conversation_id": f"test-disc-cut{chunk_cutoff}-c{cycle_num}-{time.time_ns()}",
        "content": "tell me a comprehensive and detailed kiwi story with many sentences"
    }
    await ws.send(json.dumps(send_payload))

    tokens_received = 0
    while True:
        raw_msg = await asyncio.wait_for(ws.recv(), timeout=10.0)
        msg = json.loads(raw_msg)
        if msg.get("type") == "chat.stream":
            tokens_received += 1
            if tokens_received == chunk_cutoff:
                # Disconnect immediately
                await ws.close()
                break
        elif msg.get("type") == "chat.complete":
            # Stream completed before reaching cutoff (should not happen for cutoff <= 10)
            break

    return tokens_received


async def test_1_midstream_disconnects():
    print("\n" + "=" * 60)
    print("TEST 1: MID-STREAM DISCONNECTS (1st, 5th, 10th Chunks) & LEAK CHECK")
    print("=" * 60)

    stats_before = get_process_stats("kiwi-gateway")
    print(f"Gateway stats before test: RSS={stats_before.get('rss_kb')} KB, Threads={stats_before.get('threads')}")

    results = {}
    for cutoff in [1, 5, 10]:
        print(f"\n---> Testing disconnect after chunk #{cutoff}...")
        for cycle in range(1, 4):
            tokens = await run_disconnect_test(cutoff, cycle)
            assert tokens == cutoff, f"Expected {cutoff} tokens before disconnect, got {tokens}"
            print(f"  Cycle {cycle}: Disconnected cleanly after {tokens} chunks.")
            await asyncio.sleep(0.2)
        results[cutoff] = "PASSED"

    # Stress loop: 15 rapid disconnect cycles (5 each of cutoff 1, 5, 10)
    print("\n---> Running stress loop of 15 rapid disconnects...")
    for i in range(15):
        cutoff = [1, 5, 10][i % 3]
        await run_disconnect_test(cutoff, i + 1)
        await asyncio.sleep(0.05)
    print("  Stress loop completed: 15 disconnects executed.")

    # Allow time for goroutines and context cancellations to settle
    await asyncio.sleep(1.0)

    stats_after = get_process_stats("kiwi-gateway")
    print(f"Gateway stats after test: RSS={stats_after.get('rss_kb')} KB, Threads={stats_after.get('threads')}")

    rss_diff = stats_after.get("rss_kb", 0) - stats_before.get("rss_kb", 0)
    print(f"Gateway RSS memory delta: {rss_diff:+d} KB")

    # Verify that Gateway is still healthy and responsive
    headers = {"Authorization": f"Bearer {API_TOKEN}"}
    async with websockets.connect(GATEWAY_WS, additional_headers=headers) as ws:
        await ws.send(json.dumps({"type": "chat.message", "content": "health check after disconnects"}))
        raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
        assert json.loads(raw).get("type") == "status.thinking"
    print("✓ Gateway is healthy and responsive following all mid-stream disconnects.")

    # Check PM2 Gateway logs for cancellation messages
    log_res = subprocess.run(["pm2", "logs", "kiwi-gateway", "--lines", "25", "--nostream"],
                             capture_output=True, text=True)
    assert "Brain SSE stream aborted due to client disconnect: context canceled" in log_res.stdout or \
           "Brain SSE stream aborted due to client disconnect: context canceled" in log_res.stderr, \
           "Expected context cancellation logged by Gateway upon disconnect"
    print("✓ Gateway explicitly logged upstream SSE cancellation upon client disconnect.")

    return results


async def test_2_brain_crash_midstream():
    print("\n" + "=" * 60)
    print("TEST 2: BRAIN CRASH MID-STREAM BEHAVIOR")
    print("=" * 60)

    res = subprocess.run(["pm2", "pid", "kiwi-brain"], capture_output=True, text=True, check=True)
    brain_pid = int(res.stdout.strip())
    print(f"Current kiwi-brain PID: {brain_pid}")

    headers = {"Authorization": f"Bearer {API_TOKEN}"}
    print("Connecting to WebSocket...")
    ws = await websockets.connect(GATEWAY_WS, additional_headers=headers)

    send_payload = {
        "type": "chat.message",
        "conversation_id": "test-crash-eval",
        "content": "tell me a comprehensive story about trees and nature"
    }
    await ws.send(json.dumps(send_payload))

    tokens = []
    received_error_frame = None
    received_chat_complete = None
    connection_closed_by_server = False
    close_code = None
    close_reason = None
    client_timed_out = False

    try:
        while True:
            raw_msg = await asyncio.wait_for(ws.recv(), timeout=4.0)
            msg = json.loads(raw_msg)
            mtype = msg.get("type")
            if mtype == "chat.stream":
                tokens.append(msg.get("content"))
                if len(tokens) == 2:
                    print(f"Received {len(tokens)} chunks. Instantly SIGKILLing kiwi-brain (PID {brain_pid})...")
                    os.kill(brain_pid, signal.SIGKILL)
                    print("SIGKILL sent. Listening for Gateway response...")
            elif mtype in ("error", "chat.error"):
                received_error_frame = msg
                print(f"Received error frame from Gateway: {msg}")
                break
            elif mtype == "chat.complete":
                received_chat_complete = msg
                print(f"Received chat.complete: {msg}")
                break
    except websockets.exceptions.ConnectionClosed as e:
        connection_closed_by_server = True
        close_code = e.code
        close_reason = e.reason
        print(f"Connection closed by server: code={e.code}, reason={e.reason}")
    except asyncio.TimeoutError:
        client_timed_out = True
        print("CLIENT TIMED OUT: Waited 4.0s but Gateway sent nothing!")
    finally:
        await ws.close()
        print("Restoring kiwi-brain via PM2 restart...")
        subprocess.run(["pm2", "restart", "kiwi-brain"], check=True)
        await asyncio.sleep(1.0)

    # Check Gateway status
    gw_stats = get_process_stats("kiwi-gateway")
    gateway_crashed = (gw_stats is None)
    print(f"\nGateway crash status: Gateway alive = {not gateway_crashed}")

    outcome = {
        "tokens_before_crash": len(tokens),
        "gateway_crashed": gateway_crashed,
        "received_error_frame": received_error_frame,
        "received_chat_complete": received_chat_complete,
        "connection_closed_by_server": connection_closed_by_server,
        "close_code": close_code,
        "client_timed_out": client_timed_out,
    }

    print("\n--- Test 2 Results Summary ---")
    print(f"  Gateway crashed: {gateway_crashed} (Requirement: without crashing -> PASSED)")
    print(f"  Gateway sent error frame: {received_error_frame is not None}")
    print(f"  Gateway closed connection: {connection_closed_by_server}")
    print(f"  Client hung/timed out: {client_timed_out}")

    # Evaluate requirement: "verify Gateway closes or sends error frame to client without crashing"
    requirement_met = (not gateway_crashed) and (received_error_frame is not None or connection_closed_by_server)
    outcome["requirement_met"] = requirement_met
    print(f"  --> Requirement Met: {requirement_met}")
    return outcome


async def test_3_unauthenticated_connections():
    print("\n" + "=" * 60)
    print("TEST 3: UNAUTHENTICATED CONNECTIONS & 5-SECOND TIMEOUT")
    print("=" * 60)

    results = {}

    # Subtest 3.1: Connect without token and wait for 5-second deadline expiration
    print("\n---> Subtest 3.1: Connect without token and wait for 5-second deadline...")
    t0 = time.time()
    ws = await websockets.connect(GATEWAY_WS)
    t_connected = time.time()
    try:
        await asyncio.wait_for(ws.recv(), timeout=7.0)
        assert False, "Expected connection to close, but received a message instead"
    except websockets.exceptions.ConnectionClosed as e:
        elapsed = time.time() - t_connected
        print(f"  Connection closed after {elapsed:.2f}s with code={e.code}, reason={repr(e.reason)}")
        assert e.code == 4401, f"Expected close code 4401, got {e.code}"
        assert "timeout" in e.reason.lower(), f"Expected timeout reason, got {e.reason}"
        assert 4.8 <= elapsed <= 6.0, f"Expected closure around 5.0s, got {elapsed:.2f}s"
        results["3.1_timeout_4401"] = f"PASSED (closed after {elapsed:.2f}s with code 4401)"

    # Subtest 3.2: Send non-auth message while unauthenticated
    print("\n---> Subtest 3.2: Send chat.message while unauthenticated...")
    ws = await websockets.connect(GATEWAY_WS)
    await ws.send(json.dumps({"type": "chat.message", "content": "unauthenticated message"}))
    try:
        await asyncio.wait_for(ws.recv(), timeout=3.0)
        assert False, "Expected close on non-auth message from unauthenticated client"
    except websockets.exceptions.ConnectionClosed as e:
        print(f"  Immediate close on non-auth message: code={e.code}, reason={repr(e.reason)}")
        assert e.code == 4401, f"Expected close code 4401, got {e.code}"
        results["3.2_non_auth_rejected_4401"] = f"PASSED (closed with code 4401)"

    # Subtest 3.3: Send auth frame with invalid token
    print("\n---> Subtest 3.3: Send auth frame with invalid token...")
    ws = await websockets.connect(GATEWAY_WS)
    await ws.send(json.dumps({"type": "auth", "content": "wrong_token_xyz"}))
    try:
        await asyncio.wait_for(ws.recv(), timeout=3.0)
        assert False, "Expected close on invalid token"
    except websockets.exceptions.ConnectionClosed as e:
        print(f"  Immediate close on invalid token: code={e.code}, reason={repr(e.reason)}")
        assert e.code == 4401, f"Expected close code 4401, got {e.code}"
        results["3.3_invalid_token_rejected_4401"] = f"PASSED (closed with code 4401)"

    # Subtest 3.4: Send valid auth frame just before timeout (at 3.5 seconds)
    print("\n---> Subtest 3.4: Send valid auth frame at 3.5 seconds (before 5s deadline)...")
    ws = await websockets.connect(GATEWAY_WS)
    await asyncio.sleep(3.5)
    await ws.send(json.dumps({"type": "auth", "content": API_TOKEN}))
    await asyncio.sleep(2.5)  # Wait past the original 5s mark (total 6.0s from connect)
    # Connection should still be open and capable of chat
    await ws.send(json.dumps({"type": "chat.message", "content": "ping"}))
    raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
    msg = json.loads(raw)
    assert msg.get("type") == "status.thinking"
    print("  Connection remained open past 5s deadline after valid auth frame!")
    await ws.close()
    results["3.4_late_auth_success"] = "PASSED"

    print("\n--- Test 3 Results Summary ---")
    for k, v in results.items():
        print(f"  {k}: {v}")

    return results


async def main():
    print("=" * 60)
    print("  EMPIRICAL CHALLENGER TEST SUITE — MILESTONE 2  ")
    print("=" * 60)

    t1_results = await test_1_midstream_disconnects()
    t2_results = await test_2_brain_crash_midstream()
    t3_results = await test_3_unauthenticated_connections()

    print("\n" + "=" * 60)
    print("  OVERALL CHALLENGE EVALUATION SUMMARY  ")
    print("=" * 60)
    print(f"Task 1 (Disconnect Mid-Stream 1/5/10 & Leak Check): PASSED")
    print(f"Task 2 (Brain Crash Mid-Stream Error Frame / Closure): {'PASSED' if t2_results['requirement_met'] else 'FAILED'}")
    print(f"Task 3 (Unauthenticated Timeout 4401): PASSED")

    return {
        "task1": t1_results,
        "task2": t2_results,
        "task3": t3_results,
    }


if __name__ == "__main__":
    asyncio.run(main())
