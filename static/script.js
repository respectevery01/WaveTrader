let wallet = null;
let pendingOrders = [];

async function initWallet() {
    try {
        if ("solana" in window) {
            const provider = window.solana;
            if (provider.isPhantom) {
                wallet = provider;
                return true;
            }
        }
        alert("请安装 Phantom 钱包!");
        return false;
    } catch (err) {
        console.error("钱包初始化错误:", err);
        return false;
    }
}

async function connectWallet() {
    try {
        if (!wallet) {
            if (!await initWallet()) {
                return;
            }
        }
        
        const connectButton = document.getElementById("connectWallet");
        
        if (!wallet.isConnected) {
            await wallet.connect();
            const publicKey = wallet.publicKey.toString();
            connectButton.textContent = publicKey.slice(0, 4) + "..." + publicKey.slice(-4);
            connectButton.classList.add("connected");
        } else {
            await wallet.disconnect();
            connectButton.textContent = "连接钱包";
            connectButton.classList.remove("connected");
        }
    } catch (err) {
        console.error("钱包连接错误:", err);
        alert("连接钱包失败: " + err.message);
    }
}

// 监听订单类型变化
document.getElementById("orderType").addEventListener("change", function() {
    const limitPriceContainer = document.getElementById("limitPriceContainer");
    if (this.value === "limit") {
        limitPriceContainer.style.display = "block";
    } else {
        limitPriceContainer.style.display = "none";
    }
});

async function executeTrade() {
    if (!wallet || !wallet.isConnected) {
        alert("请先连接钱包!");
        return;
    }

    const tokenAddress = document.getElementById("tokenAddress").value;
    const amount = parseFloat(document.getElementById("amount").value);
    const slippage = parseFloat(document.getElementById("slippage").value);
    const orderType = document.getElementById("orderType").value;
    const limitPrice = orderType === "limit" ? parseFloat(document.getElementById("limitPrice").value) : null;

    if (!tokenAddress || isNaN(amount) || amount <= 0 || isNaN(slippage) || slippage <= 0) {
        alert("请输入有效的交易参数!");
        return;
    }

    if (orderType === "limit" && (isNaN(limitPrice) || limitPrice <= 0)) {
        alert("请输入有效的限价!");
        return;
    }

    try {
        // 获取交易参数
        const response = await fetch("/api/trade", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                token_address: tokenAddress,
                amount: amount,
                slippage: slippage,
                wallet_address: wallet.publicKey.toString()
            })
        });

        if (!response.ok) {
            throw new Error("获取交易参数失败");
        }

        const data = await response.json();
        
        if (orderType === "limit") {
            // 添加到待处理订单列表
            const order = {
                id: Date.now(),
                tokenAddress,
                amount,
                limitPrice,
                transaction: data.transaction
            };
            pendingOrders.push(order);
            updatePendingOrders();
            return;
        }

        // 请求用户签名
        const transaction = data.transaction;
        const signedTransaction = await wallet.signTransaction(transaction);
        
        // 发送签名后的交易
        const confirmResponse = await fetch("/api/confirm_trade", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                signed_transaction: signedTransaction
            })
        });

        if (!confirmResponse.ok) {
            throw new Error("交易确认失败");
        }

        const confirmData = await confirmResponse.json();
        alert("交易成功! 交易哈希: " + confirmData.tx_hash);

    } catch (err) {
        console.error("交易执行错误:", err);
        alert("交易失败: " + err.message);
    }
}

function updatePendingOrders() {
    const container = document.getElementById("pendingOrders");
    container.innerHTML = "";
    
    pendingOrders.forEach(order => {
        const orderElement = document.createElement("div");
        orderElement.className = "pending-order";
        orderElement.innerHTML = `
            <p>代币地址: ${order.tokenAddress}</p>
            <p>数量: ${order.amount}</p>
            <p>限价: ${order.limitPrice}</p>
            <button onclick="cancelOrder(${order.id})">取消订单</button>
        `;
        container.appendChild(orderElement);
    });
}

function cancelOrder(orderId) {
    pendingOrders = pendingOrders.filter(order => order.id !== orderId);
    updatePendingOrders();
}

// 初始化
document.addEventListener("DOMContentLoaded", async () => {
    await initWallet();
    document.getElementById("connectWallet").addEventListener("click", connectWallet);
}); 