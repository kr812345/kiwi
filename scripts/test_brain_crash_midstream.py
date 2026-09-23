import asyncio
import json
import subprocess
import time
import websockets

GATEWAY_WS = "ws://127.0.0.1:8080/api/secure/ws"
API_TOKEN = "kiwi_secret_token_dev"

async def test_brain_crash():
    headers = {"Authorization": f"Bearer {API_TOKEN}"}
    print("Connecting to WebSocket...")
    ws = await websockets.connect(GATEWAY_WS, additional_headers=headers)
    
    send_payload = {
        "type": "chat.message",
        "conversation_id": "test-crash-1",
        "content": "write a very long detailed explanation of distributed consensus algorithms"
    }
    await ws.send(json.dumps(send_payload))
    print("Sent message, waiting for tokens...")
    
    token_count = 0
    killed = False
    
    try:
        while True:
            raw_msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
            msg = json.loads(raw_msg)
            mtype = msg.get("type")
            print(f"Received frame: type={mtype}, content={msg.get('content')}")
            
            if mtype == "chat.stream":
                token_count += 1
                if token_count == 3 and not killed:
                    print("--> Killing kiwi-brain via pm2 stop kiwi-brain...")
                    subprocess.run(["pm2", "stop", "kiwi-brain"], check=True)
                    killed = True
                    print("--> kiwi-brain stopped! Continuing to listen on websocket...")
            elif mtype == "chat.complete":
                print(f"--> Received chat.complete! content={msg.get('content')}")
                break
            elif mtype == "error":
                print(f"--> Received error frame: {msg}")
                break
    except websockets.exceptions.ConnectionClosed as e:
        print(f"--> WebSocket closed by server: code={e.code}, reason={e.reason}")
    except asyncio.TimeoutError:
        print("--> TIMEOUT! No message received for 5 seconds after brain stopped!")
    finally:
        await ws.close()
        # Restart kiwi-brain
        print("Restarting kiwi-brain...")
        subprocess.run(["pm2", "restart", "kiwi-brain"], check=True)

if __name__ == "__main__":
    asyncio.run(test_brain_crash())
