// Global variables
let currentTokenAddress = '';
let chatHistory = [];
let modelConfig = null;
let wallet = null;
let pendingOrders = [];
let currentTokenSymbol = '';

// Update temperature display
function updateTemperature(value) {
    const temperature = (value / 100).toFixed(2);
    document.getElementById('temperatureValue').textContent = temperature;
}

// Update top p display
function updateTopP(value) {
    const topP = (value / 100).toFixed(2);
    document.getElementById('topPValue').textContent = topP;
}

// Update frequency penalty display
function updateFreqPenalty(value) {
    const freqPenalty = (value / 100).toFixed(2);
    document.getElementById('freqPenaltyValue').textContent = freqPenalty;
}

// Get model parameters
function getModelParameters() {
    const temperature = parseFloat(document.getElementById('temperatureSlider').value) / 100;
    const topP = parseFloat(document.getElementById('topPSlider').value) / 100;
    const freqPenalty = parseFloat(document.getElementById('freqPenaltySlider').value) / 100;
    const maxTokens = 2048; // 使用固定值

    const params = {
        temperature: temperature,
        max_tokens: maxTokens,
        top_p: topP,
        frequency_penalty: freqPenalty,
        presence_penalty: 0,
        stream: false,
        n: 1
    };

    // 如果有服务器配置，使用服务器配置
    if (modelConfig) {
        params.model = modelConfig.model;
        params.api_url = modelConfig.api_url;
        params.api_key = modelConfig.api_key;
    }

    return params;
}

// Load model configuration
async function loadModelConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error('Failed to load model config');
        }
        modelConfig = await response.json();
    } catch (error) {
        console.error('加载模型配置失败:', error);
        // 不再尝试更新UI
    }
}

// Load chart data
function loadChart() {
    const tokenAddress = document.getElementById('tokenAddress').value;
    if (!tokenAddress) {
        alert('请输入代币合约地址');
        return;
    }

    // 获取代币信息
    fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`)
        .then(response => response.json())
        .then(data => {
            if (data.pairs && data.pairs.length > 0) {
                const baseToken = data.pairs[0].baseToken;
                currentTokenSymbol = baseToken.symbol;
                // 更新输入标签
                updateInputLabels();
            }
        })
        .catch(error => console.error('获取代币信息失败:', error));

    // 加载图表
    const timestamp = new Date().getTime();
    const chartUrl = `https://www.gmgn.cc/kline/sol/${tokenAddress}?t=${timestamp}`;
    const iframe = document.getElementById('chartFrame');
    iframe.src = chartUrl;
    currentTokenAddress = tokenAddress;
}

