let products=[]
let cart=[]

fetch("products.json")
.then(res=>res.json())
.then(data=>{
products=data
displayProducts()
})

function displayProducts(){

let container=document.getElementById("products")
container.innerHTML=""

products.forEach(p=>{

let cartItem=cart.find(c=>c.id===p.id)
let qty=cartItem ? cartItem.qty : 0

let discount=0
if(p.mrp){
discount=Math.round(((p.mrp-p.price)/p.mrp)*100)
}

container.innerHTML+=`

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

function changeQty(id,change){

let product=products.find(p=>p.id===id)
let item=cart.find(c=>c.id===id)

if(change>0){

if(product.stock<=0){
alert("Out of stock")
return
}

product.stock--

if(item){
item.qty++
}else{
cart.push({...product,qty:1})
}
}

if(change<0 && item){

item.qty--
product.stock++

if(item.qty<=0){
cart=cart.filter(c=>c.id!==id)
}
}

displayProducts()
displayCart()
}

function addToCart(id){

let product=products.find(p=>p.id===id)
let item=cart.find(c=>c.id===id)

if(product.stock<=0){
alert("Out of stock")
return
}

product.stock--

if(item){
item.qty++
}else{
cart.push({...product, qty:1})
}

displayProducts()
displayCart()
}

function displayCart(){

let div=document.getElementById("cart")
div.innerHTML=""

let total=0

cart.forEach(item=>{

let price=item.qty*item.price
total+=price

div.innerHTML+=`

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

document.getElementById("total").innerText=total
updateCartCount()
}

function updateCartCount(){

let count=0

cart.forEach(item=>{
count+=item.qty
})

document.getElementById("cart-count").innerText=count
}

function toggleCart(){
document.getElementById("cart-panel").classList.toggle("open")
}

function confirmOrder(){

    if(cart.length==0){
    alert("Cart empty")
    return
    }
    
    let now=new Date()
    
    let date=now.toLocaleDateString()
    let time=now.toLocaleTimeString()
    
    let receipt=`${date} ${time}  Bill\n\n`
    
    receipt+=`Ramadevi Kiranam & General Store(Wholesale)\n\n`
    
    let i=1
    let total=0
    
    cart.forEach(item=>{
    
    let price=item.price*item.qty
    total+=price
    
    receipt+=`${i}. ${item.name}\n`
    receipt+=`   Qty: ${item.qty}  Rate: ₹${item.price}  Price: ₹${price}\n\n`
    
    i++
    
    })
    
    receipt+=`Total ₹${total}`
    
    sendWhatsApp(receipt)
    
    downloadPDF()
    
    }
function sendWhatsApp(message){

let phone="918520896231"

let url=`https://wa.me/${phone}?text=${encodeURIComponent(message)}`

window.open(url)
}

function downloadPDF(){

const { jsPDF } = window.jspdf

let doc=new jsPDF()

let y=20

let now=new Date()
let date=now.toLocaleDateString()
let time=now.toLocaleTimeString()

doc.setFont("Arial","normal")

doc.setFontSize(10)
doc.text(`${date}  ${time}`,10,y)

doc.setFontSize(18)
doc.text("Ramadevi Kiranam & General Store\nWholeSale",105,30,{align:"center"})

y=50

doc.setFontSize(10)

doc.text("S.No",10,y)
doc.text("Product",25,y)
doc.text("Qty",125,y)
doc.text("Rate",145,y)
doc.text("Price",170,y)

y+=5
doc.line(10,y,200,y)

y+=10

let total=0
let i=1

cart.forEach(item=>{

let price=item.price*item.qty
total+=price

doc.text(String(i),10,y)
doc.text(item.name.substring(0,30),25,y)
doc.text(String(item.qty),125,y)
doc.text("Rs."+item.price,145,y)
doc.text("Rs."+price,170,y)

y+=10
i++
})

doc.line(10,y,200,y)

y+=10

doc.setFontSize(14)
doc.text(`Total Rs.${total}`,140,y)

doc.save("Your_Order_summary.pdf")
}
