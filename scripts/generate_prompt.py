#!/usr/bin/env python3
"""
Himmel POS — Interactive Prompt Generator
Run this script to generate high-precision AI prompts for expanding Himmel POS.
Usage: python3 scripts/generate_prompt.py
"""

import os

def main():
    print("=" * 60)
    print(" 🚀 Himmel POS — Interactive Feature Prompt Generator")
    print("=" * 60)
    print("Answer the questions below to generate a tailored AI prompt.\n")

    # Question 1: Feature Title
    feature_name = input("1. Feature Name (e.g. Table Management / Customer Loyalty): ").strip()
    if not feature_name:
        feature_name = "New Feature"

    # Question 2: Scope Choice
    print("\n2. Which components does this feature touch?")
    print("   [1] Backend API & Database only")
    print("   [2] Frontend UI only")
    print("   [3] Full-Stack (Backend DB/API + Frontend UI)")
    print("   [4] Hardware Driver / External Peripheral")
    scope_choice = input("Choice (1-4, default 3): ").strip()

    if scope_choice == "1":
        scope_desc = "Backend API & Database in `backend/routers/` and `backend/models.py`"
    elif scope_choice == "2":
        scope_desc = "Frontend UI components in `src/components/` and `src/App.jsx`"
    elif scope_choice == "4":
        scope_desc = "Hardware driver in `backend/services/` and router endpoint"
    else:
        scope_desc = "Full-Stack (Backend API `backend/routers/`, DB `backend/models.py`, Frontend UI `src/components/`)"

    # Question 3: Main User Capability
    capability = input("\n3. What should the cashier/user be able to do?\n   -> ").strip()

    # Question 4: Offline / Auto-migration rule
    db_migration = input("\n4. Does this add new database fields? (y/n, default y): ").strip().lower()
    needs_migration = db_migration != 'n'

    # Question 5: Key Acceptance Criteria
    criteria = input("\n5. Success Criterion (e.g. Must run offline, sub-100ms response, zero lint errors):\n   -> ").strip()
    if not criteria:
        criteria = "Must pass `npm run lint` and work seamlessly in silent kiosk mode."

    # Build Prompt Output
    prompt_text = f"""Please implement the following feature for Himmel POS:

Feature: {feature_name}

Goal:
Allow the user/cashier to {capability}.

Scope & Target Files:
- {scope_desc}

Technical Constraints & Requirements:"""

    if needs_migration:
        prompt_text += "\n1. Non-Breaking DB Migration: Add any new SQLAlchemy columns to `MIGRATIONS` array in `backend/main.py`."

    prompt_text += f"""
2. Maintain offline resiliency and compatibility with SQLite WAL mode.
3. Ensure touch targets are at least 48px for 15-inch kiosk touchscreen compatibility.
4. Add Czech translation strings to `src/i18n/translations.js`.

Acceptance Criteria:
- {criteria}
- Verify zero linter errors with `npm run lint`.
"""

    print("\n" + "=" * 60)
    print("  ✅ GENERATED AI PROMPT (COPY & PASTE BELOW):")
    print("=" * 60 + "\n")
    print(prompt_text)
    print("=" * 60)

    # Save to prompt_output.txt
    out_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "prompt_output.txt")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(prompt_text)
    print(f"\n[INFO] Prompt saved to: {out_path}")

if __name__ == "__main__":
    main()
