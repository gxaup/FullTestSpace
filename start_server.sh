#!/bin/bash
# Topview Logger — Test Server Launcher
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$DIR/start_server.py" "$@"
