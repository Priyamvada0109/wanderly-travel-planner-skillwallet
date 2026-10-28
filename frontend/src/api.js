// Every call to the backend goes through here.
// In production set VITE_API_URL to your Render URL; in development the Vite proxy handles /api.
const BASE = import.meta.env.VITE_API_URL || "";

async function request(path, options = {}) {
  const res = await fetch(BASE + path, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) {
    let msg = "Something went wrong. Please try again.";
    try {
      const j = await res.json();
      msg = typeof j.detail === "string" ? j.detail : "Please check the form and try again.";
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  health: () => request("/api/health"),
  plan: (plan) => request("/api/plan", { method: "POST", body: JSON.stringify(plan) }),
  trips: () => request("/api/trips"),
  saveTrip: (trip) => request("/api/trips", { method: "POST", body: JSON.stringify(trip) }),
  deleteTrip: (id) => request(`/api/trips/${id}`, { method: "DELETE" }),
};
