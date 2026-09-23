import asyncio
import json
import time
import sys
import websockets
import httpx

GATEWAY_WS = "ws://127.0.0.1:8080/api/secure/ws"
GATEWAY_HTTP = "http://127.0.0.1:8080"
API_TOKEN = "kiwi_secret_token_dev"

async def test_auth_timeout():
    print("Testing Scenario 1: Unauthenticated connection timeout (5 seconds)...")
    t0 = time.time()
    try:
        async with websockets.connect(GATEWAY_WS) as ws:
            # Wait for server to close due to auth timeout
            msg = await ws.recv()
            print(f"Unexpected message received: {msg}")
            return False
    except websockets.exceptions.ConnectionClosed as e:
        duration = time.time() - t0
        print(f"✓ Connection closed by server as expected: code={e.code}, reason='{e.reason}', duration={duration:.2f}s")
        assert e.code == 4401, f"Expected close code 4401, got {e.code}"
        assert 4.5 <= duration <= 6.5, f"Expected timeout around 5s, got {duration}s"
        return True

async def test_malformed_json():
    print("\nTesting Scenario 2: Malformed JSON payload...")
    headers = {"Authorization": f"Bearer {API_TOKEN}"}
    async with websockets.connect(GATEWAY_WS, additional_headers=headers) as ws:
        # Send raw invalid JSON
        await ws.send("NOT VALID JSON {{{")
        # Now send a valid message right after to ensure socket is still alive and responsive
        await ws.send(json.dumps({
            "type": "chat.message",
            "content": "still alive"
        }))
        received_tokens = 0
        while True:
            raw_msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
            data = json.loads(raw_msg)
            if data.get("type") == "chat.stream":
                received_tokens += 1
            elif data.get("type") == "chat.complete":
                break
        print(f"✓ Gateway ignored malformed JSON and processed next message cleanly ({received_tokens} tokens)")
        return True

async def test_empty_content_ws():
    print("\nTesting Scenario 3: Empty content over WebSocket...")
    headers = {"Authorization": f"Bearer {API_TOKEN}"}
    async with websockets.connect(GATEWAY_WS, additional_headers=headers) as ws:
        # Send empty content
        await ws.send(json.dumps({
            "type": "chat.message",
            "content": "   "
        }))
        # Wait a short time to verify no crashes and no spurious thinking frames
        try:
            msg = await asyncio.wait_for(ws.recv(), timeout=1.0)
            print(f"Unexpected message received for empty input: {msg}")
            return False
        except asyncio.TimeoutError:
            print("✓ Gateway correctly ignored empty message whitespace without spurious events")
            return True

async def test_concurrent_clients():
    print("\nTesting Scenario 4: Concurrent streaming clients (5 simultaneous streams)...")
    headers = {"Authorization": f"Bearer {API_TOKEN}"}
    
    async def client_session(client_id):
        async with websockets.connect(GATEWAY_WS, additional_headers=headers) as ws:
            payload = {
                "type": "chat.message",
                "conversation_id": f"conv-concurrent-{client_id}",
                "content": f"message from client {client_id}"
            }
            await ws.send(json.dumps(payload))
            tokens = []
            complete = None
            while True:
                raw_msg = await asyncio.wait_for(ws.recv(), timeout=10.0)
                msg = json.loads(raw_msg)
                if msg.get("type") == "chat.stream":
                    tokens.append(msg.get("content", ""))
                elif msg.get("type") == "chat.complete":
                    complete = msg.get("content")
                    break
            assert f"client {client_id}" in complete.lower()
            return len(tokens), complete

    results = await asyncio.gather(*[client_session(i) for i in range(5)])
    for i, (num_tokens, complete) in enumerate(results):
        print(f"  Client {i}: {num_tokens} tokens, verified response contains 'client {i}'")
    print("✓ All 5 concurrent client streams completed with perfect message isolation!")
    return True

async def test_rapid_user_interruption():
    print("\nTesting Scenario 5: Rapid user interruption (sending message 2 before message 1 finishes)...")
    headers = {"Authorization": f"Bearer {API_TOKEN}"}
    async with websockets.connect(GATEWAY_WS, additional_headers=headers) as ws:
        # Send message 1
        await ws.send(json.dumps({
            "type": "chat.message",
            "conversation_id": "conv-interrupt",
            "content": "first long message that will be interrupted"
        }))
        # Wait for first token
        while True:
            raw = await ws.recv()
            m = json.loads(raw)
            if m.get("type") == "chat.stream":
                print(f"  Got first stream token: {repr(m.get('content'))}")
                break
        
        # Immediately send message 2
        print("  Sending second message immediately (interrupting first)...")
        await ws.send(json.dumps({
            "type": "chat.message",
            "conversation_id": "conv-interrupt",
            "content": "second final message"
        }))

        # Collect until second chat.complete
        got_second_thinking = False
        final_complete = None
        while True:
            raw = await asyncio.wait_for(ws.recv(), timeout=10.0)
            m = json.loads(raw)
            if m.get("type") == "status.thinking":
                got_second_thinking = True
            elif m.get("type") == "chat.complete":
                final_complete = m.get("content")
                if "second final message" in final_complete.lower():
                    break

        print(f"✓ Successfully handled stream interruption, got final complete: {repr(final_complete)}")
        return True

async def test_http_empty_message_rejection():
    print("\nTesting Scenario 6: Live HTTP endpoint empty message rejection...")
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{GATEWAY_HTTP}/api/secure/chat",
            headers={"Authorization": f"Bearer {API_TOKEN}"},
            json={"message": "   "}
        )
        print(f"  Status code: {resp.status_code}, body: {resp.text.strip()}")
        assert resp.status_code == 400
        assert "cannot be empty" in resp.text.lower()
        print("✓ Live HTTP 400 Bad Request verification passed!")
        return True

async def main():
    print("==================================================")
    print("  ADVERSARIAL STRESS TEST SUITE — MILESTONE 2     ")
    print("==================================================")
    all_ok = True
    all_ok &= await test_auth_timeout()
    all_ok &= await test_malformed_json()
    all_ok &= await test_empty_content_ws()
    all_ok &= await test_concurrent_clients()
    all_ok &= await test_rapid_user_interruption()
    all_ok &= await test_http_empty_message_rejection()
    
    if all_ok:
        print("\n==================================================")
        print("  ALL ADVERSARIAL STRESS TESTS PASSED (6/6)!     ")
        print("==================================================")
    else:
        print("\n❌ SOME STRESS TESTS FAILED")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
