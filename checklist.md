# Kiwi AI System — Morning Setup Checklist

This document contains all the manual configuration steps required to bring the **Kiwi API Gateway** online. 

> [!TIP]
> You can print this page to PDF (Ctrl/Cmd + P) to save it locally or send it to your devices.

---

## 1. Supabase Database Configuration

Before the Go server starts, the database needs the correct schema.

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Open the **SQL Editor**.
3. Copy and run the following SQL script to create the memory tables:

```sql
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'New Conversation',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE role_type AS ENUM ('user', 'assistant', 'system', 'tool');

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role role_type NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
```

4. Go to **Settings > Database > Connection string > URI**.
5. Copy your connection string. 
   *(Make sure to use port `6543` for connection pooling and append `?pgbouncer=true` if required by Supabase).*

---

## 2. GitHub Actions Secrets (CI/CD)

To allow GitHub to automatically deploy your code to the VPS when you push to the `main` branch, you need to add three secrets.

Go to your GitHub Repository **Settings** ➔ **Secrets and variables** ➔ **Actions**, and add:

| Secret Name | Value Example | Description |
| :--- | :--- | :--- |
| `VPS_HOST` | `198.51.100.23` | The public IP address (or domain) of your VPS. |
| `VPS_USER` | `root` or `ubuntu` | The SSH username you use to log into the VPS. |
| `VPS_SSH_KEY` | `-----BEGIN OPENSSH...` | The private SSH key that allows access to your server. |

---

## 3. VPS Environment Variables

SSH into your VPS and create a `.env` file in your `~/kiwi` directory so PM2 can load it into your Go binary.

**Command:**
```bash
nano ~/kiwi/.env
```

**Contents:**
```env
# Networking
PORT=8080

# API Security (Generate a secure token: openssl rand -base64 32)
API_TOKEN="paste_your_secure_random_token_here"

# Database (Paste the URI you got from Supabase in Step 1)
DATABASE_URL="postgres://postgres.your_project:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

---

## 4. Starting the Services on the VPS

Once the `.env` file is ready, start the application via PM2 and reload Caddy to handle port forwarding (80 -> 8080).

```bash
# Navigate to your project directory
cd ~/kiwi

# Start or restart the Go application using PM2
pm2 start ecosystem.config.js --env production --update-env

# Apply the Caddy reverse proxy configuration
caddy reload --config /root/kiwi/infra/caddy/Caddyfile
```

---

## 5. Testing the Setup (From your Laptop)

Once everything is running, open your laptop terminal and run these commands to verify the system works.

### Test 1: Health Check (Public)
Checks if the server is up and connected to Supabase.
```bash
curl http://<YOUR_VPS_IP>/api/health
```
*Expected Output: `{"status":"ok", "database":"connected", ...}`*

### Test 2: AI Orchestrator "Dumb Echo" (Secure)
Tests the authentication token and the database memory insertions. 
*(Replace `<YOUR_API_TOKEN>` and `<YOUR_VPS_IP>`)*
```bash
curl -X POST http://<YOUR_VPS_IP>/api/secure/chat \
  -H "Authorization: Bearer <YOUR_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"message": "Good morning, Jarvis."}'
```
*Expected Output: `{"conversation_id": "...", "response": "Echo: I heard you say 'Good morning, Jarvis.'"}`*
