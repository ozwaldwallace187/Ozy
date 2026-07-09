/* ============================================================
   BABETTE — FORM BEHAVIOUR
   One script for every form the engine emits. Entirely
   attribute-driven: steps, cards, reveals, validation,
   personalisation, spam traps, submission, success takeover.
   No dependencies.
   ============================================================ */
(function () {
  "use strict";

  var form = document.querySelector("form.bb-form");
  var loadedAt = Date.now();
  var MIN_HUMAN_MS = 5000;

  /* ---------- Personalisation (?c=Hannah+%26+Angus) ---------- */

  var params = new URLSearchParams(window.location.search);

  document.querySelectorAll("[data-personalize]").forEach(function (el) {
    var param = el.getAttribute("data-personalize");
    var value = (params.get(param) || "").trim();
    if (!value) { el.hidden = true; return; }
    var slot = el.querySelector(".name") || el;
    slot.textContent = value; // textContent only — never inject markup
    el.hidden = false;
  });

  /* Capture whitelisted URL params into hidden fields (?theme=…, ?c=…) */
  document.querySelectorAll("input[data-capture-param]").forEach(function (input) {
    var value = params.get(input.getAttribute("data-capture-param"));
    if (value) input.value = value;
  });

  if (!form) return;

  /* ---------- Steps & progress ---------- */

  var steps = Array.prototype.slice.call(form.querySelectorAll(".bb-step"));
  var progress = document.querySelector(".bb-progress span");
  var backBtn = form.querySelector(".bb-back");
  var nextBtn = form.querySelector(".bb-next");
  var submitBtn = form.querySelector(".bb-submit");
  var current = 0;

  function renderStep() {
    steps.forEach(function (step, i) {
      step.classList.toggle("is-active", i === current);
    });
    if (progress) {
      progress.style.width = ((current + 1) / steps.length) * 100 + "%";
    }
    document.querySelectorAll(".bb-step-count").forEach(function (el) {
      var pad = function (n) { return String(n).padStart(2, "0"); };
      el.textContent = pad(current + 1) + " / " + pad(steps.length);
    });
    if (backBtn) backBtn.style.visibility = current === 0 ? "hidden" : "visible";
    var last = current === steps.length - 1;
    if (nextBtn) nextBtn.style.display = last ? "none" : "";
    if (submitBtn) submitBtn.style.display = last ? "" : "none";
  }

  function goTo(i) {
    current = Math.max(0, Math.min(steps.length - 1, i));
    renderStep();
    if (steps.length > 1) {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  if (nextBtn) nextBtn.addEventListener("click", function () {
    if (validateStep(steps[current])) goTo(current + 1);
  });
  if (backBtn) backBtn.addEventListener("click", function () { goTo(current - 1); });

  /* Enter advances (but not inside textareas) */
  form.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || e.target.tagName === "TEXTAREA") return;
    if (current < steps.length - 1) {
      e.preventDefault();
      if (validateStep(steps[current])) goTo(current + 1);
    }
  });

  /* ---------- Cards ---------- */

  form.querySelectorAll(".bb-card input").forEach(function (input) {
    input.addEventListener("change", function () {
      var group = form.querySelectorAll('.bb-card input[name="' + input.name + '"]');
      group.forEach(function (other) {
        other.closest(".bb-card").classList.toggle("is-selected", other.checked);
        syncReveal(other);
      });
      clearError(input.closest(".bb-field"));
    });
  });

  /* ---------- Reveals (e.g. “Something Else” → free text) ---------- */

  function syncReveal(input) {
    var card = input.closest("[data-reveals]");
    if (!card) return;
    var target = document.querySelector(card.getAttribute("data-reveals"));
    if (!target) return;
    var on = input.checked;
    target.hidden = !on;
    if (on) {
      var field = target.querySelector("input, textarea");
      if (field && !prefersReducedMotion()) field.focus({ preventScroll: true });
    }
  }

  form.querySelectorAll(".bb-check input[data-reveals-toggle]").forEach(function (input) {
    var target = document.querySelector(input.getAttribute("data-reveals-toggle"));
    if (!target) return;
    input.addEventListener("change", function () { target.hidden = input.checked; });
  });

  /* ---------- Validation (inline, editorial — never browser popups) ---------- */

  function fieldError(field) {
    return field.getAttribute("data-error") || "We’ll need this one before we go on.";
  }

  function showError(field, message) {
    var slot = field.querySelector(".bb-error");
    if (!slot) {
      slot = document.createElement("p");
      slot.className = "bb-error";
      slot.setAttribute("role", "alert");
      field.appendChild(slot);
    }
    slot.textContent = message;
    slot.hidden = false;
    field.classList.add("has-error");
  }

  function clearError(field) {
    if (!field) return;
    var slot = field.querySelector(".bb-error");
    if (slot) slot.hidden = true;
    field.classList.remove("has-error");
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  }

  function validateField(field) {
    clearError(field);
    if (field.closest("[hidden]")) return true;

    /* card / check groups */
    if (field.hasAttribute("data-group-required")) {
      var checked = field.querySelector("input:checked");
      /* honour “required unless” (e.g. date not needed if flexible) */
      var unless = field.getAttribute("data-required-unless");
      if (!checked && unless && form.querySelector('[name="' + unless + '"]:checked')) return true;
      if (!checked) { showError(field, fieldError(field)); return false; }
      return true;
    }

    var input = field.querySelector("input, textarea, select");
    if (!input) return true;

    var unlessName = input.getAttribute("data-required-unless");
    var waived = unlessName && form.querySelector('[name="' + unlessName + '"]:checked');
    var value = (input.value || "").trim();

    if (input.required && !waived && !value) {
      showError(field, fieldError(field));
      return false;
    }
    if (value && input.type === "email" && !isEmail(value)) {
      showError(field, input.getAttribute("data-error-format") || "That email doesn’t look quite right.");
      return false;
    }
    return true;
  }

  function validateStep(step) {
    var ok = true;
    var firstBad = null;
    step.querySelectorAll(".bb-field").forEach(function (field) {
      if (!validateField(field) && ok !== false) { /* keep checking all */ }
    });
    step.querySelectorAll(".bb-field").forEach(function (field) {
      if (field.classList.contains("has-error")) {
        ok = false;
        if (!firstBad) firstBad = field;
      }
    });
    if (firstBad) {
      firstBad.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
    }
    return ok;
  }

  form.querySelectorAll("input, textarea").forEach(function (input) {
    input.addEventListener("input", function () { clearError(input.closest(".bb-field")); });
  });

  /* ---------- Submission ---------- */

  var alertBox = form.querySelector(".bb-form-alert");

  function collect() {
    var data = {};
    new FormData(form).forEach(function (value, key) {
      if (key.indexOf("bb_") === 0) return; // spam traps stay out of the payload
      value = String(value).trim();
      if (!value) return;
      data[key] = data[key] ? data[key] + ", " + value : value;
    });
    return data;
  }

  function showSuccess() {
    var takeover = document.querySelector(".bb-success");
    if (takeover) {
      takeover.hidden = false;
      takeover.focus && takeover.setAttribute("tabindex", "-1");
      takeover.focus();
    }
    document.querySelectorAll(".bb-progress span").forEach(function (bar) {
      bar.style.width = "100%";
    });
  }

  function mailtoFallback(data) {
    var to = form.getAttribute("data-fallback-email") || "ozy@haveyoumetbabette.com";
    var subject = form.getAttribute("data-subject") || document.title;
    var body = Object.keys(data).map(function (key) {
      return key.toUpperCase() + ": " + data[key];
    }).join("\n");
    return "mailto:" + to +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validateStep(steps[current])) return;

    /* spam traps: honeypot filled or submitted inhumanly fast → quiet exit */
    var honeypot = form.querySelector(".bb-hp");
    if ((honeypot && honeypot.value) || Date.now() - loadedAt < MIN_HUMAN_MS) {
      showSuccess();
      return;
    }

    var data = collect();
    var endpoint = form.getAttribute("data-endpoint");
    if (!endpoint) { showSuccess(); return; }

    var payload = Object.assign({
      _subject: form.getAttribute("data-subject") || document.title,
      _template: "table"
    }, data);
    var cc = form.getAttribute("data-cc");
    if (cc) payload._cc = cc;

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Sending…"; }
    if (alertBox) alertBox.hidden = true;

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      showSuccess();
    }).catch(function () {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = submitBtn.getAttribute("data-label") || "Send"; }
      if (alertBox) {
        alertBox.innerHTML = "Something in the wires misbehaved. Try once more, or " +
          '<a href="' + mailtoFallback(data) + '">email us your answers directly</a>.';
        alertBox.hidden = false;
        alertBox.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
      }
    });
  });

  if (submitBtn) submitBtn.setAttribute("data-label", submitBtn.textContent);
  renderStep();
})();
