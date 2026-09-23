#!/usr/bin/env python3
"""
Kiwi AI System - Milestone 3 Adversarial PWA Client Stress Test Suite
Challenger 1 (PWA Client Stress Challenger)

Empirically challenges:
1. Multiple Concurrent Simulated PWA Clients (25 concurrent clients, zero cross-talk, 100% completion)
2. Rapid Chat Message Bursts (Single-client flood & Multi-client storm, stream cancellation safety)
3. Mid-Stream Disconnect & Exponential Backoff Reconnect (PWA reconnection simulation, stream aborts)
4. Malformed WebSocket Frames & Fuzzing (Invalid JSON, non-objects, unknown types, oversized >512KB, binary frames)
5. Adversarial Authentication Rejection (Invalid query params, bad headers, wrong auth frame, unauth chat, 5s timeout, auth flood)
6. PWA Client Application & State Machine Contracts (AVATAR_STATES, exponential backoff, storage keys)
7. Process Health, Stability & Leak Monitoring (PM2 restart count, VmRSS, threads)
"""

import asyncio
import json
import os
import subprocess
import sys
import time
import httpx
import websockets

GATEWAY_HTTP = os.environ.get("GATEWAY_HTTP", "http://127.0.0.1:8080")
GATEWAY_WS = os.environ.get("GATEWAY_WS", "ws://127.0.0.1:8080/api/secure/ws")
API_TOKEN = os.environ.get("API_TOKEN", "kiwi_secret_token_dev")
OUTPUT_JSON = "/root/kiwi/scripts/m3_pwa_stress_results.json"


def get_pm2_status(app_name):
    """Get PM2 details including restart count and pid."""
    try:
        res = subprocess.run(["pm2", "jlist"], capture_output=True, text=True, check=True)
        data = json.loads(res.stdout)
        for proc in data:
            if proc.get("name") == app_name:
                return {
                    "name": app_name,
                    "pid": proc.get("pid"),
                    "status": proc.get("pm2_env", {}).get("status"),
                    "restart_time": proc.get("pm2_env", {}).get("restart_time", 0),
                    "memory": proc.get("monit", {}).get("memory", 0),
                    "cpu": proc.get("monit", {}).get("cpu", 0),
                }
        return None
    except Exception as e:
        print(f"[Warning] Failed to fetch PM2 status for {app_name}: {e}")
        return None


def get_proc_stats(pid):
    """Read Linux /proc/<pid>/status for exact memory and thread counters."""
    if not pid:
        return {}
    try:
        with open(f"/proc/{pid}/status") as f:
            lines = f.readlines()
        stats = {"pid": pid}
        for line in lines:
            if line.startswith("VmRSS:"):
                stats["rss_kb"] = int(line.split()[1])
            elif line.startswith("VmSize:"):
                stats["vmsize_kb"] = int(line.split()[1])
            elif line.startswith("Threads:"):
                stats["threads"] = int(line.split()[1])
        # Count open file descriptors
        try:
            stats["open_fds"] = len(os.listdir(f"/proc/{pid}/fd"))
        except Exception:
            stats["open_fds"] = -1
        return stats
    except Exception as e:
        print(f"[Warning] Failed to read /proc/{pid}/status: {e}")
        return {}


