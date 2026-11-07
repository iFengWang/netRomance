# 心遇 · 多人视频相亲 Web 应用

心遇是依据 `doc/网络版相亲策划.ppt` 重构的现代 Web 应用。它保留了策划中的核心形式：一名主持人组织 4 或 6 位嘉宾的视频相亲，嘉宾依次经历「初次心动」「深入了解」「双向奔赴」三个环节，双方互选后生成牵手记录。

## 已实现功能

- 相遇大厅：按城市、主题和关键词筛选房间，可创建自定义房间
- 注册与登录：密码使用 `scrypt` 加盐保存，Session 使用 HttpOnly Cookie
- 个人资料：昵称、年龄、城市、职业、兴趣、自我介绍和最多 3 张压缩照片
- 多人音视频：参考本机 `df.im` 工程的 Mesh WebRTC 架构，每位参与者之间建立独立连接；支持 Trickle ICE、ICE 候选缓存、失败后 ICE Restart、480p/24fps 优先与 800kbps 视频上限
- 专场与人数：男生专场支持 `1 男 3 女` / `1 男 5 女`，女生专场支持 `1 女 3 男` / `1 女 5 男`
- 电视墙房间：6 人使用「1 大 5 小」，4 人使用「2 × 2」；标题、主持人、环节和快捷按钮收纳在单行顶栏，聊天室默认隐藏，可切换全屏
- 邀请入场：点击顶栏二维码图标生成房间二维码与局域网可访问链接，支持手机扫码或复制链接
- 实时房间：成员心跳、文字聊天、音视频状态、个人资料查看；心动灯仅显示在配角性别席位，并仅允许本人或异性切换
- 主持人流程：点击主持人头像打开专属控制菜单，可控制自己的麦克风、推进三轮、公布结果、重开下一场，并可一键开关全部嘉宾的麦克风或视频
- 双向选择：选择只对本人可见，公布后仅互选成功的双方生成牵手记录
- 房间治理：每个嘉宾窗格公开显示资料、心动灯、麦克风和视频状态；本人及主持人可控制音视频，主持人还可禁言、恢复、移出并拉黑；嘉宾可举报不当行为
- 响应式设计：桌面、平板和手机均有独立布局；手机端使用底部导航
- 数据持久化：本地 Docker 使用 PostgreSQL；Cloudflare 生产环境使用 D1，均保存用户、房间、成员、消息、信令、选择、配对、举报和封禁

## 技术架构

- Next.js 16 App Router、React 19、TypeScript
- PostgreSQL 16（本地与 Docker）/ Cloudflare D1（生产）
- 浏览器原生 WebRTC，HTTP 轮询承载信令和房间状态
- Docker Compose 本地部署；Cloudflare Workers + D1 公网部署

WebRTC 本身不规定信令协议，本项目由 Next.js API 保存短时 SDP/ICE 信令。小房间采用 Mesh 拓扑，适合策划要求的 4–6 人场景。公网部署建议配置独立 TURN 服务；单靠 STUN 无法覆盖所有企业网络、对称 NAT 和受限移动网络。

## 一键启动

需要 Docker Desktop 或兼容的 Docker Engine。项目会从 3210 开始自动寻找空闲端口，并生成随机数据库密码：

```bash
npm run deploy
```

完成后，终端会打印访问地址，例如：

```text
http://localhost:3210
局域网访问: http://192.168.x.x:3210
```

Docker 会将 Web 端口显式绑定到 `0.0.0.0`，因此同一 Wi-Fi / 有线局域网内的其他电脑或手机可以使用部署终端打印的局域网地址访问。请确保设备处于同一网段，并允许 Docker Desktop 或系统防火墙接收入站连接。

当前机器的局域网地址为 `http://192.168.3.4:3210`。IP 地址可能会在路由器重新分配后变化，重新执行 `npm run deploy` 即可打印最新地址。

查看状态和日志：

```bash
docker compose ps
docker compose logs -f web
```

停止服务（保留 PostgreSQL 数据卷）：

```bash
docker compose down
```

如需同时删除数据库数据，应先确认不再需要现有账号、房间和牵手记录，再手动执行 `docker compose down -v`。

## 公网发布与 TURN

摄像头和麦克风只允许在 HTTPS 或 `localhost` 安全上下文中使用。通过 `http://192.168.x.x` 访问时可以浏览和使用文字功能，但大多数浏览器不会开放摄像头、麦克风和完整 WebRTC 能力。需要在局域网其他设备使用音视频时，也应配置受信任的 HTTPS 反向代理；公网发布同样必须配置 HTTPS，并在 `.env` 中设置：

