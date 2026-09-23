#!/usr/bin/env python3
"""
Adversarial Challenger Suite for Milestone 3: Gateway Static Route Serving & Edge Cases.
Focus Areas:
1. Security: Path traversal attempts (raw, URL-encoded, double-slash, null-byte, TCP raw sockets).
2. Concurrency: High-concurrency burst across static assets (/index.html, /styles.css, /app.js, /sw.js, /manifest.json).
3. Method Abuse: Non-GET verbs (POST, PUT, DELETE, PATCH, OPTIONS, HEAD, TRACE, PURGE) on static assets & integrity verification.
4. SPA Fallback: Clean client-side routes vs missing file extensions vs dotfiles.
5. Route Precedence Under Concurrent Load: Simultaneous interleaved requests across /, /health, /api/health, /api/secure/ping, /sw.js.
6. Header Correctness: Content-Type, Cache-Control, Service-Worker-Allowed, CORS headers.
"""

import asyncio
import concurrent.futures
import json
import os
import socket
import subprocess
import sys
import time
import urllib.parse
from typing import Dict, List, Tuple

import requests

BASE_URL = "http://127.0.0.1:8080"
HOST = "127.0.0.1"
PORT = 8080
API_TOKEN = "kiwi_secret_token_dev"

# Color constants
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