# ==============================================================================
# CHALLENGE 1: CONCURRENT SIMULATED PWA CLIENTS
# ==============================================================================
async def challenge_1_concurrent_pwa_clients(num_clients=25):
    print("\n" + "=" * 70)
    print(f"CHALLENGE 1: {num_clients} CONCURRENT SIMULATED PWA CLIENTS")
    print("=" * 70)
    print(f"Spawning {num_clients} simulated browser clients connecting simultaneously...")

    start_barrier = asyncio.Event()
    ready_clients = 0
    client_results = {}

    async def single_pwa_worker(client_id):
        nonlocal ready_clients
        url = f"{GATEWAY_WS}?token={API_TOKEN}"
        conv_id = f"pwa-client-{client_id}-{int(time.time_ns())}"
        unique_marker = f"CLIENT_TAG_{client_id}_{int(time.time_ns()) % 10000}"
        
        try:
            t0 = time.time()
            async with websockets.connect(url, open_timeout=10.0) as ws:
                t_connect = time.time() - t0

                # Production app.js Method 3 secondary auth frame
                auth_frame = {"type": "auth", "token": API_TOKEN, "content": API_TOKEN}
                await ws.send(json.dumps(auth_frame))

                ready_clients += 1
                if ready_clients == num_clients:
                    start_barrier.set()

                # Wait for all clients to connect before firing
                await asyncio.wait_for(start_barrier.wait(), timeout=15.0)

                # Send unique chat message
                chat_payload = {
                    "type": "chat.message",
                    "conversation_id": conv_id,
                    "content": f"ping from {unique_marker}!"
                }
                t_send = time.time()
                await ws.send(json.dumps(chat_payload))

                received_thinking = False
                tokens = []
                completed_content = None
                ttft = None

                while True:
                    raw = await asyncio.wait_for(ws.recv(), timeout=15.0)
                    msg = json.loads(raw)
                    mtype = msg.get("type")

                    if mtype == "status.thinking":
                        received_thinking = True
                        if ttft is None:
                            ttft = time.time() - t_send
                    elif mtype == "chat.stream":
                        token = msg.get("content", "")
                        tokens.append(token)
                        if ttft is None:
                            ttft = time.time() - t_send
                    elif mtype == "chat.complete":
                        completed_content = msg.get("content", "")
                        break
                    elif mtype == "error":
                        raise RuntimeError(f"Server error frame: {msg.get('content')}")

                t_total = time.time() - t_send
                full_streamed = "".join(tokens)

                # Assert integrity
                assert received_thinking, "Expected status.thinking frame"
                assert len(tokens) > 0, "Expected at least 1 stream token chunk"
                assert completed_content is not None, "Expected chat.complete frame"
                assert full_streamed == completed_content, "Stream tokens do not match chat.complete"
                # Check for cross-talk: ensure the response echoes this client's unique marker (Kiwi outputs lowercase)
                assert unique_marker.lower() in completed_content.lower(), (
                    f"Cross-talk detected! Expected '{unique_marker.lower()}' in response, got: '{completed_content}'"
                )

                client_results[client_id] = {
                    "success": True,
                    "connect_duration_s": round(t_connect, 4),
                    "ttft_s": round(ttft or 0, 4),
                    "total_duration_s": round(t_total, 4),
                    "token_count": len(tokens),
                    "response_length": len(completed_content),
                }
        except Exception as e:
            print(f"  [Error] Client {client_id} failed: {e}")
            client_results[client_id] = {
                "success": False,
                "error": str(e)
            }

    # Run all clients concurrently
    tasks = [asyncio.create_task(single_pwa_worker(i)) for i in range(num_clients)]
    await asyncio.gather(*tasks)

    successes = sum(1 for r in client_results.values() if r.get("success"))
    failures = num_clients - successes
    print(f"Concurrent Clients Result: {successes}/{num_clients} succeeded, {failures} failed.")

    durations = [r["total_duration_s"] for r in client_results.values() if r.get("success")]
    ttfts = [r["ttft_s"] for r in client_results.values() if r.get("success")]

    summary = {
        "num_clients": num_clients,
        "success_count": successes,
        "failure_count": failures,
        "success_rate": round(successes / num_clients * 100, 2),
        "avg_total_duration_s": round(sum(durations) / len(durations), 4) if durations else 0,
        "max_total_duration_s": round(max(durations), 4) if durations else 0,
        "min_total_duration_s": round(min(durations), 4) if durations else 0,
        "avg_ttft_s": round(sum(ttfts) / len(ttfts), 4) if ttfts else 0,
    }

    assert failures == 0, f"Challenge 1 Failed: {failures} clients failed under concurrency"
    print(f"✓ CHALLENGE 1 PASSED: 100% success rate across {num_clients} concurrent clients.")
    print(f"  Avg TTFT: {summary['avg_ttft_s']}s | Avg Stream Duration: {summary['avg_total_duration_s']}s")
    return summary


