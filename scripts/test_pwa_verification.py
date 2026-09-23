#!/usr/bin/env python3
"""
Comprehensive PWA Verification Test Suite for Milestone 3.
Validates:
1. Static Asset HTTP 200 & Correct MIME Types (without authentication)
2. PWA Manifest & Service Worker Spec Compliance
3. HTML DOM Structure & UI Element Contracts
4. JavaScript Syntax Validation (via node --check)
5. Simulated PWA Client Lifecycle (Auth Ping -> WS Stream -> Message Completion)
"""

import asyncio
import json
import os
import subprocess
import sys
import httpx
import websockets
from bs4 import BeautifulSoup

GATEWAY_URL = os.environ.get("GATEWAY_URL", "http://127.0.0.1:8080")
GATEWAY_WS = os.environ.get("GATEWAY_WS", "ws://127.0.0.1:8080/api/secure/ws")
API_TOKEN = os.environ.get("API_TOKEN", "kiwi_secret_token_dev")


async def test_static_assets_http():
    print("\n--- 1. Testing Static Asset Serving & MIME Types ---")
    assets = [
        ("/", 200, "text/html"),
        ("/index.html", 200, "text/html"),
        ("/styles.css", 200, "text/css"),
        ("/app.js", 200, ["application/javascript", "text/javascript"]),
        ("/manifest.json", 200, ["application/json", "application/manifest+json"]),
        ("/sw.js", 200, ["application/javascript", "text/javascript"]),
        ("/icon.svg", 200, "image/svg+xml"),
        ("/icon-192.png", 200, "image/png"),
        ("/icon-512.png", 200, "image/png"),
    ]

    async with httpx.AsyncClient() as client:
        for path, expected_status, expected_mime in assets:
            url = f"{GATEWAY_URL}{path}"
            # Ensure static assets are accessible unauthenticated!
            resp = await client.get(url, follow_redirects=True)
            assert resp.status_code == expected_status, f"Expected {expected_status} for {path}, got {resp.status_code}"
            
            content_type = resp.headers.get("content-type", "").lower()
            if isinstance(expected_mime, list):
                assert any(m in content_type for m in expected_mime), f"MIME mismatch for {path}: {content_type}"
            else:
                assert expected_mime in content_type, f"MIME mismatch for {path}: {content_type}"
            print(f"✓ {path.ljust(16)} -> HTTP {resp.status_code} [{content_type.split(';')[0]}]")


async def test_pwa_manifest_and_sw():
    print("\n--- 2. Testing PWA Manifest & Service Worker Specs ---")
    async with httpx.AsyncClient() as client:
        # Check manifest
        resp = await client.get(f"{GATEWAY_URL}/manifest.json")
        assert resp.status_code == 200
        manifest = resp.json()
        assert manifest.get("name") == "Kiwi AI Assistant"
        assert manifest.get("short_name") == "Kiwi"
        assert manifest.get("display") == "standalone"
        assert manifest.get("theme_color") == "#0D1117"
        assert len(manifest.get("icons", [])) >= 2
        print("✓ manifest.json is valid and standalone-compliant")

        # Check sw.js
        resp_sw = await client.get(f"{GATEWAY_URL}/sw.js")
        assert resp_sw.status_code == 200
        sw_text = resp_sw.text
        assert "caches.open" in sw_text or "CACHE_NAME" in sw_text
        assert "/index.html" in sw_text
        assert "/styles.css" in sw_text
        assert "/app.js" in sw_text
        print("✓ sw.js implements caching of core shell assets")


