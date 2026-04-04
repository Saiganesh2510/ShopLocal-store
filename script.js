let products = []
let cart = []

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
    displayProducts()
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

function displayProducts() {
  const container = document.getElementById("products")
  container.innerHTML = ""

  products.forEach((p) => {
    const cartItem = cart.find((c) => c.id === p.id)
    const qty = cartItem ? cartItem.qty : 0

    let discount = 0
    if (p.mrp) {
      discount = Math.round(((p.mrp - p.price) / p.mrp) * 100)
    }

    container.innerHTML += `

<div class="product">

${p.mrp ? `<div class="discount-badge">${discount}% off</div>` : ``}

<img src="${p.image}">

<h3>${p.name}</h3>

<p class="price">
<span class="our-price">₹${p.price}</span>
${p.mrp ? `<span class="mrp">₹${p.mrp}</span>` : ``}
</p>

<p>Stock: ${p.stock}</p>

<button onclick="addToCart(${p.id})">Add to Cart</button>

<div class="qty-controls">
<button onclick="changeQty(${p.id},1)">+</button>
<span>${qty}</span>
<button onclick="changeQty(${p.id},-1)">-</button>
</div>

</div>
`
  })
}

function changeQty(id, change) {
  const product = products.find((p) => p.id === id)
  const item = cart.find((c) => c.id === id)

  if (change > 0) {
    if (product.stock <= 0) {
      alert("Out of stock")
      return
    }

    product.stock--

    if (item) {
      item.qty++
    } else {
      cart.push({ ...product, qty: 1 })
    }
  }

  if (change < 0 && item) {
    item.qty--
    product.stock++

    if (item.qty <= 0) {
      cart = cart.filter((c) => c.id !== id)
    }
  }

  displayProducts()
  displayCart()
}

function addToCart(id) {
  const product = products.find((p) => p.id === id)
  const item = cart.find((c) => c.id === id)

  if (product.stock <= 0) {
    alert("Out of stock")
    return
  }

  product.stock--

  if (item) {
    item.qty++
  } else {
    cart.push({ ...product, qty: 1 })
  }

  displayProducts()
  displayCart()
}

function displayCart() {
  const div = document.getElementById("cart")
  div.innerHTML = ""

  let total = 0

  cart.forEach((item) => {
    const price = item.qty * item.price
    total += price

    div.innerHTML += `

<div class="cart-item">

<img src="${item.image}">

${item.name}

<div class="qty">
<button onclick="changeQty(${item.id},-1)">-</button>
${item.qty}
<button onclick="changeQty(${item.id},1)">+</button>
</div>

₹${price}

</div>
`
  })

  document.getElementById("total").innerText = total
  updateCartCount()
}

function updateCartCount() {
  let count = 0

  cart.forEach((item) => {
    count += item.qty
  })

  document.getElementById("cart-count").innerText = count
}

function toggleCart() {
  document.getElementById("cart-panel").classList.toggle("open")
}

document.addEventListener("DOMContentLoaded", () => {
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
