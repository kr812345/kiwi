import asyncio
import json
import time
import httpx
import websockets

BRAIN_STREAM_URL = "http://127.0.0.1:9100/internal/chat/stream"
GATEWAY_WS_URL = "ws://127.0.0.1:8080/api/secure/ws"
API_TOKEN = "kiwi_secret_token_dev"

async def test_brain_sse_timing():
    print("=== Testing Direct Python Brain SSE Stream Timing ===")
    async with httpx.AsyncClient(timeout=30.0) as client:
        req_body = {"message": "analyze system architecture performance"}
        t0 = time.perf_counter()
        delays = []
        tokens = []
        last_t = t0
        async with client.stream("POST", BRAIN_STREAM_URL, json=req_body) as response:
            assert response.status_code == 200, f"Status code: {response.status_code}"
            assert response.headers.get("content-type", "").startswith("text/event-stream")
            async for line in response.aiter_lines():
                t = time.perf_counter()
                if line.startswith("data: "):
                    payload = json.loads(line[6:])
                    if payload.get("done"):
                        break
                    token = payload.get("token")
                    if token is not None:
                        delays.append(t - last_t)
                        tokens.append(token)
                        last_t = t
    
    print(f"Total tokens received from SSE: {len(tokens)}")
    print(f"Total time: {sum(delays):.4f}s")
    print(f"Average inter-token delay: {sum(delays)/len(delays)*1000:.2f}ms")
    print(f"First 5 inter-token delays (ms): {[round(d*1000, 2) for d in delays[:5]]}")
    # Inter-token delay should reflect progressive yielding (around ~25ms per token)
    # The first token includes prompt processing, subsequent tokens are spaced ~25ms
    inter_token_delays = delays[1:]
    avg_interval = sum(inter_token_delays) / len(inter_token_delays)
    print(f"Average interval between consecutive tokens (excluding TTFT): {avg_interval*1000:.2f}ms")
    assert avg_interval > 0.015, f"Tokens arrived too fast ({avg_interval*1000:.2f}ms), possible buffered dump!"
    print("✓ Direct Python SSE is yielding progressively token-by-token!")
    return tokens

async def test_ws_streaming_timing():
    print("\n=== Testing WebSocket Gateway Token-by-Token Streaming Timing ===")
    headers = {"Authorization": f"Bearer {API_TOKEN}"}
    async with websockets.connect(GATEWAY_WS_URL, additional_headers=headers) as ws:
        msg = {
            "type": "chat.message",
            "conversation_id": f"timing-test-{int(time.time())}",
            "content": "analyze system architecture performance"
        }
        await ws.send(json.dumps(msg))
        
        delays = []
        tokens = []
        thinking_received = False
        completed_received = False
        last_t = time.perf_counter()

        while True:
            raw = await asyncio.wait_for(ws.recv(), timeout=10.0)
            t = time.perf_counter()
            frame = json.loads(raw)
            ftype = frame.get("type")
            if ftype == "status.thinking":
                thinking_received = True
                print(f"Received thinking at +{(t - last_t)*1000:.2f}ms")
                last_t = t
            elif ftype == "chat.stream":
                delays.append(t - last_t)
                tokens.append(frame.get("content"))
                last_t = t
            elif ftype == "chat.complete":
                completed_received = True
                print(f"Received chat.complete: '{frame.get('content')}'")
                break

        print(f"Total WS tokens received: {len(tokens)}")
        print(f"First 5 WS inter-token delays (ms): {[round(d*1000, 2) for d in delays[:5]]}")
        inter_token_delays = delays[1:]
        avg_ws_interval = sum(inter_token_delays) / len(inter_token_delays)
        print(f"Average WS interval between consecutive tokens (excluding TTFT): {avg_ws_interval*1000:.2f}ms")
        
        assert thinking_received, "Missing status.thinking"
        assert completed_received, "Missing chat.complete"
        assert len(tokens) > 5, "Not enough tokens received"
        assert avg_ws_interval > 0.015, f"WS tokens arrived too fast ({avg_ws_interval*1000:.2f}ms), possible buffered dump!"
        print("✓ Gateway is relaying tokens in real-time over WebSocket as they arrive from Python SSE!")

async def main():
    await test_brain_sse_timing()
    await test_ws_streaming_timing()
    print("\nALL EMPIRICAL TIMING CHECKS PASSED!")

if __name__ == "__main__":
    asyncio.run(main())
