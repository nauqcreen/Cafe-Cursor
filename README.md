# CursorContext Architect

**Dán link GitHub repo → nhận file `.cursorrules` tối ưu cho dự án đó trong vài giây.**

Thay vì tự viết `.cursorrules` từ đầu (mất 30–60 phút, dễ bỏ sót), công cụ này đọc thẳng vào codebase của bạn — dependencies, README, cấu trúc thư mục — rồi dùng Claude AI để sinh ra một bộ rules chính xác cho tech stack đó.

**Live:** [cafe-cursor-sepia.vercel.app](https://cafe-cursor-sepia.vercel.app)

---

## Dùng như thế nào?

### Cách 1 — Dán GitHub URL (phổ biến nhất)

1. Mở [cafe-cursor-sepia.vercel.app](https://cafe-cursor-sepia.vercel.app)
2. Dán link repo vào ô đầu tiên, ví dụ: `https://github.com/shadcn-ui/ui`
3. Nhấn **Generate Rules**
4. Rules stream về real-time — copy hoặc download file `.cursorrules`

Công cụ tự động đọc `package.json`, `README.md`, và cấu trúc thư mục gốc của repo đó để sinh rules phù hợp nhất.

---

### Cách 2 — Mô tả thủ công (khi repo private hoặc chưa có)

Bỏ qua ô GitHub URL, dán thẳng nội dung `package.json` hoặc liệt kê tech stack vào ô textarea:

```
Next.js 14, Tailwind CSS, Supabase, TypeScript, Shadcn UI, Zustand
```

Nhấn **Generate Rules** — kết quả tương đương Cách 1.

---

### Cách 3 — Terminal / CLI (cho dev workflow)

Không cần mở browser. Chạy thẳng một lệnh, rules được lưu vào file:

```bash
curl -sL "https://cafe-cursor-sepia.vercel.app/api/raw?repo=shadcn-ui/ui" > .cursorrules
```

Thay `shadcn-ui/ui` bằng `owner/repo` bất kỳ. Có thể tích hợp vào script onboarding của team.

---

## Các tính năng khác

**Refine Rules** — Sau khi có rules, nhập yêu cầu điều chỉnh vào ô bên dưới (ví dụ: *"thêm rules cho Vitest"*, *"bỏ phần về CSS modules"*). AI sẽ viết lại toàn bộ dựa trên rules hiện có, không cần generate lại từ đầu.

**Export to GitHub Gist** — Nhấn nút **Share via Gist** để tạo một public Gist chứa file `.cursorrules`. Nhận về link để chia sẻ với team hoặc lưu tham khảo.

**Shields.io Badge** — Sau khi generate, mục *Share your rules* hiện sẵn đoạn Markdown để gắn badge vào README repo của bạn, dẫn thẳng về trang generate cho repo đó.

**🔥 Global Trending** — Bảng xếp hạng real-time các repo được cộng đồng generate nhiều nhất. Click vào bất kỳ repo nào để generate ngay — không cần gõ lại URL.

**Recent Generations** — 5 repo bạn vừa generate gần nhất được lưu local trong browser. Tiện cho demo hoặc dùng lại nhiều lần.

---

## Chạy local

```bash
git clone https://github.com/nauqcreen/Cafe-Cursor.git
cd Cafe-Cursor
npm install
```

Tạo file `.env.local`:

```env
ANTHROPIC_API_KEY=sk-ant-...       # bắt buộc — lấy tại console.anthropic.com
GITHUB_TOKEN=github_pat_...        # optional — để dùng tính năng Export to Gist
REDIS_URL=redis://...              # optional — để dùng bảng Global Trending
```

Chạy:

```bash
npm run dev
# → http://localhost:3000
```

---

## Kiến trúc nhanh

```
Người dùng nhập URL
    ↓
API fetch GitHub (package.json + README + cấu trúc thư mục)
    ↓
Claude AI sinh .cursorrules (streaming từng dòng về client)
    ↓
Redis ghi +1 vào bảng Trending (background, không block response)
```

Toàn bộ logic AI nằm trong `lib/repo-utils.ts`. Các API route chỉ là thin wrapper.

---

## Stack

Next.js 16 · Anthropic Claude · Shadcn UI · Tailwind CSS v4 · ioredis · Vercel

---

## License

MIT
