# Himmel POS — Cashier PC Setup & Remote Update Guide

This guide provides step-by-step instructions for setting up a cashier's touchscreen Windows computer to run **Himmel POS** and receive remote updates from your development machine.

---

## 🏗️ Architecture Overview

```
 [ Your Dev PC ]                           [ Cashier PC ]
  (Write Code)                             (Touchscreen POS)
       │                                           │
  git push origin master               1. Click "Aktualizovat systém"
       │                               2. Runs git pull & DB migrate
       ▼                               3. Restarts app automatically
┌─────────────────────────────────────────────────────────────────┐
│                      GitHub Repository                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Phase 1: Creating a GitHub Personal Access Token (PAT Tokenization)

If your GitHub repository is **Private**, you must generate a token so the cashier's computer can pull updates automatically without asking for a password.

### Step 1: Generate Token on GitHub (From Your Dev PC or Browser)

1. Log into your GitHub account and go to **Settings** (click your profile picture -> Settings).
2. Scroll down the left sidebar to **Developer settings**.
3. Click **Personal access tokens** -> **Fine-grained tokens** (or Tokens classic).
4. Click **Generate new token**.
5. Configure Token Settings:
   - **Token Name**: `Himmel POS Cashier PC`
   - **Expiration**: `No expiration` (or 1 year / 90 days)
   - **Repository access**: Select **Only select repositories** -> choose `pos-project-himmel`.
   - **Permissions**: Click **Repository permissions** -> set **Contents** to **Read-only**.
6. Click **Generate token**.
7. ⚠️ **Copy the token immediately** (it looks like `github_pat_11...` or `ghp_...`). You will not be able to see it again.

---

### Step 2: Configure Tokenized Git URL on Cashier PC

On the Cashier PC, open Command Prompt (`cmd.exe`) in `C:\Himmel_POS` and run:

```cmd
:: Format: git remote set-url origin https://x-access-token:TOKEN@github.com/USERNAME/REPOSITORY.git

git remote set-url origin https://x-access-token:github_pat_11ABC123YOUR_TOKEN_HERE@github.com/MichalKhoa/pos-project-himmel.git
```

Test that tokenization works cleanly:
```cmd
git fetch origin
```
If no error or password prompt appears, tokenization is successful! All future background update requests and `git pull` calls will execute 100% automatically.

---

## 🛠️ Phase 2: One-Time Setup on Cashier Computer

Follow these steps once on the cashier's Windows machine.

### Step 1: Install Required Software

1. **Python 3.10+**:
   - Download from [python.org](https://www.python.org/downloads/).
   - ⚠️ **CRITICAL**: Check the box **"Add python.exe to PATH"** during installation.

2. **Git for Windows**:
   - Download from [git-scm.com](https://git-scm.com/download/win).
   - Install with default settings.

3. **Node.js (LTS)**:
   - Download from [nodejs.org](https://nodejs.org/).
   - Install with default settings.

---

### Step 2: Clone Repository & Install Dependencies

Open Command Prompt on the Cashier PC:

```cmd
:: 1. Clone repository to C:\Himmel_POS (using tokenized URL)
git clone https://x-access-token:YOUR_TOKEN_HERE@github.com/MichalKhoa/pos-project-himmel.git C:\Himmel_POS
cd C:\Himmel_POS

:: 2. Set up Python Backend Environment
cd backend
python -m venv venv
call .\venv\Scripts\activate.bat
pip install -r requirements.txt

:: 3. Set up Frontend Web Application
cd C:\Himmel_POS
npm install
npm run build
```

---

### Step 3: Create Desktop Shortcuts for Cashier

1. Right-click **`Himmel_POS.bat`** (or `Himmel_POS_Kiosk.bat` for full-screen mode).
2. Click **Send to -> Desktop (create shortcut)**.
3. Rename shortcut to **Himmel POS Register**.

---

## 🚀 Phase 3: Daily Operation & Remote Updates Workflow

### How You Deploy New Features (From Your Dev PC):

Whenever you finish a bug fix or new feature on your machine:
```bash
git add .
git commit -m "feat: updated receipt layout and added discounts"
git push origin master
```

---

### How Cashier Receives Updates (On Cashier PC):

#### Method 1: Touchscreen UI (Recommended)
1. Cashier opens **Nastavení (Settings)** in Himmel POS.
2. In the **Systémové Aktualizace (System Updates)** section, click **Zkontrolovat**.
3. If new changes exist, click **Aktualizovat systém** -> **Stáhnout a instalovat**.
4. The POS app will pull code, run database migrations, and restart automatically.

#### Method 2: 1-Click Batch Launcher
Double-click **`Himmel_POS_Update.bat`** on the cashier PC desktop anytime.

---

## 🔒 Security & Data Protection Notes

- **Database Integrity**: Local SQLite database (`backend/pos_store.db`) and receipts history are ignored by Git (`.gitignore`). Running `git pull` will **NEVER** delete sales ledger history or register settings.
- **EET Certificates**: PKCS#12 certificates stored in `backend/certs/` remain preserved on the cashier PC during updates.
