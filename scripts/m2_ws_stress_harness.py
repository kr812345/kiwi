#!/usr/bin/env python3
"""
Empirical Stress Test Harness for Milestone 2: Streaming & WebSockets.
Tests:
1. Concurrency (10 & 20 simultaneous WebSocket clients)
2. Stream Isolation & Token Mixing Verification
3. Latency & Token Cadence Benchmarking (TTFT, Inter-token deltas, Token rate)
4. Message Type Routing (status.thinking, chat.stream, chat.complete, error frames)
5. Edge Cases & Protocol Faults (malformed frames, empty content, oversized frames, auth timeouts, stream collisions)
"""

import asyncio
import json
import math
import os
import sys
import time
import uuid
from typing import Any, Dict, List, Optional
import websockets
from websockets.exceptions import ConnectionClosed, InvalidStatus

GATEWAY_WS = os.environ.get("GATEWAY_WS", "ws://127.0.0.1:8080/api/secure/ws")
API_TOKEN = os.environ.get("API_TOKEN", "kiwi_secret_token_dev")


def calc_stats(values: List[float]) -> Dict[str, float]:
    if not values:
        return {"min": 0.0, "max": 0.0, "avg": 0.0, "median": 0.0, "p95": 0.0, "stddev": 0.0}
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    avg = sum(sorted_vals) / n
    median = sorted_vals[n // 2]
    p95 = sorted_vals[min(int(n * 0.95), n - 1)]
    variance = sum((x - avg) ** 2 for x in sorted_vals) / n
    stddev = math.sqrt(variance)
    return {
        "min": round(min(sorted_vals), 2),
        "max": round(max(sorted_vals), 2),
        "avg": round(avg, 2),
        "median": round(median, 2),
        "p95": round(p95, 2),
        "stddev": round(stddev, 2),
    }


async def run_single_client(client_idx: int, prompt_suffix: str, auth_type: str = "bearer") -> Dict[str, Any]:
    unique_id = f"client-{client_idx}-{uuid.uuid4().hex[:8]}"
    conv_id = f"conv-{unique_id}"
    prompt = f"stress-test query {unique_id} {prompt_suffix}"

    url = GATEWAY_WS
    headers = {}
    if auth_type == "bearer":
        headers["Authorization"] = f"Bearer {API_TOKEN}"
    elif auth_type == "query":
        url = f"{GATEWAY_WS}?token={API_TOKEN}"

    result: Dict[str, Any] = {
        "client_idx": client_idx,
        "unique_id": unique_id,
        "conversation_id": conv_id,
        "auth_type": auth_type,
        "success": False,
        "error": None,
        "connect_latency_ms": 0.0,
        "ttft_ms": 0.0,
        "total_stream_ms": 0.0,
        "tokens_received": 0,
        "token_intervals_ms": [],
        "received_thinking": False,
        "thinking_before_stream": False,
        "received_complete": False,
        "complete_content": None,
        "concatenated_tokens": "",
        "token_isolation_violation": False,
        "frames_received": [],
    }

    t_start = time.perf_counter()
    try:
        t_conn_0 = time.perf_counter()
        async with websockets.connect(url, additional_headers=headers if headers else None) as ws:
            result["connect_latency_ms"] = (time.perf_counter() - t_conn_0) * 1000.0

            if auth_type == "initial_frame":
                await ws.send(json.dumps({"type": "auth", "content": API_TOKEN}))
                await asyncio.sleep(0.05)

            chat_frame = {
                "type": "chat.message",
                "conversation_id": conv_id,
                "content": prompt,
            }

            t_send = time.perf_counter()
            await ws.send(json.dumps(chat_frame))

            first_token_time: Optional[float] = None
            last_token_time: Optional[float] = None
            stream_tokens: List[str] = []

            while True:
                raw_frame = await asyncio.wait_for(ws.recv(), timeout=15.0)
                t_recv = time.perf_counter()
                msg = json.loads(raw_frame)
                msg_type = msg.get("type")
                result["frames_received"].append(msg_type)

                if msg_type == "status.thinking":
                    result["received_thinking"] = True
                    if first_token_time is None:
                        result["thinking_before_stream"] = True

                elif msg_type == "chat.stream":
                    token = msg.get("content", "")
                    stream_tokens.append(token)
                    if first_token_time is None:
                        first_token_time = t_recv
                        result["ttft_ms"] = (first_token_time - t_send) * 1000.0
                    else:
                        delta = (t_recv - last_token_time) * 1000.0
                        result["token_intervals_ms"].append(delta)
                    last_token_time = t_recv

                elif msg_type == "chat.complete":
                    result["received_complete"] = True
                    result["complete_content"] = msg.get("content", "")
                    result["total_stream_ms"] = (t_recv - t_send) * 1000.0
                    break

                elif msg_type == "error":
                    result["error"] = msg.get("content") or "Received error frame"
                    break

            result["tokens_received"] = len(stream_tokens)
            result["concatenated_tokens"] = "".join(stream_tokens)

            # Verification assertions
            concat_match = result["concatenated_tokens"] == result["complete_content"]
            contains_unique = unique_id.lower() in (result["complete_content"] or "").lower()

            if (
                result["received_thinking"]
                and result["thinking_before_stream"]
                and result["received_complete"]
                and result["tokens_received"] > 0
                and concat_match
                and contains_unique
            ):
                result["success"] = True
            else:
                reasons = []
                if not result["received_thinking"]:
                    reasons.append("Missing status.thinking")
                if not result["thinking_before_stream"]:
                    reasons.append("status.thinking did not arrive before stream")
                if not result["received_complete"]:
                    reasons.append("Missing chat.complete")
                if not concat_match:
                    reasons.append("Stream mismatch vs complete")
                if not contains_unique:
                    reasons.append("Complete content missing unique client id")
                result["error"] = "; ".join(reasons)

    except Exception as e:
        result["error"] = str(e)
        result["total_stream_ms"] = (time.perf_counter() - t_start) * 1000.0

    return result


async def test_concurrent_clients(num_clients: int) -> Dict[str, Any]:
    print(f"\n=======================================================")
    print(f"  Test: {num_clients} Concurrent WebSocket Clients")
    print(f"=======================================================")

    t0 = time.perf_counter()
    # Launch simultaneous connections
    tasks = []
    for i in range(num_clients):
        # Alternate between bearer and query auth
        auth_mode = "bearer" if i % 2 == 0 else "query"
        tasks.append(run_single_client(i, f"payload_{i}_alpha", auth_type=auth_mode))

    client_results = await asyncio.gather(*tasks)
    total_wall_time = time.perf_counter() - t0

    successful = [r for r in client_results if r["success"]]
    failed = [r for r in client_results if not r["success"]]

    # Cross-talk / Token Mixing check:
    # Verify that NO client's response contains another client's unique id!
    all_unique_ids = [r["unique_id"] for r in client_results]
    token_mixing_detected = False
    mixing_details = []

    for r in client_results:
        content = r["complete_content"] or r["concatenated_tokens"]
        for other_id in all_unique_ids:
            if other_id != r["unique_id"] and other_id.lower() in content.lower():
                token_mixing_detected = True
                mixing_details.append(f"Client {r['unique_id']} received tokens belonging to {other_id}")

    # Latency & Token Rate Stats
    ttfts = [r["ttft_ms"] for r in successful]
    stream_durations = [r["total_stream_ms"] for r in successful]
    conn_latencies = [r["connect_latency_ms"] for r in successful]
    all_intervals = []
    for r in successful:
        all_intervals.extend(r["token_intervals_ms"])

    total_tokens = sum(r["tokens_received"] for r in successful)
    overall_token_rate = total_tokens / total_wall_time if total_wall_time > 0 else 0

    report = {
        "num_clients": num_clients,
        "total_wall_time_s": round(total_wall_time, 3),
        "successful_clients": len(successful),
        "failed_clients": len(failed),
        "success_rate_pct": round((len(successful) / num_clients) * 100.0, 1),
        "token_mixing_detected": token_mixing_detected,
        "mixing_details": mixing_details,
        "total_tokens_received": total_tokens,
        "overall_token_throughput_tps": round(overall_token_rate, 2),
        "connect_latency_ms": calc_stats(conn_latencies),
        "ttft_ms": calc_stats(ttfts),
        "token_interval_cadence_ms": calc_stats(all_intervals),
        "total_stream_duration_ms": calc_stats(stream_durations),
        "failed_details": [{"idx": r["client_idx"], "error": r["error"]} for r in failed],
    }

    print(f"Results for {num_clients} Concurrent Clients:")
    print(f"  Success: {len(successful)}/{num_clients} ({report['success_rate_pct']}%) in {round(total_wall_time, 2)}s")
    print(f"  Token Mixing: {'DETECTED ❌' if token_mixing_detected else 'NONE (Clean Isolation) ✓'}")
    print(f"  Total Tokens: {total_tokens} across {len(successful)} streams ({report['overall_token_throughput_tps']} tok/s)")
    print(f"  TTFT (ms): avg={report['ttft_ms']['avg']}, p95={report['ttft_ms']['p95']}, min={report['ttft_ms']['min']}, max={report['ttft_ms']['max']}")
    print(f"  Token Cadence (ms): avg={report['token_interval_cadence_ms']['avg']}, median={report['token_interval_cadence_ms']['median']}, stddev={report['token_interval_cadence_ms']['stddev']}")
    print(f"  Stream Duration (ms): avg={report['total_stream_duration_ms']['avg']}, p95={report['total_stream_duration_ms']['p95']}")
    if failed:
        print(f"  FAILURES: {report['failed_details']}")

    return report


async def test_message_routing_and_edge_cases() -> Dict[str, Any]:
    print(f"\n=======================================================")
    print(f"  Test: Message Type Routing & Edge Case Faults")
    print(f"=======================================================")
    edge_results = {}

    headers = {"Authorization": f"Bearer {API_TOKEN}"}

    # Case 1: Empty message content
    print("\n[Edge 1] Sending empty content '   '...")
    try:
        async with websockets.connect(GATEWAY_WS, additional_headers=headers) as ws:
            await ws.send(json.dumps({"type": "chat.message", "content": "   "}))
            # Wait 1 second to see if server replies or closes
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=1.0)
                edge_results["empty_message"] = {"behavior": "received_frame", "frame": msg}
                print(f"  Received response on empty message: {msg}")
            except asyncio.TimeoutError:
                edge_results["empty_message"] = {"behavior": "silently_ignored"}
                print("  Empty message silently ignored (no response sent).")
    except Exception as e:
        edge_results["empty_message"] = {"behavior": "error", "error": str(e)}
        print(f"  Empty message caused: {e}")

    # Case 2: Malformed JSON frame
    print("\n[Edge 2] Sending malformed JSON...")
    try:
        async with websockets.connect(GATEWAY_WS, additional_headers=headers) as ws:
            await ws.send("THIS IS NOT JSON {{{")
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=1.0)
                edge_results["malformed_json"] = {"behavior": "received_frame", "frame": msg}
                print(f"  Received response on malformed JSON: {msg}")
            except asyncio.TimeoutError:
                edge_results["malformed_json"] = {"behavior": "silently_ignored"}
                print("  Malformed JSON silently ignored (connection kept alive).")
    except Exception as e:
        edge_results["malformed_json"] = {"behavior": "error", "error": str(e)}
        print(f"  Malformed JSON caused: {e}")

    # Case 3: Unknown message type
    print("\n[Edge 3] Sending unknown message type 'banana.peel'...")
    try:
        async with websockets.connect(GATEWAY_WS, additional_headers=headers) as ws:
            await ws.send(json.dumps({"type": "banana.peel", "content": "test"}))
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=1.0)
                edge_results["unknown_type"] = {"behavior": "received_frame", "frame": msg}
                print(f"  Received response on unknown type: {msg}")
            except asyncio.TimeoutError:
                edge_results["unknown_type"] = {"behavior": "silently_ignored"}
                print("  Unknown type silently ignored.")
    except Exception as e:
        edge_results["unknown_type"] = {"behavior": "error", "error": str(e)}
        print(f"  Unknown type caused: {e}")

    # Case 4: Unauthenticated non-auth frame
    print("\n[Edge 4] Sending chat.message without prior authentication...")
    try:
        async with websockets.connect(GATEWAY_WS) as ws:
            await ws.send(json.dumps({"type": "chat.message", "content": "unauth test"}))
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
                edge_results["unauth_chat"] = {"behavior": "received_frame", "frame": msg}
            except ConnectionClosed as cc:
                edge_results["unauth_chat"] = {"behavior": "closed_4401", "code": cc.code, "reason": cc.reason}
                print(f"  Unauthenticated chat closed with code {cc.code} ({cc.reason}) ✓")
    except Exception as e:
        edge_results["unauth_chat"] = {"behavior": "error", "error": str(e)}
        print(f"  Unauthenticated chat caused: {e}")

    # Case 5: Auth frame timeout (client connects unauth, does not send auth within 5.5s)
    print("\n[Edge 5] Testing 5-second unauthenticated timeout...")
    t_start = time.perf_counter()
    try:
        async with websockets.connect(GATEWAY_WS) as ws:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=6.5)
                edge_results["auth_timeout"] = {"behavior": "received_frame", "frame": msg}
            except ConnectionClosed as cc:
                elapsed = time.perf_counter() - t_start
                edge_results["auth_timeout"] = {
                    "behavior": "closed_timeout",
                    "code": cc.code,
                    "reason": cc.reason,
                    "elapsed_s": round(elapsed, 2),
                }
                print(f"  Connection closed after {round(elapsed, 2)}s with code {cc.code} ({cc.reason}) ✓")
    except Exception as e:
        edge_results["auth_timeout"] = {"behavior": "error", "error": str(e)}
        print(f"  Auth timeout error: {e}")

    # Case 6: Rapid back-to-back chat.message frames on same connection (Stream Preemption)
    print("\n[Edge 6] Rapid back-to-back chat.message frames on single connection...")
    try:
        async with websockets.connect(GATEWAY_WS, additional_headers=headers) as ws:
            msg1 = {"type": "chat.message", "conversation_id": "c-preempt-1", "content": "first long message 1"}
            msg2 = {"type": "chat.message", "conversation_id": "c-preempt-2", "content": "second immediate message 2"}

            await ws.send(json.dumps(msg1))
            # Wait 50ms so stream starts
            await asyncio.sleep(0.05)
            # Send second message while first is streaming
            await ws.send(json.dumps(msg2))

            frames = []
            while True:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=4.0)
                    msg = json.loads(raw)
                    frames.append(msg)
                    if msg.get("type") == "chat.complete" and msg.get("conversation_id") == "c-preempt-2":
                        break
                except asyncio.TimeoutError:
                    break

            c1_completes = [f for f in frames if f.get("conversation_id") == "c-preempt-1" and f.get("type") == "chat.complete"]
            c2_completes = [f for f in frames if f.get("conversation_id") == "c-preempt-2" and f.get("type") == "chat.complete"]
            edge_results["stream_preemption"] = {
                "total_frames": len(frames),
                "c1_completed": len(c1_completes) > 0,
                "c2_completed": len(c2_completes) > 0,
                "frame_types": [f.get("type") for f in frames],
            }
            print(f"  Back-to-back result: c1 completed={len(c1_completes) > 0}, c2 completed={len(c2_completes) > 0}")
    except Exception as e:
        edge_results["stream_preemption"] = {"error": str(e)}
        print(f"  Rapid messages caused: {e}")

    # Case 7: Oversized message frame (> 512KB)
    print("\n[Edge 7] Oversized frame (>512KB max message size)...")
    try:
        async with websockets.connect(GATEWAY_WS, additional_headers=headers) as ws:
            huge_content = "X" * (520 * 1024)
            await ws.send(json.dumps({"type": "chat.message", "content": huge_content}))
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
                edge_results["oversized_frame"] = {"behavior": "received", "frame": msg}
            except ConnectionClosed as cc:
                edge_results["oversized_frame"] = {"behavior": "closed", "code": cc.code, "reason": cc.reason}
                print(f"  Oversized frame closed connection with code {cc.code} ({cc.reason}) ✓")
    except Exception as e:
        edge_results["oversized_frame"] = {"behavior": "error", "error": str(e)}
        print(f"  Oversized frame caused: {e}")

    return edge_results


async def main():
    print("#######################################################")
    print("  Milestone 2 Empirical Stress & Challenge Suite      ")
    print("#######################################################")

    # Run 10-client concurrency test
    results_10 = await test_concurrent_clients(10)

    # Run 20-client concurrency test
    results_20 = await test_concurrent_clients(20)

    # Run message routing and edge cases
    edge_results = await test_message_routing_and_edge_cases()

    final_report = {
        "concurrency_10": results_10,
        "concurrency_20": results_20,
        "edge_cases": edge_results,
    }

    report_path = "/root/kiwi/scripts/m2_stress_results.json"
    with open(report_path, "w") as f:
        json.dump(final_report, f, indent=2)

    print(f"\nSaved complete benchmark results to {report_path}")


if __name__ == "__main__":
    asyncio.run(main())
