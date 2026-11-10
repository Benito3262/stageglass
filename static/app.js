(function () {
  var chip = document.getElementById("chip-label");
  var lede = document.getElementById("lede");
  var tool = document.getElementById("tool");
  var args = document.getElementById("args");
  var steps = document.getElementById("steps");
  var approval = document.getElementById("approval");
  var approvalText = document.getElementById("approval-text");
  var live = document.getElementById("live");
  var url = document.getElementById("url");

  function text(node, value) {
    if (node) node.textContent = value || "";
  }

  function apply(view) {
    var mode = view && (view.mode === "on" || view.mode === "hold" || view.mode === "off") ? view.mode : "hold";
    document.body.setAttribute("data-mode", mode);
    text(chip, mode === "on" ? "ON AIR" : mode === "hold" ? "HOLD" : "OFF");
    if (url && typeof view.url === "string" && view.url.indexOf("http://127.0.0.1:") === 0) {
      text(url, view.url);
    }
    var holdCopy = {
      "": "Feed held. Nothing from the session is on screen.",
      uncertain_secret: "Feed held. Redaction was not sure, so nothing from the session is on screen.",
      redactor_error: "Feed held. Redaction failed closed, so nothing from the session is on screen.",
      server_error: "Feed held. The overlay is not available, so nothing from the session is on screen."
    };
    if (mode !== "on") {
      text(lede, mode === "hold" ? (holdCopy[view.hold_reason] || holdCopy[""]) : "Off air.");
      text(tool, "—");
      text(args, "—");
      text(approvalText, "");
      if (approval) approval.hidden = true;
      if (live) live.hidden = true;
      if (steps) steps.replaceChildren();
      return;
    }
    if (live) live.hidden = false;
    text(lede, view.ask || "Waiting for the next message.");
    text(tool, view.tool || "—");
    text(args, view.args || "—");
    if (steps) {
      steps.replaceChildren();
      var items = Array.isArray(view.steps) ? view.steps : [];
      if (!items.length) {
        var empty = document.createElement("li");
        empty.className = "empty";
        empty.textContent = "No steps yet";
        steps.appendChild(empty);
      }
      items.forEach(function (step) {
        var li = document.createElement("li");
        var name = document.createElement("span");
        name.className = "step-tool";
        name.textContent = step && step.tool ? step.tool : "";
        var summary = document.createElement("span");
        summary.className = "step-args";
        summary.textContent = step && step.args ? step.args : "";
        li.appendChild(name);
        li.appendChild(summary);
        steps.appendChild(li);
      });
    }
    var pending = view.approval;
    var line = pending ? [pending.description, pending.command].filter(Boolean).join(" — ") : "";
    text(approvalText, line);
    if (approval) approval.hidden = !line;
  }

  var boot = document.getElementById("boot");
  try {
    apply(JSON.parse(boot && boot.textContent ? boot.textContent : "{}"));
  } catch (error) {
    apply({ mode: "hold" });
  }

  if (typeof EventSource !== "function") return;
  var source = new EventSource("/events");
  source.addEventListener("feed", function (event) {
    try {
      apply(JSON.parse(event.data));
    } catch (error) {
      apply({ mode: "hold" });
    }
  });
})();
