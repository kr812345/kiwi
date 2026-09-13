# Useful Linux Networking Commands Cheatsheet

Quick reference for VPS network management, firewall configuration, port inspection, and troubleshooting.

---

## 1. Firewall (UFW)
```bash
# Check status and active rules
sudo ufw status verbose
sudo ufw status numbered          # Shows rule numbers (useful for deleting)

# Manage rules
sudo ufw allow 22/tcp             # Allow SSH (CRITICAL: do before enabling ufw)
sudo ufw allow 80/tcp             # Allow HTTP
sudo ufw allow 443/tcp            # Allow HTTPS
sudo ufw allow 8080/tcp           # Allow custom port (e.g. dev API)
sudo ufw delete allow 8080/tcp    # Delete rule by specification
sudo ufw delete <rule_number>     # Delete rule by number (from status numbered)

# Allow traffic only from a specific IP address
sudo ufw allow from <YOUR_IP> to any port 22 proto tcp

# Enable / reload / disable
sudo ufw enable                   # Turn firewall on
sudo ufw reload                   # Reload rules without dropping connections
sudo ufw disable                  # Turn firewall off
```

---

## 2. Listening Ports & Active Processes
```bash
# Show all listening TCP and UDP ports with process names (Modern standard)
ss -tulpn

# Filter only listening ports
ss -tulpn | grep LISTEN

# Find which exact process is using a specific port (e.g. 8080)
sudo lsof -i :8080

# Kill whatever is holding a specific port
sudo fuser -k 8080/tcp
```

---

## 3. IP Addresses & Interface Info
```bash
# Show all network interfaces and assigned local IP addresses
ip addr show
# Or short form:
ip a

# Get your VPS public IPv4 address
curl -4 ifconfig.me
# Or:
curl -s https://ipinfo.io/ip

# Show default gateway and routing table
ip route show
```

---

## 4. Connection & Port Testing
```bash
# Test if a local or remote port is open without sending data (Netcat)
nc -zv 127.0.0.1 5432            # Test if local Postgres is listening
nc -zv <REMOTE_IP> 443           # Test if remote HTTPS port is reachable

# Inspect HTTP headers, status code, and latency
curl -I https://example.com
curl -v http://localhost:8080/health   # Verbose output (shows handshake & headers)

# ICMP ping test (4 packets)
ping -c 4 1.1.1.1
```

---

## 5. DNS Diagnostics
```bash
# Query DNS A record for a domain
dig +short example.com
dig example.com A

# Query DNS using nslookup
nslookup example.com

# Check which DNS servers your VPS is using
cat /etc/resolv.conf
```

---

## 6. Live Traffic & Diagnostics
```bash
# Monitor live network bandwidth per socket (if installed)
sudo iftop -i eth0

# Trace route hops to target
traceroute 1.1.1.1
# Or modern interactive traceroute:
mtr 1.1.1.1

# Capture live packets on a specific port (debugging traffic)
sudo tcpdump -i any -n port 80
```
