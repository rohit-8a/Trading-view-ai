/**
 * api.js — thin wrapper around fetch() for talking to our own backend.
 * The frontend NEVER calls Delta Exchange or the AI provider directly;
 * everything routes through /api/* so secrets stay server-side.
 */
const Api = {
  async get(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    return res.json();
  },
  async post(path, body) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    return res.json();
  },
};
