import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

const INTERESTS = ["Food", "Culture", "Nature", "Adventure", "Relax", "Shopping", "Nightlife"];
const PACES = [["slow", "Slow", "2-3 stops, long breaks"], ["balanced", "Balanced", "Sights and downtime"], ["packed", "Packed", "See as much as possible"]];
const inr = (n) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
// Each destination gets its own colour, so every boarding pass looks different.
const hue = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

export default function App() {
  const [view, setView] = useState("plan");
  const [theme, setTheme] = useState(() => localStorage.getItem("wanderly-theme") || "dark");
  const [form, setForm] = useState({ destination: "", days: 3, travelers: 2, budget: 30000, pace: "balanced", interests: ["Food", "Culture"] });
  const [trip, setTrip] = useState(null); // { id?, plan, itinerary }
  const [day, setDay] = useState(0);
  const [saved, setSaved] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(null);

  useEffect(() => { api.health().then(setOnline).catch(() => setOnline({ ok: false })); }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("wanderly-theme", theme);
  }, [theme]);
  useEffect(() => { if (view === "saved") api.trips().then(setSaved).catch((e) => setError(e.message)); }, [view]);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2000); };

  const generate = async (e) => {
    e.preventDefault();
    setError(""); setBusy("plan");
    try {
      const plan = { ...form, interests: form.interests.map((i) => i.toLowerCase()) };
      const res = await api.plan(plan);
      setTrip({ plan, itinerary: res.itinerary });
      setDay(0); setView("trip"); window.scrollTo(0, 0);
    } catch (err) { setError(err.message); } finally { setBusy(""); }
  };

  const save = async () => {
    setBusy("save");
    try {
      const row = await api.saveTrip({ id: trip.id, plan: trip.plan, itinerary: trip.itinerary });
      setTrip({ ...trip, id: row.id });
      flash("Trip saved");
    } catch (err) { setError(err.message); } finally { setBusy(""); }
  };

  const remove = async (id) => {
    await api.deleteTrip(id);
    setSaved(saved.filter((t) => t.id !== id));
    flash("Trip deleted");
  };

  const edit = (fn) => {
    const itinerary = structuredClone(trip.itinerary);
    fn(itinerary);
    setTrip({ ...trip, itinerary });
  };

  const open = (t) => { setTrip({ id: t.id, plan: t.plan, itinerary: t.itinerary }); setDay(0); setView("trip"); window.scrollTo(0, 0); };

  return (
    <div className="app">
      <header className="bar">
        <button className="logo" onClick={() => setView("plan")}>Wanderly</button>
        <nav>
          <button aria-current={view === "plan"} onClick={() => setView("plan")}>New trip</button>
          {trip && <button aria-current={view === "trip"} onClick={() => setView("trip")}>Current trip</button>}
          <button aria-current={view === "saved"} onClick={() => setView("saved")}>Saved</button>
          <button className="mode" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "Light mode" : "Dark mode"}</button>
        </nav>
      </header>

      {online && !online.ok && <p className="alert">The server isn't running. Open a terminal in the backend folder and run <code>uvicorn main:app --reload</code>.</p>}
      {error && <p className="alert" role="alert">{error} <button onClick={() => setError("")}>Dismiss</button></p>}

      <main>
        {view === "plan" && <Plan form={form} setForm={setForm} onSubmit={generate} busy={busy === "plan"} online={online} />}
        {view === "trip" && trip && <TripView trip={trip} day={day} setDay={setDay} edit={edit} onSave={save} saving={busy === "save"} />}
        {view === "saved" && <Saved trips={saved} onOpen={open} onDelete={remove} onNew={() => setView("plan")} />}
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Plan({ form, setForm, onSubmit, busy, online }) {
  const set = (k, v) => setForm({ ...form, [k]: v });
  const toggle = (i) => set("interests", form.interests.includes(i) ? form.interests.filter((x) => x !== i) : [...form.interests, i]);
  return (
    <section className="plan">
      <h1>Where are we flying next?</h1>
      <p className="lede">Fill in your boarding pass. We'll turn it into a day-by-day plan you can edit, save and print.</p>
      <form className="ticket" onSubmit={onSubmit}>
        <label className="full">To
          <input className="dest" required minLength={2} placeholder="Jaipur, Rajasthan" value={form.destination} onChange={(e) => set("destination", e.target.value)} />
        </label>
        <div className="perf" />
        <div className="grid3">
          <label>Days<input type="number" min="1" max="10" value={form.days} onChange={(e) => set("days", +e.target.value)} /></label>
          <label>Travellers<input type="number" min="1" max="20" value={form.travelers} onChange={(e) => set("travelers", +e.target.value)} /></label>
          <label>Budget (₹)<input type="number" min="0" step="1000" value={form.budget} onChange={(e) => set("budget", +e.target.value)} /></label>
        </div>
        <fieldset><legend>Pace</legend>
          <div className="seg">{PACES.map(([v, n, h]) => (
            <label key={v} className={form.pace === v ? "on" : ""}><input type="radio" name="pace" checked={form.pace === v} onChange={() => set("pace", v)} /><b>{n}</b><small>{h}</small></label>
          ))}</div>
        </fieldset>
        <fieldset><legend>What do you enjoy?</legend>
          <div className="chips">{INTERESTS.map((i) => (
            <button type="button" key={i} className={form.interests.includes(i) ? "on" : ""} aria-pressed={form.interests.includes(i)} onClick={() => toggle(i)}>{i}</button>
          ))}</div>
        </fieldset>
        <button className="cta" disabled={busy}>{busy ? "Planning your trip…" : "Create my itinerary"}</button>
        {online?.ok && <small className="hint">Planner: {online.planner === "groq" ? "Groq AI" : "built-in offline planner"}</small>}
      </form>
    </section>
  );
}

function TripView({ trip, day, setDay, edit, onSave, saving }) {
  const { plan, itinerary: it } = trip;
  const spend = useMemo(() => it.days.reduce((s, d) => s + d.slots.reduce((a, x) => a + (+x.cost || 0), 0), 0), [it]);
  const over = spend > plan.budget;
  const pct = plan.budget ? Math.min(100, (spend / plan.budget) * 100) : 0;
  const h = hue(plan.destination);

  return (
    <div className="trip">
      <section className="pass" style={{ "--h": h }}>
        <div className="pass-main">
          <input className="title" aria-label="Trip title" value={it.title} onChange={(e) => edit((x) => { x.title = e.target.value; })} />
          <p>{it.summary}</p>
          <div className="actions">
            <button className="cta" onClick={onSave} disabled={saving}>{saving ? "Saving…" : trip.id ? "Update saved trip" : "Save trip"}</button>
            <button className="line" onClick={() => window.print()}>Print itinerary</button>
          </div>
        </div>
        <div className="stub">
          <div><small>Days</small><b>{plan.days}</b></div>
          <div><small>Travellers</small><b>{plan.travelers}</b></div>
          <div className="spend"><small>Planned spend</small><b className={over ? "over" : ""}>{inr(spend)}</b>
            <div className="meter"><i className={over ? "over" : ""} style={{ width: pct + "%" }} /></div>
            <small>{over ? `${inr(spend - plan.budget)} over your ${inr(plan.budget)} budget` : `${inr(plan.budget - spend)} left of ${inr(plan.budget)}`}</small>
          </div>
        </div>
      </section>

      <div className="tabs" role="tablist">
        {it.days.map((d, i) => (
          <button key={i} role="tab" aria-selected={i === day} onClick={() => setDay(i)}>Day {i + 1}</button>
        ))}
      </div>

      {it.days.map((d, di) => (
        <section key={di} className={"ticket day" + (di === day ? "" : " off")}>
          <h2>Day {di + 1}: {d.theme}</h2>
          <ol>
            {d.slots.map((s, si) => (
              <li key={s.id || si}>
                <div className="when">
                  <input type="time" aria-label="Time" value={s.time} onChange={(e) => edit((x) => { x.days[di].slots[si].time = e.target.value; })} />
                  <small>{s.period}</small>
                </div>
                <div className="what">
                  <input aria-label="Activity" value={s.title} onChange={(e) => edit((x) => { x.days[di].slots[si].title = e.target.value; })} />
                  <p>{s.note}</p>
                </div>
                <div className="price">
                  <input type="number" min="0" step="100" aria-label="Cost in rupees" value={Math.round(s.cost)} onChange={(e) => edit((x) => { x.days[di].slots[si].cost = +e.target.value; })} />
                  <button aria-label="Remove activity" onClick={() => edit((x) => { x.days[di].slots.splice(si, 1); })}>Remove</button>
                </div>
              </li>
            ))}
          </ol>
          <button className="line add" onClick={() => edit((x) => { x.days[di].slots.push({ id: Math.random().toString(36).slice(2, 8), period: "afternoon", time: "12:00", title: "New stop", note: "", cost: 0 }); })}>Add a stop</button>
        </section>
      ))}

      <section className="ticket pack">
        <h2>Packing list</h2>
        <ul>
          {it.packing?.map((p, i) => (
            <li key={i}><label><input type="checkbox" checked={p.done} onChange={() => edit((x) => { x.packing[i].done = !x.packing[i].done; })} /><span className={p.done ? "done" : ""}>{p.text}</span></label></li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Saved({ trips, onOpen, onDelete, onNew }) {
  if (!trips.length) return (
    <section className="empty"><h1>No saved trips yet</h1><p>Create an itinerary and choose Save trip to keep it here.</p><button className="cta" onClick={onNew}>Plan a trip</button></section>
  );
  return (
    <section className="saved"><h1>Your saved trips</h1>
      {trips.map((t) => (
        <article className="ticket row" key={t.id} style={{ "--h": hue(t.destination) }}>
          <span className="dot" />
          <div><h3>{t.title || t.destination}</h3><small>{t.plan.days} days, {t.plan.travelers} traveller(s), {inr(t.plan.budget)}</small></div>
          <div className="btns"><button className="cta" onClick={() => onOpen(t)}>Open</button><button className="line" onClick={() => onDelete(t.id)}>Delete</button></div>
        </article>
      ))}
    </section>
  );
}
