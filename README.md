# CursorContext Architect

Dán GitHub repo URL → nhận `.cursorrules` tối ưu cho dự án đó.

**Live:** [cafe-cursor-sepia.vercel.app](https://cafe-cursor-sepia.vercel.app)

---

## Dùng

**Browser** — dán link repo, nhấn Generate, copy kết quả.

**Terminal** — một lệnh, không cần mở browser:
```bash
curl -sL "https://cafe-cursor-sepia.vercel.app/api/raw?repo=shadcn-ui/ui" > .cursorrules
```

**Không có repo** — dán `package.json` hoặc liệt kê tech stack vào ô textarea.

---

## Tính năng

- **Refine** — nhập yêu cầu chỉnh sửa, AI viết lại rules mà không cần generate lại từ đầu
- **Export Gist** — tạo public GitHub Gist để chia sẻ với team
- **🔥 Trending** — bảng repo được generate nhiều nhất, click để generate ngay
- **Recent** — 5 repo vừa dùng lưu local, truy cập lại một click

---

## Chạy local

```bash
git clone https://github.com/nauqcreen/Cafe-Cursor.git && cd Cafe-Cursor && npm install
```

`.env.local`:
```env
ANTHROPIC_API_KEY=sk-ant-...   # bắt buộc
GITHUB_TOKEN=github_pat_...    # optional, để Export Gist
REDIS_URL=redis://...          # optional, để Trending
```

```bash
npm run dev
```

---

MIT