# ==============================================================================
# CHALLENGE 2: RAPID CHAT MESSAGE BURSTS & STREAM CANCELLATION
# ==============================================================================
async def challenge_2_rapid_message_bursts():
    print("\n" + "=" * 70)
    print("CHALLENGE 2: RAPID CHAT MESSAGE BURSTS & STREAM CANCELLATION")
    print("=" * 70)

    url = f"{GATEWAY_WS}?token={API_TOKEN}"
    results = {}

    # Subtest 2A: Single client firing 10 messages in rapid succession (<5ms apart)
    print("\n---> Subtest 2A: Single client firing 10 messages with 0ms delay...")
    async with websockets.connect(url) as ws:
        # Initial auth frame
        await ws.send(json.dumps({"type": "auth", "token": API_TOKEN}))

        conv_id = f"burst-single-{int(time.time_ns())}"
        burst_count = 10
        for i in range(burst_count):
            msg = {
                "type": "chat.message",
                "conversation_id": conv_id,
                "content": f"burst message index #{i} - quick payload"
            }
            await ws.send(json.dumps(msg))

        print(f"  Dispatched {burst_count} messages into connection pipeline.")

        # Read frames until we receive chat.complete for the final surviving stream
        received_frames = []
        completes = 0
        final_content = None

        try:
            # Drain incoming frames for up to 10 seconds
            end_time = time.time() + 10.0
            while time.time() < end_time:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=2.0)
                    frame = json.loads(raw)
                    ftype = frame.get("type")
                    received_frames.append(ftype)
                    if ftype == "chat.complete":
                        completes += 1
                        final_content = frame.get("content", "")
                except asyncio.TimeoutError:
                    if completes > 0:
                        break
        except Exception as e:
            print(f"  Frame draining finished: {e}")

        print(f"  Total frames received: {len(received_frames)} (chat.complete count: {completes})")
        assert completes >= 1, "Expected at least 1 chat.complete frame from the burst"
        assert final_content is not None and "kiwi" in final_content.lower(), (
            f"Expected Kiwi response in final stream: {final_content}"
        )
        print("  ✓ Subtest 2A Passed: Gateway handled 10-message burst without panic or lockup.")
        results["single_client_burst"] = {
            "burst_count": burst_count,
            "completes_received": completes,
            "total_frames": len(received_frames),
            "status": "PASSED"
        }

    # Subtest 2B: Multi-client burst storm (5 clients sending 5 rapid messages each = 25 burst messages)
    print("\n---> Subtest 2B: Multi-client burst storm (5 clients x 5 messages each)...")
    storm_clients = 5
    storm_bursts = 5
    storm_results = {}

    async def storm_worker(worker_id):
        try:
            async with websockets.connect(url) as ws:
                c_id = f"storm-{worker_id}-{int(time.time_ns())}"
                for m_idx in range(storm_bursts):
                    payload = {
                        "type": "chat.message",
                        "conversation_id": c_id,
                        "content": f"storm worker {worker_id} message #{m_idx}"
                    }
                    await ws.send(json.dumps(payload))
                
                got_complete = False
                tokens = 0
                deadline = time.time() + 12.0
                while time.time() < deadline:
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=3.0)
                        f = json.loads(raw)
                        if f.get("type") == "chat.stream":
                            tokens += 1
                        elif f.get("type") == "chat.complete":
                            got_complete = True
                            break
                    except asyncio.TimeoutError:
                        break
                storm_results[worker_id] = {"complete": got_complete, "tokens": tokens}
        except Exception as err:
            storm_results[worker_id] = {"complete": False, "error": str(err)}

    await asyncio.gather(*[storm_worker(w) for w in range(storm_clients)])
    storm_success = sum(1 for r in storm_results.values() if r.get("complete"))
    print(f"  Storm results: {storm_success}/{storm_clients} workers successfully completed.")
    assert storm_success == storm_clients, f"Storm burst failure: only {storm_success}/{storm_clients} succeeded"
    print("  ✓ Subtest 2B Passed: Multi-client burst storm resolved cleanly.")
    results["multi_client_storm"] = {
        "workers": storm_clients,
        "bursts_per_worker": storm_bursts,
        "success_workers": storm_success,
        "status": "PASSED"
    }

    print("✓ CHALLENGE 2 PASSED: All rapid message burst challenges passed.")
    return results