// Generate trading strategy
async function generateStrategy() {
    const strategyOutput = document.getElementById('strategyOutput');
    strategyOutput.innerHTML = '正在生成策略...';

    try {
        const tokenAddress = document.getElementById('tokenAddress').value;
        if (!tokenAddress) {
            strategyOutput.innerHTML = '请先输入代币合约地址';
            return;
        }

        if (!modelConfig) {
            await loadModelConfig();
            if (!modelConfig) {
                throw new Error('无法加载模型配置');
            }
        }

        const params = getModelParameters();
        const messages = [
            {
                role: "system",
                content: "你是一位专业的加密货币交易分析师。你将获得来自GMGN和DexScreener的详细市场数据，包括价格变化、流动性、交易量等信息。请基于这些数据进行深入分析，特别关注价格趋势、流动性变化和市场情绪。在分析中要考虑短期（5分钟到1小时）和中长期（6小时到24小时）的价格变动。"
            },
            {
                role: "user",
                content: `请分析Solana代币 ${tokenAddress} 并提供以下建议：
1. 交易方向：
   - 现在是买入还是卖出的好时机？
   - 为什么这么建议？

2. 具体价格位置：
   - 建议的入场价格区间
   - 第一目标位（止盈点）
   - 第二目标位（如果有）
   - 止损位置
   
3. 交易计划：
   - 建议的持仓时间
   - 建议的仓位大小（占总资金的百分比）
   - 是否建议分批建仓/退场
   
4. 风险提示：
   - 目前最大的风险是什么
   - 如何管理这些风险

请给出具体的数字，而不是模糊的建议。`
            }
        ];

        // 设置更长的超时时间
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('请求超时')), 600000); // 10分钟超时
        });

        // 创建实际的请求
        const fetchPromise = fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                token_address: tokenAddress,
                ...params,
                messages: messages
            })
        });

        // 使用Promise.race来处理超时
        const response = await Promise.race([fetchPromise, timeoutPromise]);

        // 检查响应状态
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API响应错误:', errorText);
            throw new Error(errorText || '策略生成请求失败');
        }

        // 读取响应内容
        const data = await response.json();
        console.log('API响应数据:', data);

        if (data.strategy) {
            // 使用 marked 将 markdown 转换为 HTML
            strategyOutput.style.whiteSpace = 'pre-wrap';
            strategyOutput.className = 'bg-gray-700 p-6 rounded-lg min-h-[300px] text-lg markdown-body';
            const formattedStrategy = data.strategy
                .replace(/<br>/g, '\n')
                .replace(/\*\*/g, '__')  // 转换粗体标记
                .replace(/- /g, '* ');   // 转换列表标记
            strategyOutput.innerHTML = marked.parse(formattedStrategy);
        } else {
            throw new Error('无效的响应格式');
        }
    } catch (error) {
        console.error('生成策略时出错:', error);
        if (error.message === '请求超时') {
            strategyOutput.innerHTML = '生成策略需要较长时间，请耐心等待...';
            // 继续轮询检查结果
            let retryCount = 0;
            const checkResult = async () => {
                try {
                    const response = await fetch('/api/analyze', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            token_address: tokenAddress,
                            ...params,
                            messages: messages
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.strategy) {
                            strategyOutput.style.whiteSpace = 'pre-wrap';
                            strategyOutput.className = 'bg-gray-700 p-6 rounded-lg min-h-[300px] text-lg markdown-body';
                            const formattedStrategy = data.strategy
                                .replace(/<br>/g, '\n')
                                .replace(/\*\*/g, '__')
                                .replace(/- /g, '* ');
                            strategyOutput.innerHTML = marked.parse(formattedStrategy);
                            return;
                        }
                    }

                    if (retryCount++ < 60) { // 最多重试60次，每10秒一次
                        strategyOutput.innerHTML = `生成策略中，请耐心等待... (${retryCount}/60)`;
                        setTimeout(checkResult, 10000);
                    } else {
                        strategyOutput.innerHTML = '生成策略超时，请重试';
                    }
                } catch (error) {
                    console.error('检查结果时出错:', error);
                    if (retryCount++ < 60) {
                        setTimeout(checkResult, 10000);
                    } else {
                        strategyOutput.innerHTML = '生成策略失败，请重试';
                    }
                }
            };
            setTimeout(checkResult, 10000);
        } else {
            strategyOutput.innerHTML = `生成策略时出错: ${error.message}`;
        }
    }
}

// Initialize Solana wallet connection
async function initWallet() {
    try {
        if ('solana' in window) {
            const provider = window.solana;
            if (provider.isPhantom) {
                return provider;
            }
        }
        window.open('https://phantom.app/', '_blank');
    } catch (error) {
        console.error('Wallet initialization error:', error);
    }
    return null;
}

// Connect wallet
async function connectWallet() {
    try {
        if (!wallet) {
            wallet = await initWallet();
        }
        
        if (!wallet) {
            alert('请先安装Phantom钱包');
            return;
        }

        const button = document.getElementById('walletButton');
        
        if (!wallet.isConnected) {
            await wallet.connect();
            const publicKey = wallet.publicKey.toString();
            button.innerHTML = `<span>${publicKey.slice(0, 4)}...${publicKey.slice(-4)}</span>`;
            button.classList.add('connected');
        } else {
            await wallet.disconnect();
            button.innerHTML = '<span>连接钱包</span>';
            button.classList.remove('connected');
            wallet = null;
        }
    } catch (error) {
        console.error('Wallet connection error:', error);
        alert('连接钱包时出错');
    }
}

// Handle order type change
document.getElementById('orderType').addEventListener('change', function(e) {
    const limitPriceContainer = document.getElementById('limitPriceContainer');
    if (e.target.value === 'limit') {
        limitPriceContainer.classList.remove('hidden');
    } else {
        limitPriceContainer.classList.add('hidden');
    }
});

// Handle trade mode and input type changes
document.getElementById('tradeMode').addEventListener('change', updateInputLabels);
document.getElementById('inputType').addEventListener('change', updateInputLabels);

