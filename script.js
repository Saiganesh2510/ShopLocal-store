let products = []
let cart = []

function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function loadCart() {
  let savedCart = localStorage.getItem("cart");
  if (savedCart) {
    cart = JSON.parse(savedCart);
  }
}
const INVOICES_KEY = "dharna_invoices_v1"
const INVOICE_NO_KEY = "dharna_invoice_no_v1"
const REPORTS_PIN_KEY = "dharna_reports_pin_v1"
const REPORTS_SESSION_KEY = "dharna_reports_unlocked"

const STORE_NAME = "Dharna Enterprises (Wholesale)"
const STORE_ADDRESS = "NewShayampet, Hanamkonda, Telangana"
const STORE_PHONE = "918520896231"

window._currentReportPeriod = "daily"
window._lastBill = null
window._lastReportContext = null

fetch("products.json")
  .then((res) => res.json())
  .then((data) => {
    products = data
    loadCart();
    displayProducts()
    displayCart()
    updateCartCount()
  })

function getInvoices() {
  try {
    const raw = localStorage.getItem(INVOICES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function setInvoices(list) {
  localStorage.setItem(INVOICES_KEY, JSON.stringify(list))
}

function nextInvoiceNumber() {
  let n = parseInt(localStorage.getItem(INVOICE_NO_KEY) || "0", 10)
  if (!Number.isFinite(n) || n < 0) n = 0
  const list = getInvoices()
  for (const inv of list) {
    if (inv.invoiceNo > n) n = inv.invoiceNo
  }
  return n + 1
}

function commitInvoiceNumber(n) {
  const cur = parseInt(localStorage.getItem(INVOICE_NO_KEY) || "0", 10)
  if (!Number.isFinite(cur) || n > cur) localStorage.setItem(INVOICE_NO_KEY, String(n))
}

function getReportsPin() {
  return localStorage.getItem(REPORTS_PIN_KEY) || "1234"
}

function getMonday(d) {
  const x = new Date(d)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  x.setHours(0, 0, 0, 0)
  return x
}

function periodBounds(period) {
  const now = new Date()
  let start
  let end
  let label
  switch (period) {
    case "daily":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      label = start.toLocaleDateString()
      break
    case "weekly":
      start = getMonday(now)
      end = new Date(start)
      end.setDate(end.getDate() + 6)
      end.setHours(23, 59, 59, 999)
      label = `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`
      break
    case "monthly":
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      label = now.toLocaleString("default", { month: "long", year: "numeric" })
      break
    case "yearly":
      start = new Date(now.getFullYear(), 0, 1)
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
      label = String(now.getFullYear())
      break
    default:
      start = new Date(0)
      end = new Date()
      label = ""
  }
  return { start, end, label }
}

function setActiveReportTab(period) {
  document.querySelectorAll(".rep-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-period") === period)
  })
}

