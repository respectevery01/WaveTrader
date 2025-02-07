from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import httpx
import os
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import asyncio
import base64

load_dotenv()

app = FastAPI(title="WaveTrader")

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# 配置从.env文件自动加载
load_dotenv()

# 从.env文件加载配置
GMGN_API_HOST = os.getenv("GMGN_API_HOST")
AI_MODEL_ID = os.getenv("AI_MODEL_ID")
AI_API_URL = os.getenv("AI_API_URL")
AI_API_KEY = os.getenv("AI_API_KEY")

class Message(BaseModel):
    role: str
    content: str

class AnalyzeRequest(BaseModel):
    token_address: str
    messages: List[Message]
    model: Optional[str] = None
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    temperature: float = 0.7
    max_tokens: Optional[int] = 4096
    top_p: Optional[float] = 0.7
    presence_penalty: Optional[float] = 0
    frequency_penalty: Optional[float] = 0
    stream: Optional[bool] = False
    stop: Optional[List[str]] = None
    n: Optional[int] = 1
    tools: Optional[List[Dict[str, Any]]] = None

class TradeParams(BaseModel):
    token_address: str
    amount: float
    slippage: float
    wallet_address: str
    trade_mode: str = "buy"  # buy or sell
    input_type: str = "sol"  # sol, token, or usd

class TokenTradeParams(BaseModel):
    token_address: str
    amount: float  # 代币数量
    slippage: float
    wallet_address: str

class SignedTransaction(BaseModel):
    signed_transaction: str

@app.get("/")
async def read_root():
    return FileResponse("static/index.html")

@app.get("/api/config")
async def get_config():
    return {
        "model": AI_MODEL_ID,
        "api_url": AI_API_URL,
        "api_key": AI_API_KEY
    }

