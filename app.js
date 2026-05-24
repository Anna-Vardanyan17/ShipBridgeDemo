/**
 * PackRoute — company site + orders demo
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
  ready_to_ship: "Ready",
  shipped: "Shipped",
  delivered: "Delivered",
};

function formatMoney(amount, currency = "ILS") {
  return new Intl.NumberFormat("en-IL", { style: "currency", currency }).format(amount);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-IL", { day: "2-digit", month: "short" });
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
  const dotClass = state === "ok" ? "dot--ok" : state === "err" ? "dot--err" : "dot--loading";
  $("#apiStatus").innerHTML = `<span class="dot ${dotClass}"></span>${text}`;
}

async function loadOrdersJson() {
  const paths = ["orders.json", "data/orders.json"];
  for (const path of paths) {
    try {
      const res = await fetch(path);
      if (res.ok) {
        const data = await res.json();
        return data.orders || data;
      }
    } catch (_) { /* try next */ }
  }
  throw new Error("Could not load orders.json");
}

async function apiFetch(path, options = {}) {
  if (USE_STATIC) {
    if (path === "/api/orders" || path.startsWith("/api/orders?")) {
      return loadOrdersJson();
    }
    if (path.startsWith("/api/shipping-methods")) {
      return getStaticShippingMethods();
    }
    if (path.match(/^\/api\/orders\/[^/]+\/ship$/)) {
      return { ok: true };
    }
    throw new Error("Not available in static mode");
  }
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

function getStaticShippingMethods() {
  return [
    { id: "post_std", carrier: "Israel Post", service: "Standard", eta_days: 3, price: 18 },
    { id: "post_exp", carrier: "Israel Post", service: "Express", eta_days: 1, price: 32.5 },
    { id: "hfd_std", carrier: "HFD", service: "Standard", eta_days: 2, price: 22 },
    { id: "hfd_exp", carrier: "HFD", service: "Express", eta_days: 1, price: 38 },
  ];
}

async function loadOrders() {
  setApiStatus("loading", "Loading orders…");
  try {
    orders = await apiFetch("/api/orders");
    if (!Array.isArray(orders)) orders = orders.orders || [];
    setApiStatus("ok", `${orders.length} orders loaded`);
    renderAll();
  } catch (e) {
    setApiStatus("err", "No order data");
    toast("Could not load orders — check orders.json is uploaded", "error");
  }
}

function updateStats() {
  const active = orders.filter((o) => o.status !== "delivered").length;
  $("#homeStatOrders").textContent = active;
  $("#statNew").textContent = orders.filter((o) => o.status === "new").length;
  $("#statReady").textContent = orders.filter((o) => o.status === "ready_to_ship").length;
  $("#statTransit").textContent = orders.filter((o) => o.status === "shipped").length;
  $("#statRevenue").textContent = formatMoney(orders.reduce((s, o) => s + o.total, 0));
}

function filteredOrders() {
  const q = ($("#orderSearch")?.value || "").toLowerCase();
  const status = $("#statusFilter")?.value || "";
  return orders.filter((o) => {
    if (status && o.status !== status) return false;
    if (!q) return true;
    return [o.id, o.customer.name, o.customer.city, o.seller.name].join(" ").toLowerCase().includes(q);
  });
}

function orderActions(order) {
  if (order.status === "new") {
    return `<button class="btn btn--ghost btn--sm" data-action="mark-ready" data-id="${order.id}">Ready</button>`;
  }
  if (order.status === "ready_to_ship") {
    return `<button class="btn btn--primary btn--sm" data-action="ship" data-id="${order.id}">Ship</button>`;
  }
  if (order.shipping?.tracking) {
    return `<span style="font-size:0.75rem;color:#64748b">${order.shipping.tracking}</span>`;
  }
  return "";
}

function renderOrdersTable() {
  const list = filteredOrders();
  const tbody = $("#ordersTable tbody");
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No orders</td></tr>`;
    return;
  }
  tbody.innerHTML = list
    .map(
      (o) => `
    <tr>
      <td><strong>${o.id}</strong><br><span style="font-size:0.72rem;color:#64748b">${formatDate(o.created_at)}</span></td>
      <td>${o.customer.name}<br><span style="font-size:0.72rem;color:#64748b">${o.customer.city}</span></td>
      <td>${formatMoney(o.total, o.currency)}</td>
      <td>${statusBadge(o.status)}</td>
      <td>${orderActions(o)}</td>
    </tr>`
    )
    .join("");
}

function renderShippingQueue() {
  const queue = orders.filter((o) => o.status === "ready_to_ship" || o.status === "new");
  const el = $("#shippingQueue");
  if (!queue.length) {
    el.innerHTML = `<p class="empty-state">All caught up — no pending shipments</p>`;
    return;
  }
  el.innerHTML = queue
    .map(
      (o) => `
    <article class="queue-card">
      <h3>${o.id} · ${o.customer.name}</h3>
      <p>${o.seller.warehouse}</p>
      <p>→ ${o.customer.address}, ${o.customer.city}</p>
      <p>${itemCount(o)} items · ${formatMoney(o.total, o.currency)}</p>
      ${
        o.status === "new"
          ? `<button class="btn btn--ghost btn--sm" data-action="mark-ready" data-id="${o.id}">Mark ready</button>`
          : `<button class="btn btn--primary btn--sm" data-action="ship" data-id="${o.id}">Book shipping</button>`
      }
    </article>`
    )
    .join("");
}

function renderAll() {
  updateStats();
  renderOrdersTable();
  renderShippingQueue();
}

function switchPage(name) {
  $$(".page").forEach((p) => p.classList.toggle("page--active", p.id === `page-${name}`));
  $$(".bottom-nav-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.page === name));
  window.scrollTo(0, 0);
}

async function markReady(orderId) {
  const o = orders.find((x) => x.id === orderId);
  if (!o) return;
  if (!USE_STATIC) {
    await apiFetch(`/api/orders/${orderId}/ready`, { method: "POST" });
    await loadOrders();
  } else {
    o.status = "ready_to_ship";
    renderAll();
  }
  toast(`${orderId} marked ready`, "success");
}

async function openShipModal(orderId) {
  const order = orders.find((o) => o.id === orderId);
  if (!order) return;
  activeOrderId = orderId;
  selectedMethodId = null;
  $("#confirmShip").disabled = true;
  $("#shipSummary").hidden = true;
  $("#shipModalTitle").textContent = `Ship ${order.id}`;
  $("#routeFrom").textContent = order.seller.warehouse;
  $("#routeTo").textContent = `${order.customer.address}, ${order.customer.city}`;
  $("#pkgWeight").value = order.weight_kg || 1;
  $("#pkgValue").value = order.total;
  try {
    shippingMethods = await apiFetch(`/api/shipping-methods?weight=${order.weight_kg || 1}`);
  } catch {
    shippingMethods = getStaticShippingMethods();
  }
  $("#methodsList").innerHTML = shippingMethods
    .map(
      (m) => `
    <label class="method-option" data-method-id="${m.id}">
      <input type="radio" name="shipMethod" value="${m.id}" />
      <div class="method-meta"><strong>${m.carrier} · ${m.service}</strong><span>${m.eta_days} days</span></div>
      <span class="method-price">${formatMoney(m.price)}</span>
    </label>`
    )
    .join("");
  $("#shipModal").showModal();
}

async function confirmShipping(e) {
  e.preventDefault();
  if (!activeOrderId || !selectedMethodId) return;
  const method = shippingMethods.find((m) => m.id === selectedMethodId);
  const order = orders.find((o) => o.id === activeOrderId);
  if (USE_STATIC) {
    order.status = "shipped";
    order.shipping = {
      carrier: method.carrier,
      service: method.service,
      tracking: "PR" + Date.now().toString().slice(-8),
      cost: method.price,
    };
    renderAll();
  } else {
    await apiFetch(`/api/orders/${activeOrderId}/ship`, {
      method: "POST",
      body: JSON.stringify({ method_id: selectedMethodId }),
    });
    await loadOrders();
  }
  $("#shipModal").close();
  toast(`Booked · ${method.carrier} ${method.service}`, "success");
}

function bindEvents() {
  $$(".bottom-nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchPage(btn.dataset.page));
  });
  $$("[data-go]").forEach((btn) => {
    btn.addEventListener("click", () => switchPage(btn.dataset.go));
  });
  $("#refreshBtn")?.addEventListener("click", loadOrders);
  $("#syncBtn")?.addEventListener("click", () => toast("Demo mode — orders loaded from JSON", "info"));
  $("#orderSearch")?.addEventListener("input", renderOrdersTable);
  $("#statusFilter")?.addEventListener("change", renderOrdersTable);
  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    if (btn.dataset.action === "ship") openShipModal(btn.dataset.id);
    if (btn.dataset.action === "mark-ready") markReady(btn.dataset.id);
  });
  $("#methodsList")?.addEventListener("change", (e) => {
    if (e.target.name !== "shipMethod") return;
    selectedMethodId = e.target.value;
    $$(".method-option").forEach((el) => el.classList.toggle("is-selected", el.dataset.methodId === selectedMethodId));
    const method = shippingMethods.find((m) => m.id === selectedMethodId);
    if (method) {
      $("#shipSummary").hidden = false;
      $("#selectedMethodLabel").textContent = `${method.carrier} · ${method.service}`;
      $("#selectedMethodPrice").textContent = formatMoney(method.price);
      $("#confirmShip").disabled = false;
    }
  });
  $("#closeModal")?.addEventListener("click", () => $("#shipModal").close());
  $("#cancelShip")?.addEventListener("click", () => $("#shipModal").close());
  $("#shipForm")?.addEventListener("submit", confirmShipping);
  $("#contactForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    toast("Thanks! We'll be in touch soon (demo).", "success");
    e.target.reset();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  loadOrders();
  switchPage("home");
});