function renderSalesReport(period) {
  const pr = periodBounds(period)
  const list = getInvoices().filter((inv) => inv.ts >= pr.start.getTime() && inv.ts <= pr.end.getTime())
  const revenue = list.reduce((s, inv) => s + inv.total, 0)

  const summaryEl = document.getElementById("rep-summary")
  if (summaryEl) {
    summaryEl.innerHTML = `
      <p class="rep-period-line">${pr.label}</p>
      <p class="rep-dates">${pr.start.toLocaleString()} → ${pr.end.toLocaleString()}</p>
      <div class="rep-kpis">
        <span><strong>${list.length}</strong> bills</span>
        <span><strong>₹${revenue.toFixed(0)}</strong> total</span>
      </div>`
  }

  const tbody = document.getElementById("rep-transactions")
  if (tbody) {
    tbody.innerHTML = ""
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="rep-empty">No transactions in this period.</td></tr>`
    } else {
      list
        .slice()
        .sort((a, b) => b.ts - a.ts)
        .forEach((inv) => {
          const tr = document.createElement("tr")
          tr.innerHTML = `
            <td>${new Date(inv.ts).toLocaleString()}</td>
            <td>#${inv.invoiceNo}</td>
            <td>${escapeHtml(inv.customer || "—")}</td>
            <td class="rep-num">₹${inv.total.toFixed(0)}</td>`
          tbody.appendChild(tr)
        })
    }
  }

  const counts = {}
  list.forEach((inv) => {
    (inv.items || []).forEach((line) => {
      const k = line.name
      counts[k] = (counts[k] || 0) + line.qty
    })
  })
  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
  const low = Object.entries(counts)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 5)

  const detailEl = document.getElementById("rep-detail")
  if (detailEl) {
    if (top.length === 0) {
      detailEl.innerHTML = "<p class=\"rep-empty\">No product data.</p>"
    } else {
      detailEl.innerHTML = `<ul class="rep-list">${top.map(([name, q]) => `<li>${escapeHtml(name)} — <strong>${q}</strong> pcs</li>`).join("")}</ul>`
      if (low.length && low[0][1] < top[0][1]) {
        detailEl.innerHTML += `<p class="rep-low-title">Low movers (same period)</p><ul class="rep-list">${low.map(([name, q]) => `<li>${escapeHtml(name)} — ${q} pcs</li>`).join("")}</ul>`
      }
    }
  }

  window._lastReportContext = {
    start: pr.start,
    end: pr.end,
    list,
    revenue,
    top,
    low,
    periodLabel: pr.label,
  }
}

function escapeHtml(s) {
  const d = document.createElement("div")
  d.textContent = s
  return d.innerHTML
}

function openReportsScreen() {
  const el = document.getElementById("reports-screen")
  if (!el) return
  el.classList.add("open")
  el.setAttribute("aria-hidden", "false")

  const unlocked = sessionStorage.getItem(REPORTS_SESSION_KEY) === "1"
  const lockEl = document.getElementById("reports-lock")
  const dashEl = document.getElementById("reports-dashboard")
  if (lockEl) lockEl.hidden = unlocked
  if (dashEl) dashEl.hidden = !unlocked

  if (unlocked) {
    setActiveReportTab(window._currentReportPeriod || "daily")
    renderSalesReport(window._currentReportPeriod || "daily")
  }
  const pinIn = document.getElementById("reports-pin-input")
  if (pinIn && !unlocked) {
    pinIn.value = ""
    pinIn.focus()
  }
}

function closeReportsScreen() {
  const el = document.getElementById("reports-screen")
  if (!el) return
  el.classList.remove("open")
  el.setAttribute("aria-hidden", "true")
}

function tryUnlockReports() {
  const input = document.getElementById("reports-pin-input")
  const err = document.getElementById("reports-pin-error")
  const v = (input && input.value) || ""
  if (v === getReportsPin()) {
    sessionStorage.setItem(REPORTS_SESSION_KEY, "1")
    if (err) err.hidden = true
    document.getElementById("reports-lock").hidden = true
    document.getElementById("reports-dashboard").hidden = false
    window._currentReportPeriod = "daily"
    setActiveReportTab("daily")
    renderSalesReport("daily")
  } else {
    if (err) err.hidden = false
  }
}

function lockReportsSession() {
  sessionStorage.removeItem(REPORTS_SESSION_KEY)
  const dash = document.getElementById("reports-dashboard")
  const lock = document.getElementById("reports-lock")
  const input = document.getElementById("reports-pin-input")
  const err = document.getElementById("reports-pin-error")
  if (dash) dash.hidden = true
  if (lock) lock.hidden = false
  if (input) input.value = ""
  if (err) err.hidden = true
}

function changeReportsPin() {
  const oldV = (document.getElementById("pin-old") && document.getElementById("pin-old").value) || ""
  const newV = (document.getElementById("pin-new") && document.getElementById("pin-new").value) || ""
  if (oldV !== getReportsPin()) {
    alert("Current PIN is incorrect.")
    return
  }
  if (!/^\d{4,8}$/.test(newV)) {
    alert("New PIN must be 4–8 digits.")
    return
  }
  localStorage.setItem(REPORTS_PIN_KEY, newV)
  document.getElementById("pin-old").value = ""
  document.getElementById("pin-new").value = ""
  alert("PIN updated.")
}

function initReportsTabs() {
  document.querySelectorAll(".rep-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = btn.getAttribute("data-period")
      if (!p) return
      window._currentReportPeriod = p
      setActiveReportTab(p)
      renderSalesReport(p)
    })
  })
}

function openThermalPrintWindow(title, bodyHtml) {
  const w = window.open("", "_blank", "width=400,height=600")
  if (!w) {
    alert("Allow pop-ups to print.")
    return
  }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
    <style>body{font-family:monospace;font-size:12px;padding:12px;} pre{white-space:pre-wrap;margin:0}</style></head><body>${bodyHtml}</body></html>`)
  w.document.close()
  w.onload = () => {
    w.focus()
    w.print()
  }
}