@app.post("/api/analyze")
async def analyze_chart(request: AnalyzeRequest):
    try:
        # 使用环境变量中的配置，如果请求中没有提供
        model = request.model or AI_MODEL_ID
        api_url = request.api_url or AI_API_URL
        api_key = request.api_key or AI_API_KEY

        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")

        # 收集市场数据
        market_info = []
        
        # 从DexScreener获取详细价格数据
        try:
            # 使用和图表相同的地址格式
            dexscreener_url = f"https://api.dexscreener.com/latest/dex/tokens/{request.token_address}"
            headers = {}  # DexScreener API 不需要特殊的headers
            
            async with httpx.AsyncClient() as client:
                dex_response = await client.get(dexscreener_url, headers=headers)
                print("DexScreener API请求URL:", dexscreener_url)
                print("DexScreener API响应:", dex_response.text)
                
                if dex_response.status_code != 200:
                    print(f"DexScreener API请求失败: {dex_response.status_code}")
                    raise HTTPException(status_code=500, detail="Failed to fetch DexScreener data")
                    
                dex_data = dex_response.json()
                if not dex_data.get('pairs'):
                    print("没有找到交易对数据")
                    raise HTTPException(status_code=404, detail="No trading pairs found")
                    
                # 获取最活跃的交易对
                pairs = dex_data['pairs']
                # 按交易量排序
                pairs.sort(key=lambda x: float(x.get('volume', {}).get('h24', 0) or 0), reverse=True)
                main_pair = pairs[0]
                
                # 获取代币基本信息
                base_token = main_pair.get('baseToken', {})
                market_info.append(f"""
基本代币信息:
- 名称: {base_token.get('name', 'Unknown')}
- 符号: {base_token.get('symbol', 'Unknown')}
- 合约地址: {request.token_address}
""")
                
                # 获取交易数据
                txns = main_pair.get('txns', {})
                volume = main_pair.get('volume', {})
                price_change = main_pair.get('priceChange', {})
                liquidity = main_pair.get('liquidity', {})

                market_info.append(f"""
市场数据 (交易所: {main_pair.get('dexId')}):
- 当前价格: 
  * USD: ${main_pair.get('priceUsd', 'Unknown')}
  * SOL: {main_pair.get('priceNative', 'Unknown')} SOL
- 交易笔数:
  * 1小时: 买入 {txns.get('h1', {}).get('buys', 0)} / 卖出 {txns.get('h1', {}).get('sells', 0)}
  * 6小时: 买入 {txns.get('h6', {}).get('buys', 0)} / 卖出 {txns.get('h6', {}).get('sells', 0)}
  * 24小时: 买入 {txns.get('h24', {}).get('buys', 0)} / 卖出 {txns.get('h24', {}).get('sells', 0)}
- 价格变化:
  * 1小时: {price_change.get('h1', 'Unknown')}%
  * 6小时: {price_change.get('h6', 'Unknown')}%
  * 24小时: {price_change.get('h24', 'Unknown')}%
- 交易量:
  * 1小时: ${volume.get('h1', 'Unknown')}
  * 6小时: ${volume.get('h6', 'Unknown')}
  * 24小时: ${volume.get('h24', 'Unknown')}
- 流动性:
  * USD: ${liquidity.get('usd', 'Unknown')}
  * 代币数量: {liquidity.get('base', 'Unknown')}
  * SOL数量: {liquidity.get('quote', 'Unknown')}
- 完全稀释估值: ${main_pair.get('fdv', 'Unknown')}
- 市值: ${main_pair.get('marketCap', 'Unknown')}

交易所信息:
- DEX: {main_pair.get('dexId', 'Unknown').upper()}
- 交易对: {base_token.get('symbol', '')} / {main_pair.get('quoteToken', {}).get('symbol', '')}
- 交易对地址: {main_pair.get('pairAddress', 'Unknown')}
- 创建时间: {main_pair.get('pairCreatedAt', 'Unknown')}
- 交易对链接: {main_pair.get('url', 'Unknown')}""")

        except Exception as e:
            print(f"获取DexScreener数据失败: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch market data: {str(e)}")

        # 将市场数据添加到system prompt
        market_context = "\n".join(market_info)
        
        # 更新system prompt
        for msg in request.messages:
            if msg.role == "system":
                msg.content = f"""你是一位专业的加密货币交易分析师，专注于提供具体的交易建议。基于市场数据，你需要给出明确的：
1. 当前是适合买入还是卖出的时机
2. 具体的入场价格区间
3. 明确的止盈价格位置（可以设置多个目标位）
4. 明确的止损价格位置
5. 预计的持仓时间
6. 建议的仓位大小

请确保你的建议具体、可操作，包含具体的数字和百分比。

市场数据:\n{market_context}"""
                break
            
        # 构建请求头
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        # 构建用户提示
        user_prompt = f"""请分析 {base_token.get('symbol', 'Unknown')} 代币的交易机会，我需要具体的交易建议：

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

请给出具体的数字，而不是模糊的建议。"""

        # 更新用户消息
        for msg in request.messages:
            if msg.role == "user":
                msg.content = user_prompt
                break
        
        # 构建标准的OpenAI API请求格式
        ai_request = {
            "model": model,
            "messages": [msg.dict() for msg in request.messages],
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "top_p": request.top_p,
            "frequency_penalty": request.frequency_penalty,
            "presence_penalty": request.presence_penalty,
            "stream": request.stream,
            "n": request.n
        }
        
        # 移除所有None值的参数
        ai_request = {k: v for k, v in ai_request.items() if v is not None}
        
        try:
            async with httpx.AsyncClient(timeout=600.0) as client:  # 增加超时时间到600秒
                # 确保API URL以/v1结尾
                base_url = api_url.rstrip('/')
                if not base_url.endswith('/v1'):
                    base_url += '/v1'
                    
                print("发送到AI的请求:", ai_request)
                print("AI API URL:", f"{base_url}/chat/completions")
                print("AI API Headers:", headers)
                
                response = await client.post(
                    f"{base_url}/chat/completions",
                    headers=headers,
                    json=ai_request,
                    timeout=600.0  # 增加超时时间到600秒
                )
                
                print("AI API响应状态码:", response.status_code)
                print("AI API响应内容:", response.text)
                
                if response.status_code != 200:
                    error_detail = str(response.text)
                    print("AI API错误:", error_detail)
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"AI API error: {error_detail}"
                    )
                
                ai_response = response.json()
                try:
                    strategy = ai_response['choices'][0]['message']['content']
                    # 格式化策略输出为HTML
                    formatted_strategy = strategy.replace('\n', '<br>')
                    return {"status": "success", "strategy": formatted_strategy}
                except KeyError as e:
                    print("AI响应格式错误:", ai_response)
                    raise HTTPException(
                        status_code=500,
                        detail=f"Unexpected API response format: {str(ai_response)}"
                    )
                
        except httpx.RequestError as e:
            print("AI API网络错误:", str(e))
            print("错误类型:", type(e).__name__)
            print("错误详情:", str(e))
            raise HTTPException(
                status_code=500,
                detail=f"Network error when calling AI API: {str(e)}"
            )
        except Exception as e:
            print("处理AI响应时出错:", str(e))
            print("错误类型:", type(e).__name__)
            print("错误详情:", str(e))
            raise HTTPException(
                status_code=500,
                detail=f"Error processing AI response: {str(e)}"
            )
            
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error: {str(e)}"
        )

