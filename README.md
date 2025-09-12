# Planning Poker - Serverless Cost-Optimized Edition

🚀 **80-90% AWS Cost Savings** vs traditional always-on server architecture!

## 💰 Cost Comparison

- **Traditional Server**: ~$25/month (always running)
- **Our Serverless**: ~$2-5/month (pay per use)
- **Your Savings**: $20-23/month ($240-275/year)

## ⚡ Pure Serverless Architecture

- **AWS Lambda**: Functions execute only when users vote
- **DynamoDB**: Pay-per-request with TTL auto-cleanup  
- **API Gateway**: WebSocket billed per message
- **Zero Idle Costs**: Scales to zero when not in use

## 🚀 Quick Start

```bash
# Local development (completely free)
npm run dev

# Deploy to AWS (cost-optimized)
npm run deploy

# Monitor costs
npm run cost:monitor
```

## 🛠️ Development Commands

- `npm run dev` - Start serverless development (free)
- `npm run deploy` - Deploy to AWS (cost-optimized)  
- `npm run test:cost` - Validate cost savings
- `npm run cost:monitor` - Check AWS costs
- `npm run remove` - Remove all AWS resources (zero cost)

## 📊 Expected Monthly Costs

- **Light usage** (50 sessions): ~$0.50
- **Medium usage** (500 sessions): ~$2.00
- **Heavy usage** (2000 sessions): ~$5.00
- **Traditional server**: $25.00 (fixed)

All serverless costs scale with actual usage - no waste!

## 🎯 Features

- Real-time voting with Fibonacci scale (1,2,3,5,8,13)
- Auto-session cleanup (DynamoDB TTL)
- Consensus detection and re-voting
- Mobile responsive design
- **Maximum cost optimization**

Start saving money immediately with serverless! 💰
