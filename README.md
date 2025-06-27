Certainly! Below is a **complete Node.js script** that connects *many nodes (sessions)* to a single Monami account using proxies.  
- Reads one account from `main_account.txt` (`email:password` format).
- Reads proxies from `proxies.txt` (one per line, supports `ip:port` and `user:pass@ip:port`).
- Asks how many nodes to run in parallel.
- Each node logs in, maintains a session, and uses a different proxy.
- Uses `axios` and `https-proxy-agent` for proxy support.
- Includes basic error handling and colored output.

**Install dependencies first:**
```bash
npm install axios https-proxy-agent chalk
```

**Save as `multi_node.js`:**
