# 🌐 The Browser Arena

<div align="center">

**Compare AI browser automation agents side-by-side. Submit a task, watch agents run in real-time, and compare speed, cost, and success.**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

![Arena Demo](assets/tba-demo-bg.gif)

**[⭐ Star this repo](https://github.com/kalil0321/the-browser-arena)** if you find it useful! It helps others discover the project.

[🚀 Live Demo](https://www.thebrowserarena.com) • [📖 Documentation](#) • [🐛 Report Bug](https://github.com/kalil0321/the-browser-arena/issues) • [💡 Request Feature](https://github.com/kalil0321/the-browser-arena/issues)

</div>

---

## 🎯 Why The Browser Arena?

Choosing the right browser automation agent is hard. Each agent has different strengths, costs, and performance characteristics. **The Browser Arena** lets you:

- **Test multiple agents simultaneously** on the same task
- **Compare real-time performance** with live browser views
- **Make data-driven decisions** with built-in metrics (time, cost, success rate)
- **Save and replay sessions** to analyze what worked and what didn't

Perfect for developers, researchers, and teams evaluating browser automation solutions.

---

## ✨ Features

### 🤖 Multi-Agent Support
- **Browser-Use** - Multi-step browser automation with LLM reasoning
- **Smooth** - AI-powered web automation
- **Stagehand** - Local and cloud browser automation
- **Notte** - Cloud browser sessions with live preview

### 📊 Real-Time Comparison
- **Parallel execution** - Watch multiple agents work simultaneously
- **Live browser views** - See exactly what each agent is doing
- **Built-in metrics** - Time, steps, cost, and success rate tracking
- **Session history** - All runs are automatically saved

### 🔧 Flexible Configuration
- **Multi-LLM support** - OpenAI, Google Gemini, Anthropic Claude
- **Cost tracking** - Monitor API usage and expenses

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.12+
- A Convex account ([sign up free](https://convex.dev))
- At least one LLM API key (OpenAI, Google, or Anthropic)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/kalil0321/the-browser-arena.git
cd the-browser-arena
```

2. **Install dependencies**
```bash
# Install web app dependencies
npm install

# Install agent server dependencies
cd agents
uv sync  # or: pip install -r requirements.txt
cd ..
```

3. **Set up Convex**
```bash
npx convex auth
npx convex dev
```

4. **Configure environment variables**

Create `.env.local` in the project root:

```env
# Convex (required)
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOYMENT=your-deployment

# LLMs (add at least one)
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
ANTHROPIC_API_KEY=...

# Browser automation services
BROWSER_USE_API_KEY=...          # Optional
SMOOTH_API_KEY=...               # Optional
BROWSERBASE_API_KEY=...          # Optional
BROWSERBASE_PROJECT_ID=...       # Optional

# Agent servers
AGENT_SERVER_URL=http://localhost:8080
STAGEHAND_SERVER_URL=http://localhost:3001
```

5. **Start the services**

Terminal 1 - Web app:
```bash
npm run dev
```

Terminal 2 - Agent server:
```bash
cd agents
source .venv/bin/activate
python server.py
```

Terminal 3 - Stagehand server:
```bash 
cd stagehand
npm i
npx tsx index.ts # if you have tsx
```

6. **Open your browser**

Navigate to [http://localhost:3000](http://localhost:3000)

---

## 📖 Usage

1. **Create a task** - Enter a browser automation instruction (e.g., "Find the cheapest flight from NYC to London")
2. **Select agents** - Choose which agents to compare
3. **Configure settings** - Set LLM models and other parameters
4. **Watch them run** - Observe agents execute in real-time with live browser views
5. **Compare results** - Review metrics, actions, and analyze performance

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. 🐛 **Report bugs** - Open an issue with detailed information
2. 💡 **Suggest features** - Share your ideas for improvements
3. 🔀 **Submit PRs** - Fix bugs or add new features

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

Built with amazing open-source tools and browser automation frameworks:
- [Browser-Use](https://github.com/browser-use/browser-use)
- [Stagehand](https://github.com/browserbase/stagehand)
- [Convex](https://convex.dev)
- [Next.js](https://nextjs.org)

---

<div align="center">

**[⭐ Star this repo](https://github.com/kalil0321/the-browser-arena)** if you find it useful!

</div>