# ==============================================================================
# CHALLENGE 3: MID-STREAM DISCONNECT & EXPONENTIAL BACKOFF RECONNECTION
# ==============================================================================
async def challenge_3_disconnect_and_backoff_reconnect():
    print("\n" + "=" * 70)
    print("CHALLENGE 3: MID-STREAM DISCONNECT & EXPONENTIAL BACKOFF RECONNECT")
    print("=" * 70)

    url = f"{GATEWAY_WS}?token={API_TOKEN}"
    cycles = 4
    cycle_reports = []

    for attempt in range(cycles):
        cutoff_token = 2 + attempt * 2  # Disconnect after 2, 4, 6, 8 tokens
        # Exponential backoff matching app.js: Math.min(1000 * 1.5^attempt, 30000)
        backoff_ms = min(1000 * (1.5 ** attempt), 30000)
        backoff_sec = backoff_ms / 1000.0

        print(f"\n---> Cycle {attempt + 1}/{cycles}: Disconnecting mid-stream after {cutoff_token} tokens...")
        
        # Step 1: Connect and start streaming
        ws1 = await websockets.connect(url)
        c_id = f"disc-backoff-{attempt}-{int(time.time_ns())}"
        await ws1.send(json.dumps({
            "type": "chat.message",
            "conversation_id": c_id,
            "content": "write a long technical response about operating systems and distributed systems"
        }))

        tokens_read = 0
        while True:
            raw = await asyncio.wait_for(ws1.recv(), timeout=10.0)
            frame = json.loads(raw)
            if frame.get("type") == "chat.stream":
                tokens_read += 1
                if tokens_read >= cutoff_token:
                    print(f"  Received {tokens_read} tokens. Simulating abrupt client disconnect!")
                    await ws1.close()
                    break
            elif frame.get("type") == "chat.complete":
                break

        # Step 2: Exponential backoff delay (simulating PWA client)
        print(f"  Simulating PWA client exponential backoff: waiting {backoff_sec:.2f}s...")
        await asyncio.sleep(backoff_sec)

        # Step 3: Reconnect with new socket and complete full conversation turn
        print(f"  Attempting reconnection #{attempt + 1}...")
        t_recon_start = time.time()
        async with websockets.connect(url, open_timeout=5.0) as ws2:
            t_recon = time.time() - t_recon_start
            follow_up = {
                "type": "chat.message",
                "conversation_id": f"{c_id}-recon",
                "content": "resuming conversation after reconnection"
            }
            await ws2.send(json.dumps(follow_up))

            tokens_recon = []
            recon_complete = False
            while True:
                raw2 = await asyncio.wait_for(ws2.recv(), timeout=10.0)
                frame2 = json.loads(raw2)
                if frame2.get("type") == "chat.stream":
                    tokens_recon.append(frame2.get("content", ""))
                elif frame2.get("type") == "chat.complete":
                    recon_complete = True
                    break

            assert recon_complete, "Reconnected client did not receive chat.complete"
            assert len(tokens_recon) > 0, "Reconnected client did not receive stream tokens"
            print(f"  ✓ Reconnected in {t_recon:.3f}s and streamed {len(tokens_recon)} chunks successfully!")
            
            cycle_reports.append({
                "cycle": attempt + 1,
                "cutoff_token": cutoff_token,
                "backoff_sec": round(backoff_sec, 2),
                "reconnect_time_s": round(t_recon, 3),
                "reconnect_tokens": len(tokens_recon),
                "status": "PASSED"
            })

    print(f"✓ CHALLENGE 3 PASSED: All {cycles} mid-stream disconnect & exponential backoff cycles succeeded.")
    return cycle_reports


