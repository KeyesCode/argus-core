#!/usr/bin/env python3
"""Take a screenshot of the Argus Explorer frontend."""

from playwright.sync_api import sync_playwright
import sys
import os

BASE_URL = os.environ.get("EXPLORER_URL", "http://localhost:3001")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "docs")

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 900})

        # Home page
        print(f"Navigating to {BASE_URL}...")
        page.goto(BASE_URL, wait_until="networkidle", timeout=15000)
        page.wait_for_timeout(1000)

        output_path = os.path.join(OUTPUT_DIR, "explorer-home.png")
        page.screenshot(path=output_path, full_page=True)
        print(f"Saved: {output_path}")

        browser.close()

if __name__ == "__main__":
    main()
