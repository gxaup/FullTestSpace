#!/bin/bash
# -----------------------------------------------------------
# Topview Logger — Double-Click Test Server Launcher (macOS)
# -----------------------------------------------------------

# Navigate to the folder containing this .command file
cd "$(dirname "$0")"

# Clear terminal screen for a clean start
clear

# Execute the test server
python3 start_server.py "$@"

# If server stops, pause so the Terminal window doesn't suddenly vanish
echo ""
read -n 1 -s -r -p "Server stopped. Press any key to close this window..."
echo ""