# ==============================================================================
# CHALLENGE 4: MALFORMED WEBSOCKET FRAMES & FUZZING
# ==============================================================================
async def challenge_4_malformed_frames():
    print("\n" + "=" * 70)
    print("CHALLENGE 4: MALFORMED WEBSOCKET FRAMES & FUZZING ATTACKS")
    print("=" * 70)

    url = f"{GATEWAY_WS}?token={API_TOKEN}"
    results = {}

    # Subtest 4.1: Raw Non-JSON text frames
    print("\n---> Subtest 4.1: Non-JSON / Corrupt text frames...")
    async with websockets.connect(url) as ws:
        corrupted_payloads = [
            "{",
            "not a json at all",
            "{\"type\": \"chat.message\", \"unclosed",
            "<xml>attack</xml>",
            "null",
            "12345",
            "[\"array\", \"not\", \"object\"]",
            "",
            "   \n\t   ",
        ]
        for p in corrupted_payloads:
            await ws.send(p)
            await asyncio.sleep(0.02)
        print(f"  Sent {len(corrupted_payloads)} corrupted payloads.")

        # Verify connection is still alive by sending a valid message
        valid_msg = {"type": "chat.message", "content": "alive check after malformed frames"}
        await ws.send(json.dumps(valid_msg))
        
        got_complete = False
        while True:
            raw = await asyncio.wait_for(ws.recv(), timeout=10.0)
            msg = json.loads(raw)
            if msg.get("type") == "chat.complete":
                got_complete = True
                break
        assert got_complete, "Connection died after receiving malformed frames"
        print("  ✓ Subtest 4.1 Passed: Server tolerated corrupt JSON and preserved socket integrity.")
        results["corrupt_json"] = "PASSED"

    # Subtest 4.2: Unknown message types & empty content
    print("\n---> Subtest 4.2: Unknown frame types & empty content...")
    async with websockets.connect(url) as ws:
        weird_frames = [
            {"type": "admin.shutdown", "content": "kill"},
            {"type": "kernel.exec", "content": "rm -rf /"},
            {"type": "__proto__", "content": "prototype pollution"},
            {"type": "chat.message", "content": ""},
            {"type": "chat.message", "content": "     "},
            {"type": "chat.message"},  # missing content key
        ]
        for wf in weird_frames:
            await ws.send(json.dumps(wf))
            await asyncio.sleep(0.02)
        
        valid_msg = {"type": "chat.message", "content": "alive check after weird frames"}
        await ws.send(json.dumps(valid_msg))
        got_complete = False
        while True:
            raw = await asyncio.wait_for(ws.recv(), timeout=10.0)
            msg = json.loads(raw)
            if msg.get("type") == "chat.complete":
                got_complete = True
                break
        assert got_complete
        print("  ✓ Subtest 4.2 Passed: Unknown types and empty messages handled gracefully.")
        results["unknown_types"] = "PASSED"

    # Subtest 4.3: Oversized payload (>512KB read limit)
    print("\n---> Subtest 4.3: Oversized text frame (>512KB maxMessageSize)...")
    async with websockets.connect(url) as ws:
        # Hub maxMessageSize is 512 * 1024 bytes (524,288 bytes)
        # Send 600KB message
        giant_content = "X" * (600 * 1024)
        giant_frame = json.dumps({"type": "chat.message", "content": giant_content})

        # Server must close the connection with close code 1009 (message too big)
        closed = False
        try:
            await ws.send(giant_frame)
            await asyncio.wait_for(ws.recv(), timeout=5.0)
        except (websockets.exceptions.ConnectionClosed, websockets.exceptions.ConnectionClosedError) as e:
            closed = True
            print(f"  Connection closed as expected when exceeding read limit: {e}")
        except Exception as e:
            if ws.closed:
                closed = True
                print(f"  Socket closed on read limit: {e}")

        assert closed, "Server failed to enforce maxMessageSize limit!"
        print("  ✓ Subtest 4.3 Passed: Server enforced 512KB message limit without panic.")
        results["oversized_frame"] = "PASSED"

    # Subtest 4.4: Binary WebSocket frames
    print("\n---> Subtest 4.4: Binary WebSocket frames...")
    async with websockets.connect(url) as ws:
        # Send random binary bytes
        raw_binary = bytes([0x00, 0xFF, 0xFE, 0xFD, 0x10, 0x20, 0x30, 0x40])
        await ws.send(raw_binary)

        # Send binary frame containing valid JSON bytes
        json_binary = json.dumps({"type": "chat.message", "content": "binary json message"}).encode("utf-8")
        await ws.send(json_binary)

        got_complete = False
        while True:
            raw = await asyncio.wait_for(ws.recv(), timeout=10.0)
            msg = json.loads(raw)
            if msg.get("type") == "chat.complete":
                got_complete = True
                break
        assert got_complete
        print("  ✓ Subtest 4.4 Passed: Binary frames processed cleanly.")
        results["binary_frames"] = "PASSED"

    print("✓ CHALLENGE 4 PASSED: All malformed frame fuzzing tests passed.")
    return results