function printReportsThermal() {
  const ctx = window._lastReportContext
  if (!ctx || !ctx.list) {
    alert("Open Reports, unlock, and choose a period first.")
    return
  }
  const lines = [
    "SALES REPORT",
    ctx.periodLabel,
    `Bills: ${ctx.list.length}  Total: ₹${ctx.revenue.toFixed(0)}`,
    "—".repeat(32),
    ...ctx.list.slice(0, 50).map((inv) => `#${inv.invoiceNo} ${new Date(inv.ts).toLocaleString()} ₹${inv.total}`),
  ]
  openThermalPrintWindow(
    "Sales report",
    `<pre>${lines.map(escapeHtml).join("\n")}</pre>`
  )
}

function buildBillHtml(data) {
  const rows = data.items
    .map(
      (line, i) =>
        `<tr><td>${i + 1}</td><td>${escapeHtml(line.name)}</td><td>${line.qty}</td><td>₹${line.price}</td><td>₹${line.lineTotal}</td></tr>`
    )
    .join("")
  return `
    <div class="bill-header">
      <h2>${escapeHtml(STORE_NAME)}</h2>
      <p class="bill-meta">${escapeHtml(data.dateStr)}</p>
      <p class="bill-inv">Invoice <strong>#${data.invoiceNo}</strong></p>
      <p class="bill-to">To: ${escapeHtml(data.customer)}${data.phone ? `<br>Tel: ${escapeHtml(data.phone)}` : ""}</p>
    </div>
    <table class="bill-table">
      <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="bill-total-line"><strong>Total ₹${data.total.toFixed(0)}</strong></p>
    <p class="bill-footer-note">${escapeHtml(STORE_ADDRESS)}</p>`
}

function generateBill() {
  if (cart.length === 0) {
    alert("Cart is empty.")
    return
  }
  const nameEl = document.getElementById("customer-name")
  const phoneEl = document.getElementById("customer-phone")
  const customer = (nameEl && nameEl.value.trim()) || ""
  if (!customer) {
    alert("Please enter customer / shop name for the bill.")
    if (nameEl) nameEl.focus()
    return
  }
  const phoneRaw = (phoneEl && phoneEl.value.replace(/\D/g, "")) || ""
  const phone = phoneRaw.length >= 10 ? phoneRaw.slice(-10) : ""

  const invoiceNo = nextInvoiceNumber()
  const ts = Date.now()
  const items = cart.map((item) => ({
    name: item.name,
    qty: item.qty,
    price: item.price,
    lineTotal: item.qty * item.price,
  }))
  const total = items.reduce((s, l) => s + l.lineTotal, 0)
  const now = new Date()
  const dateStr = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`

  const record = { invoiceNo, ts, customer, phone, items, total }
  const all = getInvoices()
  all.push(record)
  setInvoices(all)
  commitInvoiceNumber(invoiceNo)

  window._lastBill = {
    invoiceNo,
    dateStr,
    customer,
    phone,
    items,
    total,
    plainText: "",
  }
  window._lastBill.plainText = buildBillPlainText(window._lastBill)

  const preview = document.getElementById("bill-preview")
  if (preview) preview.innerHTML = buildBillHtml(window._lastBill)

  const modal = document.getElementById("bill-modal")
  if (modal) modal.classList.add("open")

  cart = []
  localStorage.removeItem("cart")
  displayProducts()
  displayCart()
}

function buildBillPlainText(b) {
  let t = `${STORE_NAME}\n${STORE_ADDRESS}\nInvoice #${b.invoiceNo}\n${b.dateStr}\nCustomer: ${b.customer}${b.phone ? `\nPhone: ${b.phone}` : ""}\n\n`
  b.items.forEach((line, i) => {
    t += `${i + 1}. ${line.name}  ${line.qty} × ₹${line.price} = ₹${line.lineTotal}\n`
  })
  t += `\nTotal ₹${b.total.toFixed(0)}`
  return t
}

function closeBillModal() {
  const modal = document.getElementById("bill-modal")
  if (modal) modal.classList.remove("open")
}

