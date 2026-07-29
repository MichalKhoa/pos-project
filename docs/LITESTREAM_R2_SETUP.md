# Cloudflare R2 + Litestream Setup Guide for Himmel POS

This guide explains how to set up **Litestream** real-time cloud replication for `pos_store.db` using **Cloudflare R2** (zero egress fees, 10 GB free storage).

---

## ⚡ Why Cloudflare R2 + Litestream?

- **0 Seconds Data Loss**: Litestream streams SQLite WAL changes continuously in real-time.
- **$0 Cost**: Cloudflare R2 offers 10 GB free storage and **$0 egress bandwidth fees**.
- **Instant Recovery**: If the cashier PC hard drive fails, your entire sales database is restored in seconds.

---

## ☁️ Step 1: Create Cloudflare R2 Bucket & API Credentials

1. **Log in to Cloudflare**: Go to [dash.cloudflare.com](https://dash.cloudflare.com/).
2. **Navigate to R2**: Click **R2** in the left sidebar menu.
3. **Create Bucket**:
   - Click **Create bucket**.
   - Name: `himmel-pos-backups`
   - Click **Create Bucket**.
4. **Copy Account ID**:
   - Look at the right sidebar under **Account Details** or the browser URL.
   - Copy your **Account ID** (e.g. `a1b2c3d4e5f678901234567890abcdef`).
5. **Create R2 API Token**:
   - On the R2 overview page, click **Manage R2 API Tokens** (top right).
   - Click **Create API Token**.
   - Token Name: `Himmel POS Litestream`
   - Permissions: Select **Object Read & Write**.
   - Click **Create API Token**.
6. ⚠️ **Copy Credentials**:
   - **Access Key ID** (e.g. `9f8e7d6c5b4a3...`)
   - **Secret Access Key** (e.g. `1a2b3c4d5e6f...`)

---

## 💻 Step 2: Download Litestream on Cashier PC

1. Download `litestream-v0.3.13-windows-amd64.zip` from [Litestream GitHub Releases](https://github.com/benbjohnson/litestream/releases).
2. Extract `litestream.exe` into `C:\Himmel_POS\backend\`.

---

## ⚙️ Step 3: Configure `litestream.yml`

Open `C:\Himmel_POS\backend\litestream.yml` and replace:
- `<ACCOUNT_ID>` with your Cloudflare Account ID.
- `access-key-id` with your R2 Access Key ID.
- `secret-access-key` with your R2 Secret Access Key.

Example `litestream.yml`:
```yaml
logging:
  level: info

dbs:
  - path: ./pos_store.db
    replicas:
      - type: s3
        endpoint: https://a1b2c3d4e5f67890.r2.cloudflarestorage.com
        bucket: himmel-pos-backups
        path: store_01/pos_store.db
        access-key-id: YOUR_R2_ACCESS_KEY_ID
        secret-access-key: YOUR_R2_SECRET_ACCESS_KEY
        sync-interval: 1s
        snapshot-interval: 24h
        retention: 72h
```

---

## 🚀 Step 4: Run Real-Time Replication

To test replication manually:
```cmd
cd C:\Himmel_POS\backend
litestream.exe replicate -config litestream.yml
```

You will see log output indicating active streaming:
```
litestream: initialized db: path="./pos_store.db"
litestream: replica initialized: type="s3" bucket="himmel-pos-backups" path="store_01/pos_store.db"
```

---

## 🔄 How to Restore Database on a New Computer

If a cashier PC fails, install Himmel POS on a new computer and run:

```cmd
cd C:\Himmel_POS\backend
litestream.exe restore -config litestream.yml -o pos_store.db
```

Litestream will download the latest snapshot and replay all real-time transaction logs up to the exact last second before the failure!