async def test_dom_structure():
    print("\n--- 3. Testing HTML DOM & UI Element Contracts ---")
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{GATEWAY_URL}/index.html")
        assert resp.status_code == 200
        soup = BeautifulSoup(resp.text, "html.parser")

        # Viewport meta tag
        viewport = soup.find("meta", attrs={"name": "viewport"})
        assert viewport is not None, "Missing viewport meta tag"
        assert "viewport-fit=cover" in viewport.get("content", "")

        # PWA Links
        assert soup.find("link", attrs={"rel": "manifest"}) is not None, "Missing manifest link tag"
        assert soup.find("link", attrs={"rel": "stylesheet"}) is not None, "Missing stylesheet link tag"
        assert soup.find("script", attrs={"src": lambda s: s and "app.js" in s}) is not None, "Missing app.js script tag"

        # Key UI Elements
        avatar = soup.find(id="kiwi-avatar") or soup.find(class_=lambda c: c and "avatar-face" in c)
        assert avatar is not None, "Missing Kiwi avatar element (#kiwi-avatar)"
        assert "[ ^ _ ^ ]" in avatar.get_text() or "state-idle" in avatar.get("class", [])

        status_pill = soup.find(id="status-pill") or soup.find(class_=lambda c: c and "status-pill" in c)
        assert status_pill is not None, "Missing status pill element"

        chat_messages = soup.find(id="chat-messages") or soup.find(class_=lambda c: c and "chat-messages" in c)
        assert chat_messages is not None, "Missing chat messages container (#chat-messages)"

        chat_input = soup.find(id="chat-input") or soup.find("textarea")
        assert chat_input is not None, "Missing chat input element (#chat-input)"

        send_btn = soup.find(id="send-btn") or soup.find("button", attrs={"type": "submit"})
        assert send_btn is not None, "Missing send button (#send-btn)"

        auth_modal = soup.find(id="auth-modal") or soup.find(class_=lambda c: c and "modal" in c)
        assert auth_modal is not None, "Missing auth/settings modal (#auth-modal)"

        print("✓ index.html satisfies all DOM and UI element contracts")


def test_js_syntax():
    print("\n--- 4. Validating JavaScript Syntax via node --check ---")
    app_js_path = "/root/kiwi/apps/mobile/public/app.js"
    res = subprocess.run(["node", "--check", app_js_path], capture_output=True, text=True)
    assert res.returncode == 0, f"Syntax error in app.js:\n{res.stderr}"
    print("✓ app.js syntax check passed with zero errors")


async def test_simulated_pwa_client_flow():
    print("\n--- 5. Simulating PWA Client End-to-End Flow ---")
    async with httpx.AsyncClient() as client:
        # Step 5a: Token validation against GET /api/secure/ping
        headers = {"Authorization": f"Bearer {API_TOKEN}"}
        r_ping = await client.get(f"{GATEWAY_URL}/api/secure/ping", headers=headers)
        assert r_ping.status_code == 200, f"Token ping failed: {r_ping.status_code}"
        assert "pong" in r_ping.json().get("message", "")
        print("✓ Step 5a: PWA client successfully validates token via GET /api/secure/ping")

        # Step 5b: Browser-style WebSocket connection with query param
        ws_url = f"{GATEWAY_WS}?token={API_TOKEN}"
        async with websockets.connect(ws_url) as ws:
            print("✓ Step 5b: PWA connected to WebSocket via query parameter auth")

            # Step 5c: Send user chat message
            turn_msg = {
                "type": "chat.message",
                "conversation_id": "test-pwa-flow-1",
                "content": "can you verify the pwa streaming chat?"
            }
            await ws.send(json.dumps(turn_msg))

            # Step 5d: Read response stream
            thinking_received = False
            stream_tokens = []
            completed_text = None

            while True:
                raw_msg = await asyncio.wait_for(ws.recv(), timeout=10.0)
                frame = json.loads(raw_msg)
                ftype = frame.get("type")

                if ftype == "status.thinking":
                    thinking_received = True
                elif ftype == "chat.stream":
                    stream_tokens.append(frame.get("content", ""))
                elif ftype == "chat.complete":
                    completed_text = frame.get("content")
                    break

            assert thinking_received, "Expected status.thinking frame"
            assert len(stream_tokens) > 0, "Expected at least 1 stream token chunk"
            assert completed_text is not None, "Expected chat.complete frame"
            assert "".join(stream_tokens) == completed_text, "Concatenated tokens must match complete text"
            assert "kiwi" in completed_text.lower(), "Expected kiwi persona in complete response"
            print(f"✓ Step 5c & 5d: Received status.thinking, {len(stream_tokens)} stream chunks, and chat.complete")
            print(f"  Final message preview: '{completed_text[:60]}...'")


async def main():
    print("==================================================")
    print("      Kiwi PWA Milestone 3 Verification Suite     ")
    print("==================================================")
    try:
        await test_static_assets_http()
        await test_pwa_manifest_and_sw()
        await test_dom_structure()
        test_js_syntax()
        await test_simulated_pwa_client_flow()
        print("\n==================================================")
        print("  ALL PWA VERIFICATION TESTS PASSED (5/5)!         ")
        print("==================================================")
    except Exception as e:
        print(f"\n❌ PWA VERIFICATION FAILED: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
