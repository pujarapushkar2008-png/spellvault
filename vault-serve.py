"""
vault-serve.py — Local server for SpellVault
Run:  python vault-serve.py
Opens: http://localhost:5173

Browser storage (IndexedDB) is tied to this exact address.
Always use http://localhost:5173 to open the app.
"""

import http.server, os, sys

PORT      = 5173
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    def log_message(self, fmt, *args):
        print(f"  {args[0]}")

if __name__ == "__main__":
    try:
        with http.server.HTTPServer(("127.0.0.1", PORT), Handler) as server:
            print(f"\n  ✦ SpellVault running at  http://localhost:{PORT}\n")
            print("  Press Ctrl+C to stop.\n")
            server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped."); sys.exit(0)
    except OSError as e:
        if e.errno in (98, 10048):
            print(f"\n  Port {PORT} already in use. Open http://localhost:{PORT}\n")
        else:
            raise
