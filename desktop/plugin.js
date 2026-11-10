import { host, STATUSBAR_AREAS } from "@hermes/plugin-sdk";
import { useSyncExternalStore } from "react";
import { jsx, jsxs } from "react/jsx-runtime";

const listeners = new Set();
let state = { mode: "off", url: "http://127.0.0.1:8765/" };

function publish(next) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getState() {
  return state;
}

function safeUrl(value) {
  return typeof value === "string" && /^http:\/\/127\.0\.0\.1:\d{1,5}\/$/.test(value)
    ? value
    : state.url;
}

function labelFor(mode) {
  if (mode === "on") return "ON AIR";
  if (mode === "hold") return "HOLD";
  return "OFF";
}

function Chip() {
  const current = useSyncExternalStore(subscribe, getState, getState);
  return jsx("span", {
    className: "px-1.5 text-[0.6875rem] text-(--ui-text-secondary)",
    children: "Stageglass " + labelFor(current.mode),
  });
}

function Settings() {
  const current = useSyncExternalStore(subscribe, getState, getState);
  return jsxs("div", {
    className: "flex max-w-xl flex-col gap-3 p-4 text-sm text-(--ui-text-secondary)",
    children: [
      jsx("h2", {
        className: "text-base text-(--ui-text-primary)",
        children: "Stageglass overlay",
      }),
      jsx("p", {
        children: "Loopback only. Add this URL as an OBS Browser Source on this machine.",
      }),
      jsx("p", {
        className: "font-mono text-(--ui-text-primary)",
        children: current.url,
      }),
      jsx("p", {
        children: "Status is " + labelFor(current.mode) + ". Change it in the session with /onair on, /onair hold, or /onair off.",
      }),
    ],
  });
}

export default {
  id: "stageglass",
  name: "Stageglass",
  description: "Secret-safe ON AIR overlay for screen sharing.",
  defaultEnabled: false,
  register(ctx) {
    host.onEvent("plugin.stageglass.status", (frame) => {
      const payload = frame && frame.payload && typeof frame.payload === "object" ? frame.payload : {};
      const mode = payload.mode === "on" || payload.mode === "hold" || payload.mode === "off" ? payload.mode : "hold";
      publish({ mode, url: safeUrl(payload.url) });
    });
    ctx.register({
      id: "chip",
      area: STATUSBAR_AREAS.right,
      order: 140,
      render: () => jsx(Chip, {}),
    });
    if (typeof ctx.registerSettingsPage === "function") {
      ctx.registerSettingsPage({
        id: "settings",
        title: "Stageglass",
        icon: "radio-tower",
        order: 0,
        render: () => jsx(Settings, {}),
      });
    }
  },
};