function updateInputLabels() {
    const tradeMode = document.getElementById('tradeMode').value;
    const inputType = document.getElementById('inputType').value;
    const amountLabel = document.getElementById('amountLabel');
    const amountInput = document.getElementById('amount');
    const inputTypeSelect = document.getElementById('inputType');
    const inputTypeContainer = document.getElementById('inputTypeContainer');

    // 获取当前代币符号
    const tokenSymbol = currentTokenSymbol || '代币';

    // 如果是卖出，隐藏输入类型选择，固定为代币数量
    if (tradeMode === 'sell') {
        inputTypeContainer.style.display = 'none';
        labelText = `${tokenSymbol}数量`;
        placeholder = `输入要卖出的${tokenSymbol}数量`;
    } else {
        // 买入时显示输入类型选择
        inputTypeContainer.style.display = 'block';
        if (inputType === 'token') {
            labelText = `${tokenSymbol}数量`;
            placeholder = `输入要买入的${tokenSymbol}数量`;
        } else {
            labelText = 'SOL数量';
            placeholder = '输入要支付的SOL数量';
        }
    }

    amountLabel.textContent = `${tradeMode === 'buy' ? '买入' : '卖出'}${labelText}`;
    amountInput.placeholder = placeholder;
}

// Add pending order
function addPendingOrder(order) {
    pendingOrders.push(order);
    updateOrdersList();
}

// Update orders list display
function updateOrdersList() {
    const ordersList = document.getElementById('ordersList');
    ordersList.innerHTML = pendingOrders.map((order, index) => `
        <div class="bg-gray-700 p-3 rounded flex justify-between items-center">
            <div>
                <span class="text-sm text-gray-400">${order.type === 'limit' ? '限价单' : '市价单'}</span>
                <span class="ml-2">${order.amount} SOL</span>
                ${order.type === 'limit' ? `<span class="ml-2">@ $${order.price}</span>` : ''}
            </div>
            <button onclick="cancelOrder(${index})" class="text-red-500 hover:text-red-400">
                取消
            </button>
        </div>
    `).join('');
}

// Cancel order
function cancelOrder(index) {
    pendingOrders.splice(index, 1);
    updateOrdersList();
}

// Execute trade
async function executeTrade() {
    if (!wallet || !wallet.isConnected) {
        alert('请先连接钱包');
        return;
    }

    const tokenAddress = currentTokenAddress;
    const amount = parseFloat(document.getElementById('amount').value);
    const slippage = parseFloat(document.getElementById('slippage').value);
    const tradeMode = document.getElementById('tradeMode').value;
    const inputType = document.getElementById('inputType').value;
    const orderType = document.getElementById('orderType').value;
    const limitPrice = document.getElementById('limitPrice').value;

    if (!tokenAddress) {
        alert('请先输入代币合约地址');
        return;
    }

    if (!amount || isNaN(amount) || amount <= 0) {
        alert('请输入有效的交易数量');
        return;
    }

    if (!slippage || isNaN(slippage) || slippage <= 0) {
        alert('请输入有效的滑点值');
        return;
    }

    try {
        if (orderType === 'limit') {
            if (!limitPrice || isNaN(limitPrice) || limitPrice <= 0) {
                alert('请输入有效的限价');
                return;
            }
            // 添加到挂单列表
            addPendingOrder({
                type: 'limit',
                tradeMode: tradeMode,
                inputType: inputType,
                amount: amount,
                price: limitPrice,
                tokenAddress: tokenAddress,
                tokenSymbol: currentTokenSymbol,
                timestamp: new Date().getTime()
            });
            alert('限价单已添加到挂单列表');
            return;
        }

        // 构建交易请求
        const tradeRequest = {
            token_address: tokenAddress,
            amount: amount,
            slippage: slippage,
            wallet_address: wallet.publicKey.toString(),
            trade_mode: tradeMode
        };

        console.log('交易请求:', tradeRequest);

        // 执行交易
        const response = await fetch('/api/trade', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tradeRequest)
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('获取交易参数失败:', errorData);
            try {
                const errorJson = JSON.parse(errorData);
                if (errorJson.detail && errorJson.detail.includes("Insufficient token balance")) {
                    const match = errorJson.detail.match(/Available: ([\d.]+)/);
                    if (match) {
                        throw new Error(`代币余额不足，可用余额: ${match[1]} ${currentTokenSymbol}`);
                    }
                }
                throw new Error(errorJson.detail || '获取交易参数失败');
            } catch (e) {
                throw new Error(e.message || errorData);
            }
        }

        const data = await response.json();
        console.log('交易参数响应:', data);
        
        if (!data.transaction) {
            throw new Error('未获取到交易数据');
        }

        try {
            // 使用Buffer polyfill
            const { Buffer } = window.buffer;
            
            // 解码base64交易数据
            const transactionBuffer = Buffer.from(data.transaction, 'base64');
            console.log('交易数据:', transactionBuffer);
            
            // 反序列化交易
            const transaction = solanaWeb3.VersionedTransaction.deserialize(transactionBuffer);
            console.log('反序列化的交易:', transaction);
            
            // 请求用户签名
            const signedTransaction = await wallet.signTransaction(transaction);
            console.log('签名后的交易:', signedTransaction);
            
            // 序列化签名后的交易为base64
            const serializedTransaction = Buffer.from(signedTransaction.serialize()).toString('base64');
            console.log('序列化后的交易:', serializedTransaction);
            
            // 发送签名后的交易
            const confirmResponse = await fetch('/api/confirm_trade', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    signed_transaction: serializedTransaction
                })
            });

            if (!confirmResponse.ok) {
                const errorData = await confirmResponse.text();
                console.error('交易确认失败:', errorData);
                throw new Error(`交易确认失败: ${errorData}`);
            }

            const confirmData = await confirmResponse.json();
            console.log('交易确认响应:', confirmData);
            
            // 显示交易成功消息
            alert('交易已提交! 交易哈希: ' + confirmData.tx_hash);
            
            // 开始轮询交易状态
            let maxRetries = 60; // 最多等待60秒
            const checkStatus = async () => {
                try {
                    const statusResponse = await fetch(
                        `/api/transaction_status?hash=${confirmData.tx_hash}&last_valid_height=${data.lastValidBlockHeight}`
                    );
                    
                    if (statusResponse.ok) {
                        const statusData = await statusResponse.json();
                        console.log('交易状态:', statusData);
                        if (statusData.data.success) {
                            alert('交易已确认成功!');
                            return;
                        } else if (statusData.data.expired) {
                            alert('交易已过期');
                            return;
                        }
                    }
                    
                    if (--maxRetries > 0) {
                        setTimeout(checkStatus, 1000);
                    } else {
                        alert('交易状态查询超时，请手动检查交易状态');
                    }
                } catch (error) {
                    console.error('检查交易状态时出错:', error);
                }
            };
            
            checkStatus();
            
        } catch (error) {
            console.error('交易签名错误:', error);
            throw new Error('交易签名失败: ' + error.message);
        }
    } catch (error) {
        console.error('执行交易时出错:', error);
        alert('执行交易失败: ' + error.message);
    }
}