# ==============================================================================
# CHALLENGE 5: ADVERSARIAL AUTHENTICATION REJECTION & ATTACKS
# ==============================================================================
async def challenge_5_adversarial_auth():
    print("\n" + "=" * 70)
    print("CHALLENGE 5: ADVERSARIAL AUTH REJECTION & TOKEN ATTACKS")
    print("=" * 70)

    results = {}

    # Subtest 5.1: Invalid query param (?token=wrong)
    print("\n---> Subtest 5.1: Invalid query param token...")
    bad_url = f"{GATEWAY_WS}?token=definitely_invalid_token_12345"
    rejected_401 = False
    try:
        async with websockets.connect(bad_url) as ws:
            pass
    except (websockets.exceptions.InvalidStatus, websockets.exceptions.InvalidHandshake) as e:
        status = getattr(e, "status_code", None) or getattr(getattr(e, "response", None), "status_code", None)
        assert status == 401, f"Expected 401, got {status}"
        rejected_401 = True
    assert rejected_401, "Gateway did not reject invalid query param with 401"
    print("  ✓ Subtest 5.1 Passed: HTTP 401 returned for invalid query token.")
    results["invalid_query_token"] = "PASSED"

    # Subtest 5.2: Invalid Bearer header
    print("\n---> Subtest 5.2: Invalid Bearer token header...")
    rejected_bearer = False
    try:
        headers = {"Authorization": "Bearer evil_hacker_token"}
        async with websockets.connect(GATEWAY_WS, additional_headers=headers) as ws:
            pass
    except (websockets.exceptions.InvalidStatus, websockets.exceptions.InvalidHandshake) as e:
        status = getattr(e, "status_code", None) or getattr(getattr(e, "response", None), "status_code", None)
        assert status == 401
        rejected_bearer = True
    assert rejected_bearer
    print("  ✓ Subtest 5.2 Passed: HTTP 401 returned for invalid Bearer header.")
    results["invalid_bearer_header"] = "PASSED"

    # Subtest 5.3: Unauthenticated connection sending invalid auth frame
    print("\n---> Subtest 5.3: Invalid initial auth frame...")
    closed_4401 = False
    async with websockets.connect(GATEWAY_WS) as ws:
        # Send bogus auth frame
        await ws.send(json.dumps({"type": "auth", "token": "wrong_creds", "content": "wrong_creds"}))
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=3.0)
        except websockets.exceptions.ConnectionClosed as e:
            closed_4401 = (e.code == 4401)
            print(f"  Closed with code {e.code}, reason: {e.reason}")
    assert closed_4401, "Expected close code 4401 on invalid auth frame"
    print("  ✓ Subtest 5.3 Passed: Connection terminated with code 4401 on invalid auth frame.")
    results["invalid_auth_frame"] = "PASSED"

    # Subtest 5.4: Unauthenticated connection sending chat message without auth
    print("\n---> Subtest 5.4: Non-auth message while unauthenticated...")
    closed_unauth_chat = False
    async with websockets.connect(GATEWAY_WS) as ws:
        await ws.send(json.dumps({"type": "chat.message", "content": "trying to chat unauthenticated"}))
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=3.0)
        except websockets.exceptions.ConnectionClosed as e:
            closed_unauth_chat = (e.code == 4401)
            print(f"  Closed with code {e.code}, reason: {e.reason}")
    assert closed_unauth_chat, "Expected close code 4401 on unauthenticated chat message"
    print("  ✓ Subtest 5.4 Passed: Connection terminated with code 4401 on unauthenticated chat.")
    results["unauth_chat_rejected"] = "PASSED"

    # Subtest 5.5: Auth timeout (5-second deadline)
    print("\n---> Subtest 5.5: Auth timeout deadline (waiting >5 seconds without authenticating)...")
    t_timeout_start = time.time()
    closed_timeout = False
    async with websockets.connect(GATEWAY_WS) as ws:
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=7.0)
        except websockets.exceptions.ConnectionClosed as e:
            elapsed = time.time() - t_timeout_start
            print(f"  Connection closed after {elapsed:.2f}s with code {e.code}, reason: {e.reason}")
            closed_timeout = (e.code == 4401 and 4.8 <= elapsed <= 6.5)
    assert closed_timeout, "Expected server to disconnect unauthenticated client around 5 seconds"
    print("  ✓ Subtest 5.5 Passed: Server strictly enforced 5s authentication timeout.")
    results["auth_timeout_5s"] = "PASSED"

    # Subtest 5.6: Auth flooding attack (40 rapid invalid connections)
    print("\n---> Subtest 5.6: Auth flooding attack (40 rapid invalid connections)...")
    flood_count = 40
    flood_rejections = 0

    async def single_flood_attempt(idx):
        nonlocal flood_rejections
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(
                    f"{GATEWAY_HTTP}/api/secure/ping",
                    headers={"Authorization": f"Bearer invalid_flood_{idx}"}
                )
                if r.status_code == 401:
                    flood_rejections += 1
        except Exception:
            pass

    t_flood_0 = time.time()
    await asyncio.gather(*[single_flood_attempt(i) for i in range(flood_count)])
    t_flood = time.time() - t_flood_0
    print(f"  Flood handled: {flood_rejections}/{flood_count} rejected in {t_flood:.3f}s")
    assert flood_rejections == flood_count, f"Expected {flood_count} rejections, got {flood_rejections}"
    print("  ✓ Subtest 5.6 Passed: Auth flooding absorbed cleanly without leakage.")
    results["auth_flood"] = "PASSED"

    print("✓ CHALLENGE 5 PASSED: All adversarial authentication tests passed.")
    return results


