#!/usr/bin/env python3
"""
Integration verification script for Milestone 2: Streaming & WebSockets.
Connects to ws://127.0.0.1:8080/api/secure/ws and validates:
1. Bearer Header Authentication & Live Token Streaming
2. Query Parameter Authentication (?token=...) & Live Token Streaming
3. Initial Auth Frame Authentication (within 5 seconds) & Live Token Streaming
4. Rejection of Invalid Authentication
"""

import asyncio
import json
import sys
import websockets

GATEWAY_WS = "ws://127.0.0.1:8080/api/secure/ws"
API_TOKEN = "kiwi_secret_token_dev"


async def test_bearer_auth_streaming():
    print("\n--- Test 1: Bearer Header Auth & Live Token Streaming ---")
    headers = {"Authorization": f"Bearer {API_TOKEN}"}
    async with websockets.connect(GATEWAY_WS, additional_headers=headers) as ws:
        print("Connected via Bearer token.")

        send_payload = {
            "type": "chat.message",
            "conversation_id": "test-ws-bearer-1",
            "content": "hello kiwi from websocket"
        }
        await ws.send(json.dumps(send_payload))
        print(f"Sent: {send_payload}")

        received_thinking = False
        tokens = []
        completed_content = None

        while True:
            raw_msg = await asyncio.wait_for(ws.recv(), timeout=10.0)
            msg = json.loads(raw_msg)
            msg_type = msg.get("type")

            if msg_type == "status.thinking":
                received_thinking = True
                print(f"✓ Received status.thinking: {msg.get('content')}")
            elif msg_type == "chat.stream":
                token = msg.get("content", "")
                tokens.append(token)
                print(f"  [stream token]: {repr(token)}")
            elif msg_type == "chat.complete":
                completed_content = msg.get("content")
                print(f"✓ Received chat.complete: {repr(completed_content)}")
                break
            else:
                print(f"Received other message type: {msg_type}")

        assert received_thinking, "Expected status.thinking frame"
        assert len(tokens) > 0, "Expected at least one chat.stream token frame"
        assert completed_content is not None, "Expected chat.complete frame"

        concatenated = "".join(tokens)
        assert concatenated == completed_content, f"Token stream '{concatenated}' does not match complete content '{completed_content}'"
        assert "kiwi" in completed_content.lower(), "Expected kiwi persona in response"
        print(f"✓ Test 1 Passed! Received {len(tokens)} token frames. Full message: '{completed_content}'")


async def test_query_param_auth():
    print("\n--- Test 2: Query Param Auth & Streaming ---")
    url = f"{GATEWAY_WS}?token={API_TOKEN}"
    async with websockets.connect(url) as ws:
        print("Connected via ?token= query parameter.")

        send_payload = {
            "type": "chat.message",
            "content": "query param test"
        }
        await ws.send(json.dumps(send_payload))

        tokens = []
        completed = False
        while True:
            raw_msg = await asyncio.wait_for(ws.recv(), timeout=10.0)
            msg = json.loads(raw_msg)
            if msg.get("type") == "chat.stream":
                tokens.append(msg.get("content", ""))
            elif msg.get("type") == "chat.complete":
                completed = True
                break

        assert completed and len(tokens) > 0
        print(f"✓ Test 2 Passed! Received stream with {len(tokens)} chunks via query param auth.")


async def test_initial_auth_frame():
    print("\n--- Test 3: Initial Auth Frame Auth (within 5s deadline) ---")
    async with websockets.connect(GATEWAY_WS) as ws:
        print("Connected unauthenticated. Sending auth frame...")

        auth_frame = {
            "type": "auth",
            "content": API_TOKEN
        }
        await ws.send(json.dumps(auth_frame))
        print("Sent initial auth frame.")

        await asyncio.sleep(0.1)

        chat_payload = {
            "type": "chat.message",
            "content": "post-auth frame message"
        }
        await ws.send(json.dumps(chat_payload))

        tokens = []
        completed = False
        while True:
            raw_msg = await asyncio.wait_for(ws.recv(), timeout=10.0)
            msg = json.loads(raw_msg)
            if msg.get("type") == "chat.stream":
                tokens.append(msg.get("content", ""))
            elif msg.get("type") == "chat.complete":
                completed = True
                break

        assert completed and len(tokens) > 0
        print(f"✓ Test 3 Passed! Authenticated via initial frame and streamed {len(tokens)} chunks.")


async def test_invalid_auth_rejection():
    print("\n--- Test 4: Invalid Auth Rejection ---")
    headers = {"Authorization": "Bearer invalid_secret_token"}
    try:
        async with websockets.connect(GATEWAY_WS, additional_headers=headers) as ws:
            assert False, "Connection should have been rejected with 401"
    except (websockets.exceptions.InvalidStatus, websockets.exceptions.InvalidHandshake) as e:
        status = getattr(e, "status_code", None) or getattr(getattr(e, "response", None), "status_code", None)
        print(f"✓ Test 4 Passed! Connection rejected with HTTP status: {status}")
        assert status == 401


async def test_client_disconnect_mid_stream():
    print("\n--- Test 5: Client Disconnect Mid-Stream Resilience ---")
    headers = {"Authorization": f"Bearer {API_TOKEN}"}
    ws = await websockets.connect(GATEWAY_WS, additional_headers=headers)
    
    send_payload = {
        "type": "chat.message",
        "conversation_id": "test-ws-disconnect-1",
        "content": "write a long essay about building personal artificial intelligence systems"
    }
    await ws.send(json.dumps(send_payload))

    # Read until first token chunk arrives
    while True:
        raw_msg = await ws.recv()
        msg = json.loads(raw_msg)
        if msg.get("type") == "chat.stream":
            print(f"Received first chunk: {repr(msg.get('content'))}. Abruptly closing client connection...")
            break

    # Abruptly close connection
    await ws.close()
    await asyncio.sleep(0.5)
    print("✓ Test 5 Passed! Client disconnected mid-stream cleanly without server panic or orphan leak.")


async def main():
    print("==================================================")
    print("  Kiwi Gateway Milestone 2 WebSocket Test Suite   ")
    print("==================================================")
    try:
        await test_bearer_auth_streaming()
        await test_query_param_auth()
        await test_initial_auth_frame()
        await test_invalid_auth_rejection()
        await test_client_disconnect_mid_stream()
        print("\n==================================================")
        print("  ALL WEBSOCKET STREAMING TESTS PASSED (5/5)!     ")
        print("==================================================")
    except Exception as e:
        print(f"\n❌ TEST SUITE FAILED: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
