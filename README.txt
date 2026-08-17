LINKLINE — VERCEL FIXED BUILD

This build uses Vercel's documented WebSocket function layout:
- Static site at the project root
- WebSocket backend at api/ws.js
- Fluid Compute enabled in vercel.json

UPLOAD TO GITHUB
1. Upload index.html, app.js, style.css, audio-worklet.js, package.json, vercel.json.
2. Create an api folder in GitHub and put ws.js inside it as api/ws.js.
3. Import the repo into Vercel.
4. Framework Preset: Other.
5. Leave Build Command blank/default.
6. Deploy.

If Vercel still shows FUNCTION_INVOCATION_FAILED, open the deployment Runtime Logs and send the first red error line to ChatGPT.

Note: this prototype stores room membership in function memory. A production-grade version should use shared realtime state so multiple Vercel function instances can coordinate reliably.
