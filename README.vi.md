# Loomgate examples

Các ví dụ chạy được về thanh toán thẻ với [Loomgate](https://loomgate.io), kèm một playground để thử API bằng tài
khoản của chính bạn. Chọn ví dụ hợp với hệ thống của bạn và chép vào dự án.

[English](./README.md) · Tiếng Việt

- **Tài liệu**: [docs.loomgate.io](https://docs.loomgate.io) (tiếng Anh: [docs.loomgate.io/en](https://docs.loomgate.io/en)). Cùng tài liệu đó ở
  [hk0-6.gitbook.io/loomgate](https://hk0-6.gitbook.io/loomgate) nếu địa chỉ đầu không mở được.
- **Merchant dashboard**: [app.loomgate.io](https://app.loomgate.io): [API key](https://app.loomgate.io/api-keys), [webhook](https://app.loomgate.io/webhooks),
  [tên miền Apple Pay & Google Pay](https://app.loomgate.io/wallet-domains), và trang [Tài liệu & ví dụ](https://app.loomgate.io/docs) gom mọi liên kết này.
- **Playground**: [examples.loomgate.io](https://examples.loomgate.io), để thử API bằng key của bạn
  ([bên dưới](#playground)).
- **WooCommerce**: tải plugin [Loomgate for WooCommerce 0.0.5](https://github.com/loomgroup/loomgate-examples/releases/download/woocommerce-v0.0.5/loomgate-woocommerce-0.0.5.zip)
  ([ghi chú phát hành](https://github.com/loomgroup/loomgate-examples/releases/tag/woocommerce-v0.0.5)), rồi làm theo trang
  [WooCommerce](https://docs.loomgate.io/integrations/woocommerce).

| Thư mục | Minh hoạ | Phía trình duyệt | Phía server |
|---|---|---|---|
| [`examples/js`](./examples/js) | JavaScript SDK từ npm, không framework | `@loompay/loomgate-js-sdk` + Vite | Cloudflare Worker |
| [`examples/js-cdn`](./examples/js-cdn) | Script host sẵn, không cần bundler (**khuyến nghị** khi không có bundler) | `<script src="https://api.loomgate.io/partner/v1/loomgate.js">` | Cloudflare Worker |
| [`examples/js-umd`](./examples/js-umd) | Bản build cho trình duyệt từ jsDelivr, ghim phiên bản, có SRI | `<script src="https://cdn.jsdelivr.net/npm/@loompay/loomgate-js-sdk@0.1.0/dist/loomgate.js">` | Cloudflare Worker |
| [`examples/react`](./examples/react) | React SDK với shadcn/ui | `@loompay/loomgate-react-sdk` | Cloudflare Worker |
| [`apps/playground`](./apps/playground) | Báo giá phí, thanh toán, bảng tách phí và hoàn tiền bằng **key của bạn**, kèm code từng bước | React SDK | Worker proxy |

> [!WARNING]
> **Không có chế độ test.** Mọi thanh toán trong các ví dụ đều trừ tiền thẻ thật và chuyển tiền cho merchant sở hữu
> key đang dùng. Phí không được hoàn. Hãy dùng số tiền nhỏ (Loomgate tối thiểu $1.00 / €1.00, và số tiền phải lớn hơn phí nếu bạn chịu phí) và hoàn tiền từ merchant
> dashboard.

## Một lần thanh toán diễn ra thế nào

```
Trình duyệt                     Server của bạn                      Loomgate
───────────                     ──────────────                      ────────
giỏ hàng, địa chỉ       ──►  tính giá theo danh mục CỦA BẠN
                             paymentIntents.create(secret key) ──►  payment intent (lg_pi_…)
                        ◄──  client_secret (lg_cs_…)           ◄──
gắn form thẻ (publishable key + client secret)
confirm() khi bấm "Pay" ─────────────────────────────────────────►  trừ tiền thẻ
trang đơn hàng          ──►  paymentIntents.retrieve(id)       ──►  status: succeeded
```

- **Secret key** (`sk_live_…`) chỉ nằm trên server. **Publishable key** (`pk_live_…`) và client secret để ở trình
  duyệt được.
- Server quyết định số tiền. Trình duyệt chỉ cho biết trong giỏ có gì.
- `processing` chưa phải đã trả tiền. Chỉ giao hàng khi trạng thái là `succeeded`, tốt nhất là khi webhook endpoint
  của bạn nhận `payment_intent.succeeded` (tạo endpoint trong [merchant dashboard](https://app.loomgate.io/webhooks); xem
  [Thiết lập webhook](https://docs.loomgate.io/webhooks/webhook-endpoints)).

## Chạy một ví dụ

Cần Node.js 20.19 trở lên, [pnpm](https://pnpm.io), và key của một tài khoản merchant Loomgate (merchant dashboard →
[API key](https://app.loomgate.io/api-keys)). [Khởi động nhanh](https://docs.loomgate.io/getting-started/quickstart) giải thích key và thanh toán đầu tiên.

```bash
pnpm install
cd examples/react            # hoặc js, js-cdn, js-umd
cp .dev.vars.example .dev.vars
# điền key vào .dev.vars
pnpm dev
```

Mở URL in ra trong terminal. Mỗi app có cổng riêng nên chạy cùng lúc được: playground `5180`, `js` `5181`,
`react` `5182`, `js-cdn` `5183`, `js-umd` `5184`. README của từng ví dụ giải thích các file của nó.

### Deploy lên Cloudflare

```bash
pnpm exec wrangler secret put LOOMGATE_SECRET_KEY
pnpm exec wrangler secret put LOOMGATE_PUBLISHABLE_KEY
pnpm run deploy
```

### Không dùng Cloudflare?

Phần server của mỗi ví dụ là một app [Hono](https://hono.dev) nhỏ (`worker/index.ts`), chỉ dùng server SDK của
Loomgate và API chuẩn web. Nó chạy nguyên trên Node.js 18+, ví dụ với `@hono/node-server`:

```ts
import { serve } from '@hono/node-server';
import app from './worker/index';

serve({ fetch: (request) => app.fetch(request, process.env), port: 3000 });
```

Framework khác cũng làm tương tự: tạo payment intent bằng `createLoomgateServerClient(secretKey)` rồi trả
`client_secret` cho trang.

## Playground

Playground (`apps/playground`) cho dev thử API bằng key merchant của chính họ, theo từng bước:

1. **Tạo đơn**: sản phẩm, phí ship, thuế, giảm giá, người mua, địa chỉ giao hàng.
2. **Xem trước phí**: `POST /partner/v1/fee_quotes`, không trừ tiền.
3. **Thanh toán**: tạo payment intent, rồi trả bằng thẻ thật trong form thẻ của React SDK. Chọn một trong sáu
   layout (form thanh toán, ô ngang, form thẻ một hàng, ô thẻ rời, tóm tắt đơn + thanh toán, nền tối) và chỉnh trực
   tiếp giao diện form (chế độ màu, màu nhấn, bo góc, cỡ chữ) để thấy phần nào tuỳ biến được: trang và nút Pay thì
   tuỳ ý, kiểu form thẻ và tuỳ chọn bố cục, giao diện form thẻ qua `appearance` (`theme`, `variables`, `classes`),
   branding chỉ theo theme. Các tab code đổi theo lựa chọn. Chi tiết:
   [Tuỳ biến form thẻ](https://docs.loomgate.io/integrations/customize-card-form).
4. **Xem kết quả**: trạng thái, số tiền thẻ bị trừ, phí xử lý và phí ngân hàng, số tiền bạn nhận, và lịch tiền về.
5. **Hoàn tiền**: toàn bộ hoặc một phần số tiền còn hoàn được.

Mỗi bước có code tương ứng và JSON thô trao đổi với Loomgate.

> [!CAUTION]
> Trong playground, secret key được nhập trên trang và gửi kèm từng request tới server của playground. Server dùng
> key đó gọi Loomgate, không lưu và không ghi log. **Cách này chỉ chấp nhận được với một công cụ thử nghiệm.** Ở shop
> thật, secret key nằm trên server của bạn như trong `examples/*`. Thử xong hãy đổi (roll) key trong dashboard.

Key được giữ trong `sessionStorage` (mất khi đóng tab), hoặc trong `localStorage` nếu bạn chọn "Remember on this
device".

Muốn secret key không rời khỏi máy mình thì chạy playground ở local:

```bash
pnpm install
pnpm --filter loomgate-playground dev
```

Không cần `.dev.vars`. Server của playground chỉ chuyển tiếp một danh sách endpoint cố định (tạo và xem
`payment_intents` và `refunds`, `fee_quotes`) tới `https://api.loomgate.io`, giới hạn 60 request mỗi phút cho mỗi địa
chỉ IP, và từ chối body lớn hơn 64 KB.

## Trước khi chạy thật

- [ ] Số tiền do server tính, không bao giờ lấy từ trình duyệt.
- [ ] `order_reference` là mã đơn của bạn, và được dùng làm idempotency key khi tạo payment intent.
- [ ] Giao hàng theo webhook `payment_intent.succeeded` (kiểm chữ ký bằng `verifyWebhook` trong
      `@loompay/loomgate-js-sdk/server`, xem [Xác minh chữ ký](https://docs.loomgate.io/webhooks/verify-signatures)), không theo trang
      redirect.
- [ ] Branding element được gắn và hiển thị: thiếu nó thì form thẻ từ chối xác nhận.
- [ ] Chính sách quyền riêng tư có nói form thẻ thu thông tin thiết bị để chống gian lận (xem
      [README của JavaScript SDK](https://www.npmjs.com/package/@loompay/loomgate-js-sdk#device-information)).
- [ ] Nếu trang có Content Security Policy, cho phép các nguồn mà
      [README của SDK](https://www.npmjs.com/package/@loompay/loomgate-js-sdk#content-security-policy) liệt kê.
- [ ] Apple Pay và Google Pay: xác minh tên miền trong [merchant dashboard](https://app.loomgate.io/wallet-domains) (xem
      [Apple Pay và Google Pay](https://docs.loomgate.io/integrations/apple-pay-google-pay)).

## Phát triển repo này

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm lint      # Biome, và kiểm các file dùng chung giữa các ví dụ vẫn giống hệt nhau
pnpm build
```

Mỗi ví dụ tự đứng riêng được, nên một số file bị lặp lại (`worker/*`, `public/style.css`…). Sửa ở `examples/js`
trước rồi chép sang; `pnpm lint` báo lỗi khi các bản chép lệch nhau.

## Giấy phép

Các ví dụ dùng giấy phép [MIT](./LICENSE): cứ chép thoải mái. Các SDK Loomgate mà ví dụ dùng được phát hành trên npm
theo giấy phép riêng của chúng. Plugin WooCommerce đính kèm ở các release dùng giấy phép GPL-2.0-or-later, như WordPress.
