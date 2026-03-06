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

container.innerHTML+=`

<div class="product">

<img src="${p.image}">

<h3>${p.name}</h3>

<p>₹${p.price}</p>

<p>Stock: ${p.stock}</p>
<div class="qty-controls">

<button onclick="changeQty(${p.id},-1)">-</button>

<span>${qty}</span>

<button onclick="changeQty(${p.id},1)">+</button>
<br>
<button onclick="addToCart(${p.id})">Add to Cart</button>
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
    
    function displayCart(){
    
    let div=document.getElementById("cart")
    
    div.innerHTML=""
    
    let total=0
    
    cart.forEach(item=>{
    
    total+=item.price*item.qty
    
    div.innerHTML+=`
    
    <p>
    
    ${item.name} x${item.qty}
    
    ₹${item.price*item.qty}
    
    </p>
    
    `
    
    })
    
    document.getElementById("total").innerText=total
    
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
        document.getElementById("total").innerText = total

    }
    
    function addToCart(id){

        let product = products.find(p=>p.id===id)
        
        let item = cart.find(c=>c.id===id)
        
        if(product.stock <= 0){
        alert("Out of stock")
        return
        }
        
        product.stock--
        
        if(item){
        item.qty++
        }else{
        cart.push({...product, qty:1})
        }
        
        displayProducts()   // refresh product cards
        displayCart()
        
        }

async function confirmOrder(){

    if(cart.length==0){
    alert("Cart empty")
    return
    }
    
    const { jsPDF } = window.jspdf
    let doc = new jsPDF()
    
    let y=20
    
    let now=new Date()
    let date=now.toLocaleDateString()
    let time=now.toLocaleTimeString()
    
    doc.setFontSize(10)
    doc.text(`${date} ${time}`,10,y)
    
    doc.setFontSize(16)
    doc.text("Ramadevi Kiranam & General Store",105,30,{align:"center"})
    
    y=50
    
    doc.setFontSize(12)
    doc.text("Product",10,y)
    doc.text("Qty",120,y)
    doc.text("Rate",140,y)
    doc.text("Price",170,y)
    
    y+=5
    doc.line(10,y,200,y)
    
    y+=10
    
    let total=0
    let whatsappMessage="Ramadevi Kiranam & General Store%0A%0A"
    
    cart.forEach(item=>{
    
    let price=item.price*item.qty
    total+=price
    
    doc.text(item.name,10,y)
    doc.text(String(item.qty),120,y)
    doc.text("₹"+item.price,140,y)
    doc.text("₹"+price,170,y)
    
    whatsappMessage+=`${item.name} x${item.qty} = ₹${price}%0A`
    
    y+=10
    
    })
    
    doc.line(10,y,200,y)
    
    y+=10
    
    doc.text(`Total ₹${total}`,150,y)
    
    doc.save("Ramadevi_Bill.pdf")
    
    whatsappMessage+=`%0ATotal ₹${total}`
    
    let phone="91XXXXXXXXXX"
    
    window.open(`https://wa.me/${phone}?text=${whatsappMessage}`)
    
    }

    function confirmOrder(){

        if(cart.length==0){
        alert("Cart empty")
        return
        }
        
        let total=document.getElementById("total").innerText
        
        let now=new Date()
        
        let date=now.toLocaleDateString()
        let time=now.toLocaleTimeString()
        
        let receipt=`${date} ${time}    Bill\n\n`
        
        receipt+=`Ramadevi Kiranam & General Store\n\n`
        
        receipt+="Product                     Qty   Rate   Price\n"
        receipt+="------------------------------------------------\n"
        
        cart.forEach(item=>{
        
        let price=item.price*item.qty
        
        let name=item.name.padEnd(26," ")
        
        let qty=String(item.qty).padEnd(5," ")
        
        let rate=("₹"+item.price).padEnd(7," ")
        
        let priceText="₹"+price
        
        receipt+=`${name}${qty}${rate}${priceText}\n`
        
        })
        
        receipt+="------------------------------------------------\n\n"
        
        receipt+=`Total ₹${total}`
        
        downloadReceipt(receipt)
        
        sendWhatsApp(receipt)
        
        }

        function sendWhatsApp(message){

            let phone="918520896231"
            
            let url=`https://wa.me/${phone}?text=${encodeURIComponent(message)}`
            
            window.open(url)
            
            }

            function downloadReceipt(text){

                let blob=new Blob([text],{type:"text/plain"})
                
                let a=document.createElement("a")
                
                a.href=URL.createObjectURL(blob)
                
                a.download="receipt.txt"
                
                a.click()
                
                }