async def validate_token(token_address: str, client: httpx.AsyncClient) -> bool:
    """验证代币是否可交易"""
    try:
        # 直接检查是否有可用的交易路由
        quote_url = f"{GMGN_API_HOST}/defi/router/v1/sol/tx/get_swap_route"
        params = {
            "token_in_address": "So11111111111111111111111111111111111111112",
            "token_out_address": token_address,
            "in_amount": "1000000",  # 使用一个小额测试
            "from_address": "11111111111111111111111111111111",  # 使用一个虚拟地址测试
            "slippage": "1.0"
        }
        
        quote_response = await client.get(quote_url, params=params)
        print(f"验证代币 {token_address} 路由响应:", quote_response.text)
        
        if quote_response.status_code != 200:
            print(f"代币 {token_address} 路由检查失败")
            return False
            
        quote_data = quote_response.json()
        if not quote_data.get("data") or not quote_data["data"].get("raw_tx"):
            print(f"代币 {token_address} 没有可用的交易路由")
            return False
            
        return True
        
    except Exception as e:
        print(f"验证代币 {token_address} 时出错:", str(e))
        return False

@app.post("/api/trade")
async def execute_trade(trade_params: TradeParams):
    """执行交易"""
    try:
        if not trade_params.wallet_address:
            raise HTTPException(status_code=400, detail="Wallet address is required")

        async with httpx.AsyncClient() as client:
            # 如果是卖出操作，先检查代币账户
            if trade_params.trade_mode == "sell":
                # 获取代币精度和账户信息
                token_info_url = f"{GMGN_API_HOST}/defi/token/sol/{trade_params.token_address}/account/{trade_params.wallet_address}"
                token_response = await client.get(token_info_url)
                print("代币账户信息响应:", token_response.text)
                
                if token_response.status_code != 200:
                    raise HTTPException(status_code=400, detail="Failed to get token account info")
                
                token_data = token_response.json()
                if not token_data.get("data") or not token_data["data"].get("balance"):
                    raise HTTPException(status_code=400, detail="Token account not found or zero balance")
                
                # 获取代币精度
                decimals = token_data["data"].get("decimals", 9)
                # 计算代币数量（考虑精度）
                amount_tokens = int(trade_params.amount * (10 ** decimals))
                
                # 检查余额是否足够
                balance = int(token_data["data"]["balance"])
                if balance < amount_tokens:
                    raise HTTPException(status_code=400, detail=f"Insufficient token balance. Available: {balance / (10 ** decimals)}")
            else:
                # 买入操作，使用 SOL 数量
                amount_tokens = int(trade_params.amount * 1e9)  # 转换为 lamports

            # 构建交易URL
            quote_url = f"{GMGN_API_HOST}/defi/router/v1/sol/tx/get_swap_route"
            params = {
                "token_in_address": trade_params.token_address if trade_params.trade_mode == "sell" else "So11111111111111111111111111111111111111112",
                "token_out_address": "So11111111111111111111111111111111111111112" if trade_params.trade_mode == "sell" else trade_params.token_address,
                "in_amount": str(amount_tokens),
                "from_address": trade_params.wallet_address,
                "slippage": str(trade_params.slippage)
            }
            
            print("请求URL:", quote_url)
            print("请求参数:", params)
            
            quote_response = await client.get(quote_url, params=params)
            print("API响应状态码:", quote_response.status_code)
            print("API响应内容:", quote_response.text)
            
            if quote_response.status_code != 200:
                raise HTTPException(
                    status_code=quote_response.status_code, 
                    detail=f"Failed to get trade quote: {quote_response.text}"
                )
            
            quote_data = quote_response.json()
            if not quote_data.get("data") or not quote_data["data"].get("raw_tx"):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid response format: {quote_data}"
                )

            raw_tx = quote_data["data"]["raw_tx"]
            if not raw_tx.get("swapTransaction"):
                raise HTTPException(
                    status_code=400,
                    detail="No swap transaction in response"
                )
            
            return {
                "status": "success",
                "transaction": raw_tx["swapTransaction"],
                "lastValidBlockHeight": raw_tx.get("lastValidBlockHeight")
            }
            
    except Exception as e:
        print("执行交易时出错:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/trade_with_token")
