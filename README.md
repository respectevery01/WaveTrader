# WaveTrader

[English](#english) | [中文](#chinese)

<a name="english"></a>
## WaveTrader - AI-Powered Solana Trading Bot

An AI-powered Solana trading bot providing real-time chart analysis, intelligent trading strategy generation, and automated trading execution.

### Features

- 🚀 Real-time price chart display
- 🤖 AI-driven trading strategy generation
- 💰 Automated trading execution
- 📊 Market data analysis
- 🔒 Secure wallet integration
- 💡 Smart trading suggestions

### System Requirements

- Python 3.8+
- Node.js 14+
- Phantom Wallet
- DeepSeek API Key
- GMGN API Access

### Installation

1. Clone repository:
```bash
git clone <repository-url>
cd wave-trader
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Fill in required configuration:
```env
# AI Model Configuration
AI_MODEL_ID=deepseek-chat
AI_API_URL=https://api.deepseek.com
AI_API_KEY=your_api_key_here

# GMGN Configuration
GMGN_API_HOST=https://gmgn.ai
```

### Usage

1. Start server:
```bash
python server.py
```

2. Open browser:
```
http://localhost:8000
```

3. Connect Phantom wallet:
   - Click "Connect Wallet" button
   - Confirm connection in Phantom wallet

4. Trading operations:
   - Enter token contract address
   - View real-time price chart
   - Generate AI trading strategy
   - Execute buy/sell operations

### Security

- Private key security:
  - All private keys securely managed by Phantom wallet
  - Application cannot access private keys
  - All transactions require wallet confirmation

- Trading security:
  - Slippage protection
  - Balance check before trading
  - Complete error handling
  - Transaction status monitoring

### API Endpoints

#### Trading Related

- `POST /api/trade`: Execute trade
- `POST /api/confirm_trade`: Confirm trade
- `GET /api/transaction_status`: Query transaction status

#### AI Strategy Related

- `POST /api/analyze`: Generate trading strategy
- `GET /api/config`: Get AI configuration

### Development Guide

#### Frontend Structure

```
static/
├── app.js      # Main application logic
├── styles.css  # Style file
└── index.html  # Main page
```

#### Backend Structure

```
server.py       # FastAPI server
requirements.txt # Python dependencies
.env           # Environment configuration
```

### Common Issues

1. Wallet connection issues:
   - Ensure Phantom wallet is installed
   - Check if wallet is unlocked
   - Ensure on Solana mainnet or testnet

2. Trading failures:
   - Check sufficient balance
   - Confirm reasonable slippage settings
   - View specific error messages

3. AI strategy generation failures:
   - Confirm API key configuration
   - Check network connection
   - View server logs

### License

MIT License

### Contact

- Issue feedback: Submit in GitHub Issues
- Feature suggestions: Welcome Pull Requests

### Disclaimer

- This project is for learning and research purposes only
- Cryptocurrency trading carries high risk, please use with caution
- Author not responsible for any losses from using this software

---

<a name="chinese"></a>
## WaveTrader - AI 驱动的 Solana 交易机器人

一个基于 AI 的 Solana 交易机器人，提供实时图表分析、智能交易策略生成和自动化交易执行功能。

### 功能特点

- 🚀 实时价格图表显示
- 🤖 AI 驱动的交易策略生成
- 💰 自动化交易执行
- 📊 市场数据分析
- 🔒 安全的钱包集成
- 💡 智能交易建议

### 系统要求

- Python 3.8+
- Node.js 14+
- Phantom 钱包
- DeepSeek API 密钥
- GMGN API 访问权限

### 安装步骤

1. 克隆仓库：
```bash
git clone <repository-url>
cd wave-trader
```

2. 安装 Python 依赖：
```bash
pip install -r requirements.txt
```

3. 配置环境变量：
   - 复制 `.env.example` 到 `.env`
   - 填写必要的配置信息：
```env
# AI Model Configuration
AI_MODEL_ID=deepseek-chat
AI_API_URL=https://api.deepseek.com
AI_API_KEY=your_api_key_here

# GMGN Configuration
GMGN_API_HOST=https://gmgn.ai
```

### 使用方法

1. 启动服务器：
```bash
python server.py
```

2. 打开浏览器访问：
```
http://localhost:8000
```

3. 连接 Phantom 钱包：
   - 点击右上角的"连接钱包"按钮
   - 在 Phantom 钱包中确认连接

4. 交易操作：
   - 输入代币合约地址
   - 查看实时价格图表
   - 生成 AI 交易策略
   - 执行买入/卖出操作

### 安全说明

- 私钥安全：
  - 所有私钥由 Phantom 钱包安全管理
  - 应用程序无法访问私钥
  - 所有交易都需要在钱包中确认

- 交易安全：
  - 支持滑点保护
  - 交易前余额检查
  - 完整的错误处理
  - 交易状态监控

### API 端点

#### 交易相关

- `POST /api/trade`：执行交易
- `POST /api/confirm_trade`：确认交易
- `GET /api/transaction_status`：查询交易状态

#### AI 策略相关

- `POST /api/analyze`：生成交易策略
- `GET /api/config`：获取 AI 配置

### 开发指南

#### 前端结构

```
static/
├── app.js      # 主要应用逻辑
├── styles.css  # 样式文件
└── index.html  # 主页面
```

#### 后端结构

```
server.py       # FastAPI 服务器
requirements.txt # Python 依赖
.env           # 环境配置
```

### 常见问题

1. 钱包连接问题：
   - 确保安装了 Phantom 钱包
   - 检查钱包是否已解锁
   - 确保在 Solana 主网或测试网

2. 交易失败：
   - 检查余额是否充足
   - 确认滑点设置是否合理
   - 查看具体的错误信息

3. AI 策略生成失败：
   - 确认 API 密钥配置正确
   - 检查网络连接
   - 查看服务器日志

### 许可证

MIT License

### 联系方式

- 问题反馈：在 GitHub Issues 中提交
- 功能建议：欢迎提交 Pull Request

### 免责声明

- 本项目仅供学习和研究使用
- 加密货币交易具有高风险，请谨慎使用
- 作者不对使用本软件造成的任何损失负责 