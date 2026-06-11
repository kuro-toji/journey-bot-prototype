#!/usr/bin/env python3
"""
Generate a bot-test reference file from the seeded users in the DB.

Output: data/bot_test_data.csv with columns:
  phone,dob,pan,aadhaar,full_name

  - phone   : 10-digit mobile (CHAR(10) in DB)
  - dob     : YYYY-MM-DD  (the format the bot asks for)
  - pan     : AAAAA9999A  (the format the bot asks for)
  - aadhaar : 12 digits, space-separated as XXXX XXXX XXXX (synthetic,
              not stored in DB; included for reference)
  - full_name

Usage:
  python3 scripts/generate_bot_test_data.py

Re-runnable; deterministic if the seed DB is the same.

This file is gitignored (data/ is excluded). It is meant for local
testing of the FinBot verify flow only.
"""

import csv
import os
import re
import subprocess
import sys
import hashlib

OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'bot_test_data.csv')

# 12-digit Aadhaar is XXXX XXXX XXXX (Verhoeff checksum is not enforced
# for synthetic data; we use a stable SHA-256 of the phone so the
# mapping is reproducible across regenerations).
def synthetic_aadhaar(phone: str) -> str:
    h = hashlib.sha256(phone.encode()).digest()
    # take 12 hex digits, mod 10 each
    digits = ''.join(str(b % 10) for b in h[:12])
    return f"{digits[0:4]} {digits[4:8]} {digits[8:12]}"

def main():
    sql = """
      SELECT mobile_number, date_of_birth::text, pan_number, full_name
        FROM "user"
       ORDER BY mobile_number
    """
    env = {
        **os.environ,
        'PGHOST': os.environ.get('PGHOST', 'localhost'),
        'PGPORT': os.environ.get('PGPORT', '5432'),
        'PGUSER': os.environ.get('PGUSER', 'postgres'),
        'PGPASSWORD': os.environ.get('PGPASSWORD', '12345678'),
        'PGDATABASE': os.environ.get('PGDATABASE', 'blostem')
    }
    out = subprocess.check_output(['psql', '-t', '-A', '-F', '|', '-c', sql], env=env).decode()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(['phone', 'dob', 'pan', 'aadhaar', 'full_name'])
        n = 0
        for line in out.splitlines():
            if not line.strip(): continue
            phone, dob, pan, name = line.split('|')
            phone = phone.strip()
            pan   = pan.strip()
            dob   = dob.strip()
            name  = name.strip()
            w.writerow([phone, dob, pan, synthetic_aadhaar(phone), name])
            n += 1
    print(f"Wrote {n} rows to {OUT}")

if __name__ == '__main__':
    main()