function printBillFromModal() {
  if (!window._lastBill) return
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bill #${window._lastBill.invoiceNo}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:16px;font-size:13px;}
      table{border-collapse:collapse;width:100%;margin:12px 0;}
      th,td{border:1px solid #ccc;padding:6px;}
      th{background:#f0f0f0;}
    </style></head><body>${buildBillHtml(window._lastBill)}</body></html>`
  const w = window.open("", "_blank")
  if (!w) {
    alert("Allow pop-ups to print.")
    return
  }
  w.document.write(html)
  w.document.close()
  w.onload = () => {
    w.focus()
    w.print()
  }
}

function downloadBillPDF() {
  if (!window._lastBill || !window.jspdf) {
    alert("Bill data or PDF library missing.")
    return
  }
  const b = window._lastBill
  const { jsPDF } = window.jspdf
  const doc = new jsPDF()
  let y = 14
  doc.setFontSize(10)
  doc.text(b.dateStr, 10, y)
  y += 6
  doc.setFontSize(14)
  doc.text(STORE_NAME, 105, y, { align: "center" })
  y += 8
  doc.setFontSize(10)
  doc.text(`Invoice #${b.invoiceNo}`, 10, y)
  y += 5
  doc.text(`Customer: ${b.customer}`, 10, y)
  if (b.phone) {
    y += 5
    doc.text(`Phone: ${b.phone}`, 10, y)
  }
  y += 8
  doc.text("S.No", 10, y)
  doc.text("Product", 22, y)
  doc.text("Qty", 120, y)
  doc.text("Rate", 140, y)
  doc.text("Amount", 165, y)
  y += 4
  doc.line(10, y, 200, y)
  y += 6
  b.items.forEach((line, i) => {
    doc.text(String(i + 1), 10, y)
    doc.text(line.name.substring(0, 36), 22, y)
    doc.text(String(line.qty), 120, y)
    doc.text(String(line.price), 140, y)
    doc.text(String(line.lineTotal), 165, y)
    y += 6
    if (y > 270) {
      doc.addPage()
      y = 14
    }
  })
  y += 4
  doc.line(10, y, 200, y)
  y += 8
  doc.setFontSize(12)
  doc.text(`Total Rs.${b.total.toFixed(0)}`, 140, y)
  doc.save(`Invoice_${b.invoiceNo}.pdf`)
}

function sendBillWhatsApp() {
  if (!window._lastBill) return
  const b = window._lastBill
  const num = b.phone || STORE_PHONE
  const url = `https://wa.me/${num}?text=${encodeURIComponent(b.plainText)}`
  window.open(url, "_blank")
}

function copyBillText() {
  if (!window._lastBill) return
  const t = window._lastBill.plainText
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(
      () => alert("Copied to clipboard."),
      () => prompt("Copy:", t)
    )
  } else {
    prompt("Copy:", t)
  }
}

function printThermalReceipt() {
  if (cart.length === 0) {
    alert("Cart is empty.")
    return
  }
  const nameEl = document.getElementById("customer-name")
  const customer = (nameEl && nameEl.value.trim()) || "—"
  let total = 0
  const lines = cart.map((item, i) => {
    const line = item.qty * item.price
    total += line
    return `${i + 1}. ${item.name}  ${item.qty}×₹${item.price} = ₹${line}`
  })
  const body = `<pre>${escapeHtml(STORE_NAME + "\nDRAFT (not saved)\n" + new Date().toLocaleString() + "\n" + customer + "\n---\n" + lines.join("\n") + "\n---\nTotal ₹" + total)}</pre>`
  openThermalPrintWindow("Draft receipt", body)
}

function getCartItem(id) {
  return cart.find((c) => c.id === id)
}

function getProduct(id) {
  return products.find((p) => p.id === id)
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function displayProducts() {
  const container = document.getElementById("products")
  if (!container) return

  container.innerHTML = products
    .map((p) => {
      const cartItem = getCartItem(p.id)
      const qty = cartItem ? cartItem.qty : 0

      const discount = p.mrp
        ? Math.round(((p.mrp - p.price) / p.mrp) * 100)
        : 0

      return `
        <div class="product" id="product-${p.id}">
          ${p.mrp ? `<div class="discount-badge">${discount}% off</div>` : ""}
          <img src="${p.image}" alt="${escapeHtml(p.name)}">
          <h3>${escapeHtml(p.name)}</h3>

          <p class="price">
            <span class="our-price">₹${p.price}</span>
            ${p.mrp ? `<span class="mrp">₹${p.mrp}</span>` : ""}
          </p>

          <p class="stock-line">Stock: <span id="stock-${p.id}">${p.stock}</span></p>

          <button id="add-btn-${p.id}" onclick="addToCart(${p.id})">Add to Cart</button>

          <div class="qty-controls">
            <button onclick="changeQty(${p.id}, -1)">-</button>
            <input
              id="qty-${p.id}"
              type="number"
              min="0"
              value="${qty}"
              class="qty-input"
              oninput="manualQty(${p.id}, this.value)"
            >
            <button onclick="changeQty(${p.id}, 1)">+</button>
          </div>
        </div>
      `
    })
    .join("")

  updateAllProductCards()
}

function updateProductCard(id) {
  const product = getProduct(id)
  const item = getCartItem(id)
  if (!product) return

  const qty = item ? item.qty : 0

  const qtyInput = document.getElementById(`qty-${id}`)
  const stockSpan = document.getElementById(`stock-${id}`)
  const addBtn = document.getElementById(`add-btn-${id}`)

  if (qtyInput) qtyInput.value = qty
  if (stockSpan) stockSpan.textContent = product.stock

  if (addBtn) {
    addBtn.disabled = product.stock <= 0
    addBtn.textContent = product.stock <= 0 ? "Out of Stock" : "Add to Cart"
  }
}

function updateAllProductCards() {
  products.forEach((p) => updateProductCard(p.id))
}

function manualQty(id, value) {
  const product = getProduct(id)
  if (!product) return

  const currentItem = getCartItem(id)
  const currentQty = currentItem ? currentItem.qty : 0
  const totalAvailable = currentQty + product.stock

  let newQty = parseInt(value, 10)
  if (!Number.isFinite(newQty) || newQty < 0) newQty = 0
  newQty = clamp(newQty, 0, totalAvailable)

  const delta = newQty - currentQty

  if (delta === 0) {
    updateProductCard(id)
    displayCart()
    return
  }

  product.stock -= delta

  if (newQty <= 0) {
    cart = cart.filter((c) => c.id !== id)
  } else if (currentItem) {
    currentItem.qty = newQty
    currentItem.price = product.price
    currentItem.name = product.name
    currentItem.image = product.image
  } else {
    cart.push({ ...product, qty: newQty })
  }

  updateProductCard(id)
  displayCart()
  saveCart();   // 🔥 ADD THIS
}

function changeQty(id, change) {
  const product = getProduct(id)
  if (!product) return

  const item = getCartItem(id)
  const currentQty = item ? item.qty : 0

  if (change > 0) {
    if (product.stock <= 0) {
      alert("Out of stock")
      return
    }
    
    product.stock -= 1

    if (item) {
      item.qty += 1
    } else {
      cart.push({ ...product, qty: 1 })
    }
  } else if (change < 0) {
    if (!item) return

    item.qty -= 1
    product.stock += 1

    if (item.qty <= 0) {
      cart = cart.filter((c) => c.id !== id)
    }
  }

  updateProductCard(id)
  displayCart()
  saveCart();   // 🔥 ADD THIS
}

function addToCart(id) {
  changeQty(id, 1)
}

function displayCart() {
  const div = document.getElementById("cart")
  if (!div) return

  let total = 0

  div.innerHTML = cart
    .map((item) => {
      const price = item.qty * item.price
      total += price

      return `
        <div class="cart-item">
          <img src="${item.image}" alt="${escapeHtml(item.name)}">
          <span class="cart-name">${escapeHtml(item.name)}</span>

          <div class="qty">
            <button onclick="changeQty(${item.id}, -1)">-</button>
            <span>${item.qty}</span>
            <button onclick="changeQty(${item.id}, 1)">+</button>
          </div>

          <span>₹${price}</span>
        </div>
      `
    })
    .join("")

  const totalEl = document.getElementById("total")
  if (totalEl) totalEl.innerText = total

  updateCartCount()
}

function updateCartCount() {
  const count = cart.reduce((sum, item) => sum + item.qty, 0)
  const countEl = document.getElementById("cart-count")
  if (countEl) countEl.innerText = count
}
function toggleCart() {
  document.getElementById("cart-panel").classList.toggle("open")
}

document.addEventListener("DOMContentLoaded", () => {
  loadCart();           // 🔥 ADD THIS
  displayCart();        // 🔥 ADD THIS
  updateCartCount();    // 🔥 ADD THIS
  initReportsTabs()
  const pin = document.getElementById("reports-pin-input")
  if (pin) {
    pin.addEventListener("keydown", (e) => {
      if (e.key === "Enter") tryUnlockReports()
    })
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeBillModal()
      const rs = document.getElementById("reports-screen")
      if (rs && rs.classList.contains("open")) closeReportsScreen()
    }
  })
})
function sendWhatsApp() {
  let message = "Hi, please send your location. I want to visit your shop directly.";
  window.open("https://wa.me/918520896231?text=" + encodeURIComponent(message));
}

// CALL FUNCTION
function callNow() {
window.location.href = "tel:8520896231";
}