# ==============================================================================
# CHALLENGE 6: PWA CLIENT APPLICATION & STATE MACHINE CONTRACTS
# ==============================================================================
def challenge_6_pwa_client_contracts():
    print("\n" + "=" * 70)
    print("CHALLENGE 6: PWA CLIENT APPLICATION & STATE MACHINE CONTRACTS")
    print("=" * 70)

    app_js_path = "/root/kiwi/apps/mobile/public/app.js"
    with open(app_js_path) as f:
        code = f.read()

    # 1. Verify AVATAR_STATES machine
    expected_states = ["idle", "thinking", "solved", "error"]
    expected_faces = ["[ ^ _ ^ ]", "[ > _ < ]", "[ ★ ᴗ ★ ]", "[ @ _ @ ]"]
    
    assert "const AVATAR_STATES =" in code, "Missing AVATAR_STATES definition"
    for state in expected_states:
        assert state in code, f"Missing avatar state '{state}' in app.js"
    for face in expected_faces:
        assert face in code, f"Missing avatar face glyph '{face}' in app.js"
    print("✓ Avatar state machine contracts verified (idle, thinking, solved, error).")

    # 2. Verify exponential backoff math and limits
    assert "Math.min(1000 * Math.pow(1.5, reconnectAttempts), 30000)" in code, (
        "Exponential backoff formula mismatch in app.js"
    )
    print("✓ Exponential backoff formula verified: min(1000 * 1.5^n, 30000).")

    # 3. Verify close code 4401 handler
    assert "event.code === 4401" in code, "Missing close code 4401 handler in app.js"
    print("✓ Close code 4401 (invalid token) handling verified.")

    # 4. Verify LocalStorage keys
    assert "kiwi_api_token" in code, "Missing STORAGE_KEY_TOKEN"
    assert "kiwi_server_url" in code, "Missing STORAGE_KEY_URL"
    print("✓ LocalStorage keys contract verified.")

    # 5. Verify Service Worker registration
    assert "navigator.serviceWorker.register('/sw.js')" in code, "Missing SW registration in app.js"
    print("✓ Service worker registration hook verified.")

    print("✓ CHALLENGE 6 PASSED: All PWA client contracts satisfied.")
    return {"status": "PASSED"}