```dotenv
COOKIE_SECURE=true
TURN_URL=turn:turn.example.com:3478?transport=udp,turn:turn.example.com:3478?transport=tcp
TURN_USERNAME=your-turn-user
TURN_CREDENTIAL=your-turn-password
```

更新配置后执行：

```bash
docker compose up -d --build
```

## Cloudflare Workers 部署

项目已通过 vinext 兼容性检查，并保留原有 Next.js/Docker + PostgreSQL 本地开发方式。生产环境使用 Cloudflare D1，Worker 配置位于 `cloudflare.config.ts`，默认绑定自定义域名 `love.ifeng-wang.com`，启用安全 Cookie，并把邀请链接固定为 HTTPS 域名。

生产数据库 `netromance-db` 位于 Cloudflare D1，初始结构和六个示例房间由 `migrations/0001_init.sql` 管理。首次部署或新增迁移时执行：

```bash
npx wrangler login
npm run db:d1:migrate
npm run build:vinext
npm run deploy:vinext
```

D1 免费方案的当前额度为每日读取 500 万行、写入 10 万行、账户总存储 5GB；超出免费日限额后查询会暂停到下一个 UTC 日，而不会自动产生费用。公网 WebRTC 仍建议配置 TURN 服务。

TURN 凭据会通过 `/api/ice` 发送给已登录用户。生产环境建议使用短时 TURN 凭据，并在反向代理层增加访问日志、WAF 和速率限制。

## 本地开发

Docker 方式最简单。若要直接运行 Next.js，需要准备一个 PostgreSQL 数据库：

```bash
cp .env.example .env
# 在 .env 中补充 DATABASE_URL
npm install
npm run db:init
npm run dev
```

开发服务器固定使用 `http://localhost:3210`。数据库结构在 `scripts/schema.sql`，初始化脚本可重复执行，不会覆盖已有数据。

## 校验命令

```bash
npm run typecheck
npm test
npm run build
```

容器启动后可检查：

```bash
curl http://localhost:3210/api/health
```

## 关键设计决策

- 每间房由 1 名主持人和 4/6 位嘉宾组成，Mesh 连接上限与策划中的小型相亲房间匹配。更大规模应切换到 SFU（如 LiveKit、Janus 或 mediasoup）。
- 心跳超过 45 秒即视为离线，离开的用户会在下一次加入时建立全新的信令会话。
- 信令只保留 2 分钟；聊天历史最多加载最近 100 条，避免轮询响应无限增长。
- 相册在浏览器内缩放到最长边 800px 并压缩；本地存入 PostgreSQL，生产存入 D1。生产规模扩大后应迁移到 R2 等对象存储。
- 房间状态采用约 1.1 秒轮询，部署简单、可直接运行于 Next.js。用户规模扩大后可替换为 WebSocket 或专用实时服务。
- 主持人进入房间时会请求麦克风权限并默认保持摄像头关闭；嘉宾的音视频均由本人开启。应用不会录制音视频。
- 主持人的「全部开启」会向嘉宾浏览器发送设备开启请求；若该设备尚未授权，浏览器仍会要求嘉宾本人确认摄像头或麦克风权限。

## 目录说明

```text
app/                 Next.js 页面与 API 路由
components/          大厅、资料、房间、登录和通用 UI
lib/api.ts           服务端业务规则、鉴权与数据库操作
lib/rtc.ts           WebRTC Mesh 连接与信令处理
scripts/schema.sql   PostgreSQL 数据结构
scripts/init-db.mjs  幂等数据库初始化与默认房间
migrations/          Cloudflare D1 生产数据库迁移
lib/db.d1.ts         D1 查询与 PostgreSQL 兼容适配层
scripts/wrangler.d1.jsonc  D1 迁移专用 Wrangler 配置
scripts/deploy.mjs   空闲端口检测、密码生成和 Docker 部署
design/concept.png   视觉概念稿
public/images/       生成并优化后的页面图片资产
```

## 策划书映射

原策划中的「房间主持人、1 男 N 女 / 1 女 N 男、1 大 5 小 / 2 × 2 电视墙、爱之初体验、爱之再判断、爱之终抉择、心动选择、牵手成功、资料与相册、身份和内容风险」均有对应实现。旧策划涉及的收费房间、短信支付和外部平台接入未纳入本地 MVP，因为需要支付商户、短信和第三方开放平台凭据。
