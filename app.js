// ============================================================
// StickerWorld — Logique de la boutique
// ============================================================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const state = {
    filter: "all",
    query: "",
    cart: loadCart(),
};

// --- Palettes de couleurs pour générer un sticker unique par ville ---
const PALETTES = [
    ["#FF6B6B", "#FFD93D"], ["#4ECDC4", "#556270"], ["#6C5CE7", "#A29BFE"],
    ["#00B894", "#55EFC4"], ["#FD79A8", "#FDCB6E"], ["#0984E3", "#74B9FF"],
    ["#E17055", "#FAB1A0"], ["#E84393", "#FD79A8"], ["#00CEC9", "#81ECEC"],
    ["#FF7675", "#FFEAA7"], ["#A29BFE", "#FFEAA7"], ["#2D3436", "#00B894"],
    ["#F39C12", "#F1C40F"], ["#16A085", "#1ABC9C"], ["#8E44AD", "#9B59B6"],
];

// Hash déterministe pour qu'une ville garde toujours le même style
function hashStr(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (h << 5) - h + str.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h);
}

function cityId(city) {
    return (city.name + "-" + city.country).toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

// Génère un sticker SVG (badge "voyage") propre à la ville
function stickerSVG(city) {
    const h = hashStr(city.name + city.country);
    const [c1, c2] = PALETTES[h % PALETTES.length];
    const rot = (h % 7) - 3; // légère rotation -3..3
    const gid = "g-" + cityId(city);
    const initial = city.name.charAt(0).toUpperCase();

    return `
    <svg class="sticker-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style="--rot:${rot}deg">
        <defs>
            <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="${c1}"/>
                <stop offset="100%" stop-color="${c2}"/>
            </linearGradient>
        </defs>
        <!-- contour blanc type sticker découpé -->
        <circle cx="100" cy="100" r="92" fill="#fff"/>
        <circle cx="100" cy="100" r="84" fill="url(#${gid})"/>
        <circle cx="100" cy="100" r="84" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="2" stroke-dasharray="3 6"/>
        <text x="100" y="118" text-anchor="middle" font-size="78" font-weight="800"
              fill="rgba(255,255,255,.92)" font-family="Poppins, sans-serif">${initial}</text>
        <text x="100" y="160" text-anchor="middle" font-size="16" font-weight="700"
              fill="rgba(255,255,255,.95)" font-family="Poppins, sans-serif"
              letter-spacing="1">${escapeHtml(city.name.toUpperCase()).slice(0, 14)}</text>
        <text x="100" y="48" text-anchor="middle" font-size="20"
              font-family="sans-serif">${city.flag}</text>
    </svg>`;
}

function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
}

function fmtPrice(n) {
    return n.toFixed(2).replace(".", ",") + " €";
}

// ------------------------------------------------------------
// Rendu des filtres (continents)
// ------------------------------------------------------------
function renderFilters() {
    const nav = $("#filters");
    nav.innerHTML = CONTINENTS.map((c) =>
        `<button class="chip ${c.id === state.filter ? "active" : ""}" data-filter="${c.id}">${c.label}</button>`
    ).join("");
    nav.querySelectorAll(".chip").forEach((btn) => {
        btn.addEventListener("click", () => {
            state.filter = btn.dataset.filter;
            renderFilters();
            renderGrid();
        });
    });
}

// ------------------------------------------------------------
// Rendu de la grille de stickers
// ------------------------------------------------------------
function filteredCities() {
    const q = state.query.trim().toLowerCase();
    return CITIES.filter((city) => {
        const okFilter = state.filter === "all" || city.continent === state.filter;
        const okQuery = !q ||
            city.name.toLowerCase().includes(q) ||
            city.country.toLowerCase().includes(q);
        return okFilter && okQuery;
    });
}

function renderGrid() {
    const grid = $("#grid");
    const list = filteredCities();

    $("#empty").hidden = list.length > 0;
    $("#results-info").textContent =
        `${list.length} ville${list.length > 1 ? "s" : ""}` +
        (state.filter !== "all" ? ` · ${CONTINENTS.find(c => c.id === state.filter).label}` : "") +
        (state.query ? ` · « ${state.query} »` : "");

    grid.innerHTML = list.map((city) => {
        const id = cityId(city);
        const inCart = state.cart[id]?.qty || 0;
        return `
        <article class="card">
            <div class="card-sticker">${stickerSVG(city)}</div>
            <div class="card-body">
                <h3 class="card-title">${escapeHtml(city.name)}</h3>
                <p class="card-country">${city.flag} ${escapeHtml(city.country)}</p>
                <div class="card-foot">
                    <span class="card-price">${fmtPrice(PRICE)}</span>
                    <button class="btn-add ${inCart ? "added" : ""}" data-add="${id}">
                        ${inCart ? `✓ ${inCart} au panier` : "Ajouter"}
                    </button>
                </div>
            </div>
        </article>`;
    }).join("");

    grid.querySelectorAll("[data-add]").forEach((btn) => {
        btn.addEventListener("click", () => addToCart(btn.dataset.add));
    });
}