async def execute_trade_with_token(trade_params: TradeParams):
    """使用代币数量交易"""
    try:
        if not trade_params.wallet_address:
            raise HTTPException(status_code=400, detail="Wallet address is required")

        async with httpx.AsyncClient() as client:
            # 构建交易URL
            quote_url = f"{GMGN_API_HOST}/defi/router/v1/sol/tx/get_swap_route"
            params = {
                "token_in_address": trade_params.token_address if trade_params.trade_mode == "sell" else "So11111111111111111111111111111111111111112",
                "token_out_address": "So11111111111111111111111111111111111111112" if trade_params.trade_mode == "sell" else trade_params.token_address,
                "in_amount": str(int(trade_params.amount * 1e9)),  # 统一使用 lamports
                "from_address": trade_params.wallet_address,
                "slippage": str(trade_params.slippage)
            }
            
            print("请求URL:", quote_url)
            print("请求参数:", params)
            
            quote_response = await client.get(quote_url, params=params)
            print("API响应状态码:", quote_response.status_code)
            print("API响应内容:", quote_response.text)
            
            if quote_response.status_code != 200:
                raise HTTPException(
                    status_code=quote_response.status_code, 
                    detail=f"Failed to get trade quote: {quote_response.text}"
                )
            
            quote_data = quote_response.json()
            print("解析后的响应数据:", quote_data)
            
            if not quote_data.get("data") or not quote_data["data"].get("raw_tx"):
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid response format: {quote_data}"
                )

            raw_tx = quote_data["data"]["raw_tx"]
            if not raw_tx.get("swapTransaction"):
                raise HTTPException(
                    status_code=400,
                    detail="No swap transaction in response"
                )
            
            return {
                "status": "success",
                "transaction": raw_tx["swapTransaction"],
                "lastValidBlockHeight": raw_tx.get("lastValidBlockHeight")
            }
            
    except Exception as e:
        print("执行代币交易时出错:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/confirm_trade")
async def confirm_trade(signed_tx: SignedTransaction):
    try:
        # 发送签名后的交易到GMGN
        submit_url = f"{GMGN_API_HOST}/defi/router/v1/sol/tx/submit_signed_transaction"
        headers = {
            "Content-Type": "application/json"
        }
        
        body = {
            "signed_tx": signed_tx.signed_transaction
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                submit_url,
                headers=headers,
                json=body
            )
            
            print("提交交易响应:", response.text)
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code, 
                    detail="Failed to submit transaction"
                )
            
            result = response.json()
            
            # 检查交易状态
            tx_hash = result.get("data", {}).get("hash")
            if not tx_hash:
                raise HTTPException(
                    status_code=500,
                    detail="No transaction hash returned"
                )
                
            return {"status": "success", "tx_hash": tx_hash}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/transaction_status")
async def get_transaction_status(hash: str, last_valid_height: int):
    try:
        # 构建完整的URL（包含查询参数）
        status_url = f"{GMGN_API_HOST}/defi/router/v1/sol/tx/get_transaction_status"
        params = {
            "hash": hash,
            "last_valid_height": str(last_valid_height)
        }
        
        async with httpx.AsyncClient() as client:
            status_response = await client.get(status_url, params=params)
            print("查询交易状态响应:", status_response.text)
            
            if status_response.status_code != 200:
                raise HTTPException(
                    status_code=status_response.status_code,
                    detail="Failed to get transaction status"
                )
            
            return status_response.json()
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True) 