# ==============================================================================
# MAIN RUNNER & MONITORING
# ==============================================================================
async def main():
    print("######################################################################")
    print("  KIWI AI SYSTEM - MILESTONE 3 PWA WEBSOCKET ADVERSARIAL STRESS SUITE  ")
    print("######################################################################")

    # Pre-test system monitoring
    gw_status_before = get_pm2_status("kiwi-gateway")
    brain_status_before = get_pm2_status("kiwi-brain")
    gw_proc_before = get_proc_stats(gw_status_before.get("pid")) if gw_status_before else {}
    brain_proc_before = get_proc_stats(brain_status_before.get("pid")) if brain_status_before else {}

    print(f"\n[BASELINE] Gateway PID: {gw_status_before.get('pid')} | Restarts: {gw_status_before.get('restart_time')} | RSS: {gw_proc_before.get('rss_kb', 0)} KB | FDs: {gw_proc_before.get('open_fds', 0)}")
    print(f"[BASELINE] Brain   PID: {brain_status_before.get('pid')} | Restarts: {brain_status_before.get('restart_time')} | RSS: {brain_proc_before.get('rss_kb', 0)} KB | FDs: {brain_proc_before.get('open_fds', 0)}")

    all_results = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "baseline": {
            "gateway": {"pm2": gw_status_before, "proc": gw_proc_before},
            "brain": {"pm2": brain_status_before, "proc": brain_proc_before},
        },
        "challenges": {}
    }

    try:
        # Challenge 1: Concurrent Simulated PWA Clients
        all_results["challenges"]["1_concurrent_pwa_clients"] = await challenge_1_concurrent_pwa_clients(num_clients=25)

        # Challenge 2: Rapid Chat Message Bursts
        all_results["challenges"]["2_rapid_message_bursts"] = await challenge_2_rapid_message_bursts()

        # Challenge 3: Mid-stream Disconnect & Exponential Backoff Reconnect
        all_results["challenges"]["3_disconnect_and_backoff_reconnect"] = await challenge_3_disconnect_and_backoff_reconnect()

        # Challenge 4: Malformed WebSocket Frames & Fuzzing
        all_results["challenges"]["4_malformed_frames"] = await challenge_4_malformed_frames()

        # Challenge 5: Adversarial Authentication Rejection
        all_results["challenges"]["5_adversarial_auth"] = await challenge_5_adversarial_auth()

        # Challenge 6: PWA Client Contracts
        all_results["challenges"]["6_pwa_client_contracts"] = challenge_6_pwa_client_contracts()

        # Post-test system monitoring
        await asyncio.sleep(1.0)
        gw_status_after = get_pm2_status("kiwi-gateway")
        brain_status_after = get_pm2_status("kiwi-brain")
        gw_proc_after = get_proc_stats(gw_status_after.get("pid")) if gw_status_after else {}
        brain_proc_after = get_proc_stats(brain_status_after.get("pid")) if brain_status_after else {}

        print("\n" + "=" * 70)
        print("POST-TEST PROCESS HEALTH & INTEGRITY CHECK")
        print("=" * 70)
        print(f"[FINAL] Gateway PID: {gw_status_after.get('pid')} | Restarts: {gw_status_after.get('restart_time')} (Delta: {gw_status_after.get('restart_time') - gw_status_before.get('restart_time')})")
        print(f"        RSS: {gw_proc_after.get('rss_kb', 0)} KB (Delta: {gw_proc_after.get('rss_kb', 0) - gw_proc_before.get('rss_kb', 0)} KB) | Open FDs: {gw_proc_after.get('open_fds', 0)}")
        print(f"[FINAL] Brain   PID: {brain_status_after.get('pid')} | Restarts: {brain_status_after.get('restart_time')} (Delta: {brain_status_after.get('restart_time') - brain_status_before.get('restart_time')})")
        print(f"        RSS: {brain_proc_after.get('rss_kb', 0)} KB (Delta: {brain_proc_after.get('rss_kb', 0) - brain_proc_before.get('rss_kb', 0)} KB) | Open FDs: {brain_proc_after.get('open_fds', 0)}")

        # Check for crashes
        gw_restarts = gw_status_after.get("restart_time", 0) - gw_status_before.get("restart_time", 0)
        brain_restarts = brain_status_after.get("restart_time", 0) - brain_status_before.get("restart_time", 0)

        assert gw_restarts == 0, f"Gateway crashed during stress test! Restarts={gw_restarts}"
        assert brain_restarts == 0, f"Brain crashed during stress test! Restarts={brain_restarts}"

        all_results["post_test"] = {
            "gateway": {"pm2": gw_status_after, "proc": gw_proc_after, "restart_delta": gw_restarts},
            "brain": {"pm2": brain_status_after, "proc": brain_proc_after, "restart_delta": brain_restarts},
        }
        all_results["overall_status"] = "PASSED"

        with open(OUTPUT_JSON, "w") as f:
            json.dump(all_results, f, indent=2)

        print(f"\nAll empirical stress metrics written to {OUTPUT_JSON}")
        print("\n" + "#" * 70)
        print("  🎉 ALL 6 ADVERSARIAL CHALLENGES EMPIRICALLY PASSED WITH ZERO CRASHES!")
        print("#" * 70)

    except Exception as e:
        print(f"\n❌ ADVERSARIAL STRESS TEST FAILED: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        all_results["overall_status"] = "FAILED"
        all_results["error"] = str(e)
        with open(OUTPUT_JSON, "w") as f:
            json.dump(all_results, f, indent=2)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
