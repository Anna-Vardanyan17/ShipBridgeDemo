/**
 * PackRoute demo — frontend
 * Works with Flask API (local) or static data/orders.json (GitHub Pages)
 */

const API_BASE = (window.PACKROUTE_API || "").replace(/\/$/, "");
const USE_STATIC = !API_BASE;

let orders = [];
let activeOrderId = null;
let selectedMethodId = null;
let shippingMethods = [];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const STATUS_LABELS = {
  new: "New",
  ready_to_ship: "Ready to ship",
  shipped: "Shipped",
  delivered: "Delivered",
};

const VIEW_META = {
  dashboard: { title: "Dashboard", subtitle: "Orders from your store API · book seller to client shipping" },
  orders: { title: "Orders", subtitle: "All incoming e-commerce orders" },
  shipping: { title: "Shipping queue", subtitle: "Book carrier from seller warehouse to customer" },
};

function formatMoney(amount, currency = "ILS") {
  return new Intl.NumberFormat("en-IL", { style: "currency", currency }).format(amount);
}

function formatDate(iso) {
  return new Date(iso).toLocaleString("en-IL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function itemCount(order) {
  return order.items.reduce((s, i) => s + i.qty, 0);
}

function statusBadge(status) {
  return `<span class="badge badge--${status}">${STATUS_LABELS[status] || status}</span>`;
}

function toast(message, type = "info") {
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.textContent = message;
  $("#toastStack").appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function setApiStatus(state, text) {
  const statusEl = $("#apiStatus");
  const dotClass =
    state === "ok" ? "dot--ok" : state === "err" ? "dot--err" : "dot--loading";
  statusEl.innerHTML = `<span class="dot ${dotClass}"></span>${text}`;
}

async function apiFetch(path, options = {}) {
  if (USE_STATIC) {
    if (path === "/api/orders" || path.startsWith("/api/orders?")) {
      const res = await fetch("data/orders.json");
      const data = await res.json();
      return data.orders;
    }
    if (path.match(/^\/api\/orders\/[^/]+\/ship$/)) {
      throw new Error("Static demo: run Python API to book shipping");
    }
    if (path.startsWith("/api/shipping-methods")) {
      return getStaticShippingMethods();
    }
    throw new Error("Not available in static mode");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

function getStaticShippingMethods() {
  return [
    { id: "post_std", carrier: "Israel Post", service: "Standard", eta_days: 3, price: 18.0 },
    { id: "post_exp", carrier: "Israel Post", service: "Express", eta_days: 1, price: 32.5 },
    { id: "hfd_std", carrier: "HFD", service: "Standard", eta_days: 2, price: 22.0 },
    { id: "hfd_exp", carrier: "HFD", service: "Express", eta_days: 1, price: 38.0 },
    { id: "fed_int", carrier: "FedEx", service: "International", eta_days: 5, price: 95.0 },
  ];
}

async function loadOrders() {
  setApiStatus("loading", "Loading orders…");
  try {
    orders = await apiFetch("/api/orders");
    if (!Array.isArray(orders)) orders = orders.orders || [];
    setApiStatus("ok", USE_STATIC ? "Static demo data" : "API connected");
    renderAll();
  } catch (e) {
    setApiStatus("err", "API unavailable");
    toast(e.message, "error");
  }
}

function updateStats() {
  const newCount = orders.filter((o) => o.status === "new").length;
  const ready = orders.filter((o) => o.status === "ready_to_ship").length;
  const transit = orders.filter((o) => o.status === "shipped").length;
  const revenue = orders.reduce((s, o) => s + o.total, 0);

  $("#statNew").textContent = newCount;
  $("#statReady").textContent = ready;
  $("#statTransit").textContent = transit;
  $("#statRevenue").textContent = formatMoney(revenue);
}

function filteredOrders() {
  const q = ($("#orderSearch")?.value || "").toLowerCase();
  const status = $("#statusFilter")?.value || "";
  return orders.filter((o) => {
    if (status && o.status !== status) return false;
    if (!q) return true;
    const hay = [
      o.id,
      o.customer.name,
      o.customer.city,
      o.seller.name,
    ].join(" ").toLowerCase();
    return hay.includes(q);
  });
}

function orderRowActions(order) {
  if (order.status === "new") {
    return `<button class="btn btn--ghost btn--sm" data-action="mark-ready" data-id="${order.id}">Mark ready</button>`;
  }
  if (order.status === "ready_to_ship") {
    return `<button class="btn btn--primary btn--sm" data-action="ship" data-id="${order.id}">Book shipping</button>`;
  }
  if (order.shipping?.tracking) {
    return `<span class="muted">${order.shipping.tracking}</span>`;
  }
  return "—";
}

function renderTable(tbody, list, compact = false) {
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="${compact ? 6 : 8}" class="empty-state">No orders found</td></tr>`;
    return;
  }

  tbody.innerHTML = list
    .map((o) => {
      if (compact) {
        return `
          <tr>
            <td><strong>${o.id}</strong></td>
            <td>${o.customer.name}</td>
            <td>${itemCount(o)}</td>
            <td>${formatMoney(o.total, o.currency)}</td>
            <td>${statusBadge(o.status)}</td>
            <td>${orderRowActions(o)}</td>
          </tr>`;
      }
      return `
        <tr>
          <td><strong>${o.id}</strong></td>
          <td>${formatDate(o.created_at)}</td>
          <td>${o.customer.name}<br><span class="muted">${o.customer.city}</span></td>
          <td>${o.seller.name}</td>
          <td>${o.customer.address}, ${o.customer.city}</td>
          <td>${formatMoney(o.total, o.currency)}</td>
          <td>${statusBadge(o.status)}</td>
          <td>${orderRowActions(o)}</td>
        </tr>`;
    })
    .join("");
}

function renderShippingQueue() {
  const queue = orders.filter((o) => o.status === "ready_to_ship" || o.status === "new");
  const el = $("#shippingQueue");

  if (!queue.length) {
    el.innerHTML = `<p class="empty-state">No orders waiting for shipping 🎉</p>`;
    return;
  }

  el.innerHTML = queue
    .map(
      (o) => `
      <article class="queue-card">
        <div>
          <h3>${o.id} · ${o.customer.name}</h3>
          <p>${o.seller.warehouse} → ${o.customer.address}, ${o.customer.city}</p>
          <p>${itemCount(o)} items · ${formatMoney(o.total, o.currency)}</p>
        </div>
        <div>
          ${
            o.status === "new"
              ? `<button class="btn btn--ghost btn--sm" data-action="mark-ready" data-id="${o.id}">Mark ready</button>`
              : `<button class="btn btn--primary btn--sm" data-action="ship" data-id="${o.id}">Book shipping</button>`
          }
        </div>
      </article>`
    )
    .join("");
}

function renderAll() {
  updateStats();
  renderTable($("#dashboardTableRecent tbody"), orders.slice(0, 5), true);
  renderTable($("#ordersTable tbody"), filteredOrders(), false);
  renderShippingQueue();
}

function switchView(name) {
  $$(".nav-item").forEach((b) => b.classList.toggle("is-active", b.dataset.view === name));
  $$(".view").forEach((v) => v.classList.toggle("view--active", v.id === `view-${name}`));
  const meta = VIEW_META[name];
  $("#pageTitle").textContent = meta.title;
  $("#pageSubtitle").textContent = meta.subtitle;
}

async function markReady(orderId) {
  if (USE_STATIC) {
    const o = orders.find((x) => x.id === orderId);
    if (o) o.status = "ready_to_ship";
    toast(`${orderId} marked ready to ship`, "success");
    renderAll();
    return;
  }
  await apiFetch(`/api/orders/${orderId}/ready`, { method: "POST" });
  await loadOrders();
  toast(`${orderId} marked ready to ship`, "success");
}

async function openShipModal(orderId) {
  const order = orders.find((o) => o.id === orderId);
  if (!order) return;

  activeOrderId = orderId;
  selectedMethodId = null;
  $("#confirmShip").disabled = true;
  $("#shipSummary").hidden = true;

  $("#shipModalTitle").textContent = `Book shipping · ${order.id}`;
  $("#shipModalSub").textContent = `${order.customer.name} · ${formatMoney(order.total, order.currency)}`;
  $("#routeFrom").textContent = order.seller.warehouse;
  $("#routeTo").textContent = `${order.customer.address}, ${order.customer.city}`;
  $("#pkgWeight").value = order.weight_kg || 1;
  $("#pkgValue").value = order.total;

  try {
    shippingMethods = await apiFetch(
      `/api/shipping-methods?weight=${order.weight_kg || 1}&city=${encodeURIComponent(order.customer.city)}`
    );
    renderMethods();
  } catch {
    shippingMethods = getStaticShippingMethods();
    renderMethods();
  }

  $("#shipModal").showModal();
}

function renderMethods() {
  const list = $("#methodsList");
  list.innerHTML = shippingMethods
    .map(
      (m) => `
      <label class="method-option" data-method-id="${m.id}">
        <input type="radio" name="shipMethod" value="${m.id}" />
        <div class="method-meta">
          <strong>${m.carrier} · ${m.service}</strong>
          <span>Est. ${m.eta_days} business day${m.eta_days > 1 ? "s" : ""}</span>
        </div>
        <span class="method-price">${formatMoney(m.price)}</span>
      </label>`
    )
    .join("");
}

async function confirmShipping(e) {
  e.preventDefault();
  if (!activeOrderId || !selectedMethodId) return;

  const method = shippingMethods.find((m) => m.id === selectedMethodId);
  const order = orders.find((o) => o.id === activeOrderId);

  try {
    if (USE_STATIC) {
      order.status = "shipped";
      order.shipping = {
        carrier: method.carrier,
        service: method.service,
        tracking: "DEMO" + Date.now().toString().slice(-8),
        cost: method.price,
        booked_at: new Date().toISOString(),
      };
    } else {
      await apiFetch(`/api/orders/${activeOrderId}/ship`, {
        method: "POST",
        body: JSON.stringify({
          method_id: selectedMethodId,
          weight_kg: parseFloat($("#pkgWeight").value),
          declared_value: parseFloat($("#pkgValue").value),
        }),
      });
      await loadOrders();
    }

    $("#shipModal").close();
    toast(`Shipping booked · ${method.carrier} ${method.service}`, "success");
    renderAll();
  } catch (err) {
    toast(err.message, "error");
  }
}

async function syncFromStore() {
  if (USE_STATIC) {
    toast("Static demo — connect Python API for live sync", "info");
    return;
  }
  try {
    await apiFetch("/api/sync", { method: "POST" });
    await loadOrders();
    toast("Orders synced from store API", "success");
  } catch (e) {
    toast(e.message, "error");
  }
}

function bindEvents() {
  $$(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  $$("[data-view-link]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      switchView(a.dataset.viewLink);
    });
  });

  $("#refreshBtn").addEventListener("click", loadOrders);
  $("#syncBtn").addEventListener("click", syncFromStore);
  $("#orderSearch")?.addEventListener("input", renderAll);
  $("#statusFilter")?.addEventListener("change", renderAll);

  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === "ship") openShipModal(id);
    if (action === "mark-ready") markReady(id);
  });

  $("#methodsList").addEventListener("change", (e) => {
    if (e.target.name !== "shipMethod") return;
    selectedMethodId = e.target.value;
    $$(".method-option").forEach((el) => {
      el.classList.toggle("is-selected", el.dataset.methodId === selectedMethodId);
    });
    const method = shippingMethods.find((m) => m.id === selectedMethodId);
    if (method) {
      $("#shipSummary").hidden = false;
      $("#selectedMethodLabel").textContent = `${method.carrier} · ${method.service}`;
      $("#selectedMethodPrice").textContent = formatMoney(method.price);
      $("#confirmShip").disabled = false;
    }
  });

  $("#closeModal").addEventListener("click", () => $("#shipModal").close());
  $("#cancelShip").addEventListener("click", () => $("#shipModal").close());
  $("#shipForm").addEventListener("submit", confirmShipping);
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  loadOrders();
});
