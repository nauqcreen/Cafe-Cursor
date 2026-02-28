# CursorContext Architect

> Dán link GitHub repo → nhận file `.cursorrules` được tối ưu cho dự án của bạn trong vài giây.

**Live:** [cafe-cursor-sepia.vercel.app](https://cafe-cursor-sepia.vercel.app)

---

## Tính năng

| | |
|---|---|
| **Generate từ GitHub repo** | Tự động fetch `package.json`, `README`, cấu trúc thư mục gốc, rồi đưa vào Claude để sinh rules |
| **Generate từ mô tả thủ công** | Dán `package.json` hoặc liệt kê tech stack — không cần repo public |
| **Streaming real-time** | Rules được stream về từng dòng, không phải chờ toàn bộ |
| **Refine rules** | Nhập yêu cầu điều chỉnh, AI viết lại dựa trên rules hiện có |
| **Export to GitHub Gist** | Chia sẻ rules dưới dạng public Gist chỉ một click |
| **CLI (curl)** | Dùng thẳng trong terminal, không cần mở browser |
| **🔥 Global Trending** | Bảng xếp hạng repo được generate nhiều nhất, lưu trên Redis |
| **Recent Generations** | localStorage lưu 5 repo gần nhất, click để generate lại ngay |

---

## CLI

Không cần browser. Chạy thẳng trong terminal:

```bash
# Lấy rules cho một repo bất kỳ
curl -sL "https://cafe-cursor-sepia.vercel.app/api/raw?repo=shadcn-ui/ui" > .cursorrules

# Hoặc dùng full GitHub URL
curl -sL "https://cafe-cursor-sepia.vercel.app/api/raw?repo=https://github.com/vercel/next.js" > .cursorrules
```

---

## Chạy local

**1. Clone & cài dependencies**
```bash
git clone https://github.com/nauqcreen/Cafe-Cursor.git
cd Cafe-Cursor
npm install
```

**2. Tạo `.env.local`**
```env
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_TOKEN=github_pat_...      # để tạo Gist (optional)
REDIS_URL=redis://...            # để dùng Global Trending (optional)
```

**3. Chạy dev server**
```bash
npm run dev
# → http://localhost:3000
```

---

## Kiến trúc

```
app/
├── page.tsx                 # UI chính — client component, streaming, state
├── api/
│   ├── generate/route.ts    # POST: generate hoặc refine rules (streaming)
│   ├── raw/route.ts         # GET:  CLI endpoint, trả plain text stream
│   ├── gist/route.ts        # POST: tạo GitHub Gist
│   └── trending/route.ts    # GET:  top 5 repos từ Redis sorted set
lib/
├── repo-utils.ts            # fetchPackageJson, fetchRepoTree, buildAnthropicStream, trackRepo
├── redis.ts                 # ioredis singleton
└── utils.ts                 # cn()
scripts/
└── fetch-rules.sh           # Batch fetch .cursorrules cho nhiều repo
```

**Data flow (generate từ GitHub URL):**

```
Client  →  POST /api/generate  →  GitHub API (package.json + README + tree)
                               →  Claude claude-3-5-haiku (streaming)
                               →  ReadableStream về client
                               →  Redis zincrby (background, non-blocking)
```

---

## Biến môi trường

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Claude API key |
| `GITHUB_TOKEN` | ⬜ | Personal Access Token để tạo Gist |
| `REDIS_URL` | ⬜ | Redis connection string cho Global Trending |

---

## Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **AI:** Anthropic Claude (`@anthropic-ai/sdk`)
- **UI:** Shadcn UI, Tailwind CSS v4, Radix UI, Lucide
- **Database:** Redis via `ioredis` (Upstash/Redis Labs)
- **Syntax highlight:** `react-syntax-highlighter` + Prism `vscDarkPlus`
- **Deploy:** Vercel

---

## Scripts tiện ích

```bash
# Batch fetch .cursorrules cho 5 repo nổi tiếng
./scripts/fetch-rules.sh

# Dùng URL khác (e.g. local dev)
./scripts/fetch-rules.sh http://localhost:3000

# Lưu vào thư mục riêng
OUT_DIR=./rules ./scripts/fetch-rules.sh
```

---

## License

MIT