// AI Chat functions
function appendMessage(role, content) {
    const chatHistory = document.getElementById('chatHistory');
    const messageDiv = document.createElement('div');
    messageDiv.className = `mb-2 ${role === 'user' ? 'text-right' : ''}`;
    
    const messageBubble = document.createElement('div');
    messageBubble.className = `inline-block p-2 rounded-lg ${role === 'user' ? 'bg-purple-600' : 'bg-gray-600'} max-w-[80%]`;
    messageBubble.innerText = content;
    
    messageDiv.appendChild(messageBubble);
    chatHistory.appendChild(messageDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Clear input
    input.value = '';
    
    // Display user message
    appendMessage('user', message);

    const modelParams = getModelParameters();
    if (!modelConfig) {
        appendMessage('assistant', '模型配置加载失败，请刷新页面重试');
        return;
    }
    
    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                token_address: currentTokenAddress,
                ...modelParams,
                messages: [
                    {
                        role: "system",
                        content: "你是一位专业的加密货币交易分析助手。你可以访问来自GMGN和DexScreener的实时市场数据，包括价格、交易量、流动性等关键指标。请基于这些数据为用户提供专业的交易分析和建议。在回答问题时，要结合短期和长期的市场趋势，并始终强调风险管理的重要性。"
                    },
                    {
                        role: "user",
                        content: message
                    }
                ]
            })
        });
        
        const data = await response.json();
        appendMessage('assistant', data.strategy.replace(/<br>/g, '\n'));
    } catch (error) {
        console.error('发送消息时出错:', error);
        appendMessage('assistant', '抱歉，处理您的消息时出现错误。');
    }
}

// Handle Enter key in chat input
document.addEventListener('DOMContentLoaded', () => {
    // 加载模型配置
    loadModelConfig();
    
    // 设置默认代币地址并加载图表
    const defaultToken = "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82";
    document.getElementById('tokenAddress').value = defaultToken;
    loadChart();
    
    // 添加聊天输入框的回车事件监听
    const chatInput = document.getElementById('chatInput');
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });
});

// 在文件顶部添加 marked.js
document.head.innerHTML += '<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>'; 