// ------------------------------------------------------------
// Panier
// ------------------------------------------------------------
function loadCart() {
    try {
        return JSON.parse(localStorage.getItem("stickerworld_cart")) || {};
    } catch {
        return {};
    }
}

function saveCart() {
    localStorage.setItem("stickerworld_cart", JSON.stringify(state.cart));
}

function findCityById(id) {
    return CITIES.find((c) => cityId(c) === id);
}

function addToCart(id) {
    const city = findCityById(id);
    if (!city) return;
    if (!state.cart[id]) state.cart[id] = { name: city.name, country: city.country, flag: city.flag, qty: 0 };
    state.cart[id].qty += 1;
    saveCart();
    renderGrid();
    renderCart();
    bumpCartBtn();
}

function changeQty(id, delta) {
    if (!state.cart[id]) return;
    state.cart[id].qty += delta;
    if (state.cart[id].qty <= 0) delete state.cart[id];
    saveCart();
    renderGrid();
    renderCart();
}

function cartCount() {
    return Object.values(state.cart).reduce((sum, it) => sum + it.qty, 0);
}

function cartTotal() {
    return cartCount() * PRICE;
}

function renderCart() {
    const count = cartCount();
    $("#cart-count").textContent = count;
    $("#cart-count").classList.toggle("visible", count > 0);
    $("#cart-total").textContent = fmtPrice(cartTotal());

    const items = $("#cart-items");
    const entries = Object.entries(state.cart);

    if (entries.length === 0) {
        items.innerHTML = `<p class="cart-empty">Ton panier est vide.<br>Ajoute la ville de ton cœur ❤️</p>`;
        $("#checkout-btn").disabled = true;
        return;
    }
    $("#checkout-btn").disabled = false;

    items.innerHTML = entries.map(([id, it]) => `
        <div class="cart-item">
            <div class="cart-item-info">
                <strong>${it.flag} ${escapeHtml(it.name)}</strong>
                <span>${escapeHtml(it.country)} · ${fmtPrice(PRICE)}</span>
            </div>
            <div class="qty">
                <button data-dec="${id}" aria-label="Retirer un">−</button>
                <span>${it.qty}</span>
                <button data-inc="${id}" aria-label="Ajouter un">+</button>
            </div>
        </div>
    `).join("");

    items.querySelectorAll("[data-inc]").forEach((b) =>
        b.addEventListener("click", () => changeQty(b.dataset.inc, +1)));
    items.querySelectorAll("[data-dec]").forEach((b) =>
        b.addEventListener("click", () => changeQty(b.dataset.dec, -1)));
}

function openCart() {
    $("#cart-panel").hidden = false;
    $("#cart-overlay").hidden = false;
    requestAnimationFrame(() => {
        $("#cart-panel").classList.add("open");
        $("#cart-overlay").classList.add("open");
    });
}

function closeCart() {
    $("#cart-panel").classList.remove("open");
    $("#cart-overlay").classList.remove("open");
    setTimeout(() => {
        $("#cart-panel").hidden = true;
        $("#cart-overlay").hidden = true;
    }, 250);
}

function bumpCartBtn() {
    const btn = $("#cart-btn");
    btn.classList.remove("bump");
    void btn.offsetWidth;
    btn.classList.add("bump");
}

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------
function init() {
    $("#stat-count").textContent = CITIES.length;

    renderFilters();
    renderGrid();
    renderCart();

    $("#search").addEventListener("input", (e) => {
        state.query = e.target.value;
        renderGrid();
    });

    $("#cart-btn").addEventListener("click", openCart);
    $("#cart-close").addEventListener("click", closeCart);
    $("#cart-overlay").addEventListener("click", closeCart);

    $("#brand-home").addEventListener("click", (e) => {
        e.preventDefault();
        state.filter = "all";
        state.query = "";
        $("#search").value = "";
        renderFilters();
        renderGrid();
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    $("#checkout-btn").addEventListener("click", () => {
        const count = cartCount();
        alert(`Merci ! 🎉\n\n${count} sticker${count > 1 ? "s" : ""} pour un total de ${fmtPrice(cartTotal())}.\n\n(Démo — aucun paiement réel n'est effectué.)`);
        state.cart = {};
        saveCart();
        renderGrid();
        renderCart();
        closeCart();
    });
}

document.addEventListener("DOMContentLoaded", init);
