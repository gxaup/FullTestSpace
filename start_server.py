#!/usr/bin/env python3
"""
Topview Logger — Interactive Local Test Server
Serves the workspace with accurate MIME types (ES Modules .js, .json, .css),
no-cache development headers, CORS support, and local network discovery.
"""

import sys
import os
import re
import socket
import subprocess
import webbrowser
import ssl
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler

# Ensure current working directory is the project root
WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(WORKSPACE_DIR)

class DevServerHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.json': 'application/json',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webmanifest': 'application/manifest+json',
        '.map': 'application/json',
    }

    def end_headers(self):
        # Development headers: CORS + anti-cache so edits refresh instantly
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def log_message(self, fmt, *args):
        # Crisp colored log output
        code = str(args[1]) if len(args) > 1 else ''
        color = '\033[32m' if code.startswith('2') else '\033[33m' if code.startswith('3') else '\033[31m'
        reset = '\033[0m'
        sys.stderr.write(f"  \033[90m[{self.log_date_time_string()}]\033[0m {args[0]} -> {color}{code}{reset}\n")

def get_local_ip():
    """Finds Wi-Fi / LAN IP so phones on the same network can preview."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(('127.0.0.1', port)) == 0

def kill_port(port):
    try:
        out = subprocess.check_output(f"lsof -ti:{port}", shell=True).decode().strip()
        pids = [int(p) for p in out.split() if p.isdigit()]
        for pid in pids:
            os.kill(pid, 9)
        return True
    except Exception:
        return False

def print_banner():
    print("\033[1;36m")
    print("┌────────────────────────────────────────────────────────┐")
    print("│         TOPVIEW LOGGER — LOCAL TEST SERVER             │")
    print("│             WatchOS Redesign Edition v10.5             │")
    print("└────────────────────────────────────────────────────────┘\033[0m")

def prompt_port():
    default_port = 8080
    while True:
        print("\n\033[1mMenu Options:\033[0m")
        print(f"  \033[32m[1]\033[0m Default port (\033[1m{default_port}\033[0m)")
        print("  \033[33m[2]\033[0m Enter custom 4-digit port (1000 - 9999)")
        print("  \033[31m[3]\033[0m Exit")
        
        choice = input("\n\033[1;34mSelect an option [1-3] or type a 4-digit port directly:\033[0m ").strip()

        if choice == "" or choice == "1":
            port = default_port
        elif choice == "3" or choice.lower() in ("q", "quit", "exit"):
            print("\nExiting. Goodbye!")
            sys.exit(0)
        elif choice == "2":
            custom_input = input("\033[1;33mEnter a 4-digit port (e.g. 3000, 5000, 8000, 8888):\033[0m ").strip()
            if not (custom_input.isdigit() and len(custom_input) == 4 and 1000 <= int(custom_input) <= 9999):
                print("\033[31m✕ Invalid port: must be exactly 4 digits between 1000 and 9999.\033[0m")
                continue
            port = int(custom_input)
        elif choice.isdigit() and len(choice) == 4 and 1000 <= int(choice) <= 9999:
            port = int(choice)
        else:
            print("\033[31m✕ Invalid selection. Enter 1, 2, 3 or a 4-digit port number.\033[0m")
            continue

        # Check if port is in use
        if is_port_in_use(port):
            print(f"\n\033[33m⚠ Port {port} is currently in use by another application.\033[0m")
            action = input(f"Do you want to free port {port} and continue? (y/n, default: y): ").strip().lower()
            if action in ("", "y", "yes"):
                if kill_port(port):
                    print(f"\033[32m✓ Cleared port {port}.\033[0m")
                else:
                    print(f"\033[31m✕ Could not free port {port}. Please choose another port.\033[0m")
                    continue
            else:
                continue

        return port

def ensure_ssl_certs(local_ip):
    cert_path = os.path.join(WORKSPACE_DIR, 'server_cert.pem')
    key_path = os.path.join(WORKSPACE_DIR, 'server_key.pem')
    if os.path.exists(cert_path) and os.path.exists(key_path):
        return cert_path, key_path
    try:
        cmd = [
            'openssl', 'req', '-x509', '-newkey', 'rsa:2048',
            '-keyout', key_path, '-out', cert_path,
            '-days', '365', '-nodes',
            '-subj', '/CN=localhost',
            '-addext', f'subjectAltName=DNS:localhost,IP:127.0.0.1,IP:{local_ip}'
        ]
        subprocess.run(cmd, check=True, capture_output=True)
        return cert_path, key_path
    except Exception:
        try:
            cmd_fallback = [
                'openssl', 'req', '-x509', '-newkey', 'rsa:2048',
                '-keyout', key_path, '-out', cert_path,
                '-days', '365', '-nodes',
                '-subj', '/CN=localhost'
            ]
            subprocess.run(cmd_fallback, check=True, capture_output=True)
            return cert_path, key_path
        except Exception:
            return None, None

def main():
    print_banner()
    port = prompt_port()
    local_ip = get_local_ip()

    # Determine HTTPS port (e.g. 8443 if 8080, else port + 363)
    https_port = 8443 if port == 8080 else (port + 363 if (port + 363) < 65535 else port + 1)
    if is_port_in_use(https_port):
        kill_port(https_port)

    # 1. Start HTTP Server
    try:
        http_server = HTTPServer(('0.0.0.0', port), DevServerHandler)
    except Exception as e:
        print(f"\n\033[31m✕ Failed to bind HTTP server to port {port}: {e}\033[0m")
        sys.exit(1)

    # 2. Start Secure HTTPS Server (for mobile GPS / secure context)
    https_server = None
    cert_path, key_path = ensure_ssl_certs(local_ip)
    if cert_path and key_path:
        try:
            https_server = HTTPServer(('0.0.0.0', https_port), DevServerHandler)
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.load_cert_chain(cert_path, key_path)
            https_server.socket = context.wrap_socket(https_server.socket, server_side=True)
        except Exception as e:
            https_server = None

    url_localhost_http = f"http://localhost:{port}"
    url_localhost_https = f"https://localhost:{https_port}"
    url_network_http = f"http://{local_ip}:{port}"
    url_network_https = f"https://{local_ip}:{https_port}"

    print("\n" + "=" * 60)
    print("\033[1;32m  ✓ Local Test Servers Running Successfully!\033[0m")
    print("=" * 60)
    print(f"  \033[1m💻 DESKTOP (PC / Mac):\033[0m")
    print(f"     Local HTTP:    \033[4;36m{url_localhost_http}\033[0m")
    if https_server:
        print(f"     Local HTTPS:   \033[4;36m{url_localhost_https}\033[0m")
    print(f"\n  \033[1m📱 MOBILE (Phone / Tablet on same Wi-Fi):\033[0m")
    print(f"     Standard HTTP: \033[4;34m{url_network_http}\033[0m")
    if https_server:
        print(f"     \033[1;32m🔒 Real GPS:    {url_network_https}\033[0m")
        print(f"     \033[90m(Note: Mobile browsers strictly require HTTPS for GPS access)\033[0m")
    print(f"\n  \033[1mRoot Dir:\033[0m        {WORKSPACE_DIR}")
    print("=" * 60)
    print("\033[90m  Press Ctrl+C to stop both servers\033[0m\n")

    # Start HTTP server thread
    http_thread = threading.Thread(target=http_server.serve_forever, daemon=True)
    http_thread.start()

    # Start HTTPS server thread if available
    if https_server:
        https_thread = threading.Thread(target=https_server.serve_forever, daemon=True)
        https_thread.start()

    # Ask or auto-open in browser
    try:
        open_browser = input("Open in default web browser now? (Y/n): ").strip().lower()
        if open_browser in ("", "y", "yes"):
            webbrowser.open(url_localhost_http)
    except (EOFError, KeyboardInterrupt):
        pass

    try:
        while True:
            http_thread.join(1)
    except KeyboardInterrupt:
        print("\n\n\033[33mStopping servers...\033[0m")
        http_server.shutdown()
        http_server.server_close()
        if https_server:
            https_server.shutdown()
            https_server.server_close()
        print("\033[32mAll servers stopped cleanly.\033[0m")

if __name__ == '__main__':
    main()