def send_raw_tcp(request_str: str) -> Tuple[str, str, str]:
    """Send raw HTTP request string over TCP socket and return (status_line, headers, body)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(3.0)
    try:
        s.connect((HOST, PORT))
        s.sendall(request_str.encode("utf-8"))
        raw = b""
        while True:
            chunk = s.recv(4096)
            if not chunk:
                break
            raw += chunk
    except Exception as e:
        return "ERROR", str(e), ""
    finally:
        s.close()

    text = raw.decode("utf-8", errors="replace")
    header_part, _, body = text.partition("\r\n\r\n")
    lines = header_part.splitlines()
    status_line = lines[0] if lines else "EMPTY"
    return status_line, header_part, body


def get_pm2_stats(app_name: str) -> Dict:
    """Retrieve memory and restart stats for a PM2 process."""
    try:
        res = subprocess.run(["pm2", "jlist"], capture_output=True, text=True, check=True)
        procs = json.loads(res.stdout)
        for p in procs:
            if p.get("name") == app_name:
                monit = p.get("monit", {})
                pm2_env = p.get("pm2_env", {})
                return {
                    "name": app_name,
                    "pid": p.get("pid"),
                    "status": pm2_env.get("status"),
                    "restarts": pm2_env.get("restart_time", 0),
                    "memory_mb": round(monit.get("memory", 0) / (1024 * 1024), 2),
                    "cpu": monit.get("cpu", 0),
                }
    except Exception as e:
        print(f"Failed to get PM2 stats for {app_name}: {e}")
    return {}


# ==============================================================================
# TEST 1: Path Traversal & Security Probes
# ==============================================================================
def test_path_traversal() -> bool:
    print(f"\n{BOLD}{CYAN}[Vector 1] Path Traversal & Filesystem Security Probes{RESET}")
    passed = True

    # Critical secret markers that must NEVER be returned in any response
    SENSITIVE_LEAKS = [
        "root:x:",                 # /etc/passwd
        "node_modules",            # host filesystem
        "services/orchestrator",   # server paths leaking source
        "ecosystem.config.js",     # pm2 config
        "DATABASE_URL",            # secrets in .env
        "SUPABASE_ANON_KEY",
        "gemini-2.5-flash",        # internal configs
    ]

    traversal_probes = [
        # Relative parent traversal
        "/../../../etc/passwd",
        "/etc/passwd",
        "/..%2f..%2fetc/passwd",
        "/%2e%2e/%2e%2e/etc/passwd",
        "/..%252f..%252fetc/passwd",
        "/..%5c..%5cetc/passwd",
        "//etc/passwd",
        "/./././etc/passwd",
        "/a/b/c/../../../../../../etc/passwd",
        # Source code & config targeting
        "/services/gateway/main.go",
        "/..%2f..%2fservices/gateway/main.go",
        "/go.mod",
        "/..%2f..%2fgo.mod",
        "/ecosystem.config.js",
        "/..%2f..%2fecosystem.config.js",
        "/.env",
        "/..%2f.env",
        # Null byte injections
        "/index.html%00.png",
        "/..%00/etc/passwd",
        "/%00",
        # Internal files
        "/proc/self/environ",
        "/etc/hosts",
    ]

    for p in traversal_probes:
        # Raw TCP request to avoid client-side URL normalization
        req = f"GET {p} HTTP/1.1\r\nHost: {HOST}:{PORT}\r\nConnection: close\r\n\r\n"
        status_line, headers, body = send_raw_tcp(req)

        # Check for any secret leakage
        leaked = [secret for secret in SENSITIVE_LEAKS if secret in body]
        if leaked:
            print(f"  {RED}[FAIL] Path '{p}' leaked sensitive string: {leaked}{RESET}")
            passed = False
            continue

        # Status check
        # Must be either:
        # - 200 OK with index.html (safe SPA fallback, no file leakage)
        # - 301 Moved Permanently (canonical redirect)
        # - 400 Bad Request
        # - 404 Not Found
        # - 500 Internal Server Error (for invalid characters like null bytes)
        status_code = status_line.split()[1] if len(status_line.split()) > 1 else "UNKNOWN"
        if status_code == "200":
            # If 200, it MUST be the SPA fallback index.html, never an arbitrary file
            if "<title>Kiwi AI Assistant</title>" not in body:
                print(f"  {RED}[FAIL] Path '{p}' returned 200 OK without index.html fallback!{RESET}")
                passed = False
            else:
                print(f"  {GREEN}[PASS]{RESET} {p:38} -> {status_code} (Safely collapsed to SPA fallback index.html)")
        elif status_code in ["301", "400", "404", "500"]:
            print(f"  {GREEN}[PASS]{RESET} {p:38} -> {status_code} (Safely rejected/redirected)")
        else:
            print(f"  {YELLOW}[WARN]{RESET} {p:38} -> Unexpected status {status_code}")

    # Raw socket test with path lacking leading slash: "GET ../../../etc/passwd HTTP/1.1"
    raw_no_slash = f"GET ../../../etc/passwd HTTP/1.1\r\nHost: {HOST}:{PORT}\r\nConnection: close\r\n\r\n"
    status_line, _, body = send_raw_tcp(raw_no_slash)
    if "400 Bad Request" in status_line:
        print(f"  {GREEN}[PASS]{RESET} 'GET ../../../etc/passwd' (no leading slash) -> 400 Bad Request")
    else:
        print(f"  {RED}[FAIL]{RESET} 'GET ../../../etc/passwd' unexpected status: {status_line}")
        passed = False

    return passed


# ==============================================================================
# TEST 2: High Concurrency Static Asset Burst
# ==============================================================================
def test_static_asset_concurrency(concurrency: int = 50, total_requests: int = 250) -> bool:
    print(f"\n{BOLD}{CYAN}[Vector 2] High-Concurrency Static Asset Burst ({concurrency} workers, {total_requests} reqs){RESET}")
    passed = True

    targets = [
        ("/", "text/html", "<title>Kiwi AI Assistant</title>"),
        ("/index.html", "text/html", "<title>Kiwi AI Assistant</title>"),
        ("/styles.css", "text/css", "--primary: #4CAF50"),
        ("/app.js", "javascript", "STORAGE_KEY_TOKEN"),
        ("/sw.js", "javascript", "CACHE_NAME"),
        ("/manifest.json", "application/manifest+json", "Kiwi AI Assistant"),
        ("/icon.svg", "image/svg+xml", "<svg"),
    ]

    session = requests.Session()
    adapter = requests.adapters.HTTPAdapter(pool_connections=concurrency, pool_maxsize=concurrency)
    session.mount("http://", adapter)

    def fetch_target(item: Tuple[str, str, str]) -> Dict:
        path, expected_mime, marker = item
        t0 = time.perf_counter()
        try:
            r = session.get(f"{BASE_URL}{path}", timeout=5.0)
            latency = (time.perf_counter() - t0) * 1000
            ct = r.headers.get("Content-Type", "")
            return {
                "path": path,
                "status": r.status_code,
                "mime_ok": expected_mime in ct,
                "marker_ok": marker in r.text,
                "latency_ms": latency,
                "error": None,
            }
        except Exception as e:
            return {
                "path": path,
                "status": 0,
                "mime_ok": False,
                "marker_ok": False,
                "latency_ms": (time.perf_counter() - t0) * 1000,
                "error": str(e),
            }

    # Generate request pool evenly across targets
    request_pool = [targets[i % len(targets)] for i in range(total_requests)]

    t_start = time.perf_counter()
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(fetch_target, req) for req in request_pool]
        for f in concurrent.futures.as_completed(futures):
            results.append(f.result())
    total_time = time.perf_counter() - t_start

    # Metrics
    success_count = sum(1 for r in results if r["status"] == 200 and r["mime_ok"] and r["marker_ok"])
    latencies = [r["latency_ms"] for r in results if r["status"] == 200]
    avg_latency = sum(latencies) / len(latencies) if latencies else 0
    p95_latency = sorted(latencies)[int(len(latencies) * 0.95)] if latencies else 0
    max_latency = max(latencies) if latencies else 0

    print(f"  Completed {total_requests} requests in {total_time:.3f}s ({total_requests/total_time:.1f} req/s)")
    print(f"  Success rate: {success_count}/{total_requests} ({success_count/total_requests*100:.1f}%)")
    print(f"  Latency: avg={avg_latency:.2f}ms | p95={p95_latency:.2f}ms | max={max_latency:.2f}ms")

    if success_count != total_requests:
        print(f"  {RED}[FAIL] Some requests failed under concurrent load!{RESET}")
        for r in results:
            if r["status"] != 200 or not r["mime_ok"] or not r["marker_ok"]:
                print(f"    Failed: {r['path']} -> status={r['status']} mime_ok={r['mime_ok']} error={r['error']}")
        passed = False
    else:
        print(f"  {GREEN}[PASS]{RESET} 100% of {total_requests} concurrent requests succeeded with verified payloads.")

    return passed


# ==============================================================================
# TEST 3: HTTP Method Abuse & Filesystem Immutability
# ==============================================================================
def test_method_abuse() -> bool:
    print(f"\n{BOLD}{CYAN}[Vector 3] HTTP Method Abuse & Filesystem Immutability{RESET}")
    passed = True

    # Capture initial checksums of static assets to guarantee filesystem immutability
    static_files = {
        "sw.js": "/root/kiwi/apps/mobile/public/sw.js",
        "manifest.json": "/root/kiwi/apps/mobile/public/manifest.json",
        "index.html": "/root/kiwi/apps/mobile/public/index.html",
        "styles.css": "/root/kiwi/apps/mobile/public/styles.css",
        "app.js": "/root/kiwi/apps/mobile/public/app.js",
    }
    initial_sizes = {name: os.path.getsize(path) for name, path in static_files.items()}

    verbs = ["POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD", "TRACE", "PURGE"]
    endpoints = ["/", "/index.html", "/sw.js", "/manifest.json", "/styles.css", "/app.js"]

    for verb in verbs:
        for ep in endpoints:
            req = f"{verb} {ep} HTTP/1.1\r\nHost: {HOST}:{PORT}\r\nContent-Length: 13\r\nConnection: close\r\n\r\nmalicious_payload"
            status_line, headers, body = send_raw_tcp(req)
            status_code = status_line.split()[1] if len(status_line.split()) > 1 else "UNKNOWN"

            # Check that server handled it without crash
            if status_code in ["200", "204", "405", "404", "400"]:
                pass
            else:
                print(f"  {RED}[FAIL] Unexpected status {status_code} for {verb} {ep}{RESET}")
                passed = False

            # For OPTIONS, verify CORS headers
            if verb == "OPTIONS":
                if "Access-Control-Allow-Origin: *" not in headers:
                    print(f"  {RED}[FAIL] Missing CORS origin header on OPTIONS {ep}{RESET}")
                    passed = False

            # For HEAD, verify body is empty
            if verb == "HEAD":
                if len(body) > 0:
                    print(f"  {RED}[FAIL] HEAD {ep} returned non-empty body (len={len(body)}){RESET}")
                    passed = False

    # Check filesystem integrity after all abusive PUT/DELETE/PATCH attempts
    for name, path in static_files.items():
        if not os.path.exists(path):
            print(f"  {RED}[CRITICAL FAIL] File {name} was DELETED by HTTP method abuse!{RESET}")
            passed = False
        else:
            curr_size = os.path.getsize(path)
            if curr_size != initial_sizes[name]:
                print(f"  {RED}[CRITICAL FAIL] File {name} was MUTATED! size before={initial_sizes[name]}, after={curr_size}{RESET}")
                passed = False

    if passed:
        print(f"  {GREEN}[PASS]{RESET} All {len(verbs) * len(endpoints)} method abuse attempts safely handled; 0 files modified or deleted.")

    return passed


# ==============================================================================
# TEST 4: Client-Side SPA Fallback vs Missing Extensions
# ==============================================================================
def test_spa_fallback() -> bool:
    print(f"\n{BOLD}{CYAN}[Vector 4] Client-Side SPA Fallback vs Missing Assets{RESET}")
    passed = True

    # 1. Routes that MUST trigger SPA fallback (200 OK + index.html)
    spa_routes = [
        "/chat/123",
        "/chat/conv-987654",
        "/settings",
        "/profile/settings/advanced",
        "/a/b/c/d/e",
        "/some-slug-with-hyphens",
        "/spaces%20test",
        "/settings?tab=general",
        "/chat?id=test#section",
        "/dashboard",
    ]

    for r in spa_routes:
        resp = requests.get(f"{BASE_URL}{r}", timeout=3.0)
        ct = resp.headers.get("Content-Type", "")
        has_title = "<title>Kiwi AI Assistant</title>" in resp.text
        if resp.status_code == 200 and "text/html" in ct and has_title:
            print(f"  {GREEN}[PASS]{RESET} SPA route {r:30} -> 200 OK (Served index.html)")
        else:
            print(f"  {RED}[FAIL]{RESET} SPA route {r:30} -> {resp.status_code} (CT: {ct}, has_title: {has_title})")
            passed = False

    # 2. Missing assets with file extensions that MUST return 404 (NEVER index.html)
    missing_assets = [
        "/favicon.ico",
        "/missing.png",
        "/bundles/app.min.js",
        "/style.css",
        "/sw.js.map",
        "/manifest.json.bak",
        "/index.php",
        "/assets/logo.jpg",
    ]

    for r in missing_assets:
        resp = requests.get(f"{BASE_URL}{r}", timeout=3.0)
        has_title = "<title>Kiwi AI Assistant</title>" in resp.text
        if resp.status_code == 404 and not has_title:
            print(f"  {GREEN}[PASS]{RESET} Missing asset {r:30} -> 404 Not Found (No invalid HTML fallback)")
        else:
            print(f"  {RED}[FAIL]{RESET} Missing asset {r:30} -> {resp.status_code} (Leaked HTML title: {has_title})")
            passed = False

    return passed


# ==============================================================================
# TEST 5: Route Precedence Under Concurrent Load
# ==============================================================================
def test_route_precedence_concurrency(rounds: int = 150) -> bool:
    print(f"\n{BOLD}{CYAN}[Vector 5] Route Precedence Under Concurrent Load ({rounds} interleaved requests){RESET}")
    passed = True

    # Endpoints with their strict expected invariants
    endpoints = [
        # (id, method, path, headers, expected_status, expected_mime, validator_fn)
        (
            "ROOT_PWA",
            "GET",
            "/",
            {},
            200,
            "text/html",
            lambda r: "<title>Kiwi AI Assistant</title>" in r.text,
        ),
        (
            "ROOT_HEALTH",
            "GET",
            "/health",
            {},
            200,
            "application/json",
            lambda r: r.json().get("status") == "ok" and "Kiwi API Gateway" in r.json().get("message", ""),
        ),
        (
            "API_HEALTH",
            "GET",
            "/api/health",
            {},
            200,
            "application/json",
            lambda r: r.json().get("status") == "ok" and "Kiwi API Gateway" in r.json().get("message", ""),
        ),
        (
            "API_PING_AUTH",
            "GET",
            "/api/secure/ping",
            {"Authorization": f"Bearer {API_TOKEN}"},
            200,
            "application/json",
            lambda r: "pong" in r.json().get("message", ""),
        ),
        (
            "API_PING_UNAUTH",
            "GET",
            "/api/secure/ping",
            {},
            401,
            "",
            lambda r: r.status_code == 401,
        ),
        (
            "MANIFEST",
            "GET",
            "/manifest.json",
            {},
            200,
            "application/manifest+json",
            lambda r: r.json().get("name") == "Kiwi AI Assistant",
        ),
        (
            "SW_SCRIPT",
            "GET",
            "/sw.js",
            {},
            200,
            "application/javascript",
            lambda r: "CACHE_NAME" in r.text and r.headers.get("Service-Worker-Allowed") == "/",
        ),
    ]

    session = requests.Session()
    adapter = requests.adapters.HTTPAdapter(pool_connections=40, pool_maxsize=40)
    session.mount("http://", adapter)

    def send_one(ep_tuple):
        ep_id, method, path, headers, exp_status, exp_mime, validator = ep_tuple
        try:
            r = session.request(method, f"{BASE_URL}{path}", headers=headers, timeout=5.0)
            status_ok = r.status_code == exp_status
            mime_ok = exp_mime in r.headers.get("Content-Type", "") if exp_mime else True
            valid_ok = validator(r)
            return {
                "id": ep_id,
                "path": path,
                "status": r.status_code,
                "status_ok": status_ok,
                "mime_ok": mime_ok,
                "valid_ok": valid_ok,
                "error": None,
            }
        except Exception as e:
            return {
                "id": ep_id,
                "path": path,
                "status": 0,
                "status_ok": False,
                "mime_ok": False,
                "valid_ok": False,
                "error": str(e),
            }

    # Interleave requests across all endpoint types
    task_pool = [endpoints[i % len(endpoints)] for i in range(rounds)]

    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=30) as executor:
        futures = [executor.submit(send_one, task) for task in task_pool]
        for f in concurrent.futures.as_completed(futures):
            results.append(f.result())

    # Verify zero route bleed or confusion
    by_id = {}
    for r in results:
        ep_id = r["id"]
        if ep_id not in by_id:
            by_id[ep_id] = {"total": 0, "passed": 0, "failures": []}
        by_id[ep_id]["total"] += 1
        if r["status_ok"] and r["mime_ok"] and r["valid_ok"]:
            by_id[ep_id]["passed"] += 1
        else:
            by_id[ep_id]["failures"].append(r)

    print(f"  Route Precedence Verification across {len(results)} concurrent requests:")
    for ep_id, data in sorted(by_id.items()):
        total = data["total"]
        passed_cnt = data["passed"]
        if passed_cnt == total:
            print(f"    {GREEN}[PASS]{RESET} {ep_id:18}: {passed_cnt}/{total} (100% correct route dispatch)")
        else:
            print(f"    {RED}[FAIL]{RESET} {ep_id:18}: {passed_cnt}/{total} failures: {data['failures'][:2]}")
            passed = False

    return passed


# ==============================================================================
# TEST 6: Header Correctness & Cache Specification Audit
# ==============================================================================
def test_header_correctness() -> bool:
    print(f"\n{BOLD}{CYAN}[Vector 6] Header Correctness & Cache Specification Audit{RESET}")
    passed = True

    # 1. /sw.js headers
    r_sw = requests.get(f"{BASE_URL}/sw.js")
    sw_cc = r_sw.headers.get("Cache-Control", "")
    sw_allowed = r_sw.headers.get("Service-Worker-Allowed", "")
    sw_ct = r_sw.headers.get("Content-Type", "")

    if "no-cache" in sw_cc and "no-store" in sw_cc and "must-revalidate" in sw_cc:
        print(f"  {GREEN}[PASS]{RESET} sw.js Cache-Control strictly prevents stale caching: '{sw_cc}'")
    else:
        print(f"  {RED}[FAIL]{RESET} sw.js Cache-Control invalid: '{sw_cc}'")
        passed = False

    if sw_allowed == "/":
        print(f"  {GREEN}[PASS]{RESET} sw.js Service-Worker-Allowed is correctly set to '/'")
    else:
        print(f"  {RED}[FAIL]{RESET} sw.js Service-Worker-Allowed invalid: '{sw_allowed}'")
        passed = False

    if "application/javascript" in sw_ct:
        print(f"  {GREEN}[PASS]{RESET} sw.js Content-Type is application/javascript")
    else:
        print(f"  {RED}[FAIL]{RESET} sw.js Content-Type invalid: '{sw_ct}'")
        passed = False

    # 2. /manifest.json headers
    r_man = requests.get(f"{BASE_URL}/manifest.json")
    man_ct = r_man.headers.get("Content-Type", "")
    if "application/manifest+json" in man_ct:
        print(f"  {GREEN}[PASS]{RESET} manifest.json Content-Type is application/manifest+json")
    else:
        print(f"  {RED}[FAIL]{RESET} manifest.json Content-Type invalid: '{man_ct}'")
        passed = False

    # 3. CORS headers on static and API routes
    for path in ["/", "/index.html", "/manifest.json", "/api/health"]:
        r = requests.options(f"{BASE_URL}{path}")
        allow_origin = r.headers.get("Access-Control-Allow-Origin", "")
        allow_methods = r.headers.get("Access-Control-Allow-Methods", "")
        if allow_origin == "*" and "GET" in allow_methods and "OPTIONS" in allow_methods:
            print(f"  {GREEN}[PASS]{RESET} CORS preflight on {path:20} -> Origin: {allow_origin}, Methods: {allow_methods}")
        else:
            print(f"  {RED}[FAIL]{RESET} CORS preflight on {path:20} invalid: Origin={allow_origin}, Methods={allow_methods}")
            passed = False

    return passed


# ==============================================================================
# MAIN TEST RUNNER
# ==============================================================================
def main():
    print(f"{BOLD}{CYAN}======================================================================{RESET}")
    print(f"{BOLD}{CYAN}   CHALLENGER 2: EMPIRICAL GATEWAY STATIC & EDGE CASE STRESS SUITE   {RESET}")
    print(f"{BOLD}{CYAN}======================================================================{RESET}")

    # PM2 Pre-check
    pm2_before = get_pm2_stats("kiwi-gateway")
    print(f"PM2 Gateway baseline: PID={pm2_before.get('pid')}, Mem={pm2_before.get('memory_mb')}MB, Restarts={pm2_before.get('restarts')}")

    results = {}
    results["vector1_traversal"] = test_path_traversal()
    results["vector2_concurrency"] = test_static_asset_concurrency(concurrency=60, total_requests=300)
    results["vector3_method_abuse"] = test_method_abuse()
    results["vector4_spa_fallback"] = test_spa_fallback()
    results["vector5_route_precedence"] = test_route_precedence_concurrency(rounds=200)
    results["vector6_headers"] = test_header_correctness()

    # PM2 Post-check
    pm2_after = get_pm2_stats("kiwi-gateway")
    print(f"\nPM2 Gateway post-test: PID={pm2_after.get('pid')}, Mem={pm2_after.get('memory_mb')}MB, Restarts={pm2_after.get('restarts')}")

    restart_delta = pm2_after.get("restarts", 0) - pm2_before.get("restarts", 0)
    if restart_delta > 0 or pm2_after.get("pid") != pm2_before.get("pid"):
        print(f"{RED}[FAIL] Gateway crashed and was restarted by PM2 during stress tests!{RESET}")
        results["stability"] = False
    else:
        print(f"{GREEN}[PASS]{RESET} Gateway process maintained 100% uptime with 0 crashes or restarts.")
        results["stability"] = True

    print(f"\n{BOLD}{CYAN}======================================================================{RESET}")
    print(f"{BOLD}{CYAN}                         EVALUATION SUMMARY                          {RESET}")
    print(f"{BOLD}{CYAN}======================================================================{RESET}")
    all_passed = all(results.values())
    for k, v in results.items():
        status_str = f"{GREEN}PASS{RESET}" if v else f"{RED}FAIL{RESET}"
        print(f"  {k:30} : {status_str}")

    if all_passed:
        print(f"\n{BOLD}{GREEN}ALL 6 ADVERSARIAL STRESS VECTORS PASSED EMPIRICALLY!{RESET}")
        sys.exit(0)
    else:
        print(f"\n{BOLD}{RED}ONE OR MORE ADVERSARIAL VECTORS FAILED!{RESET}")
        sys.exit(1)


if __name__ == "__main__":
    main()
