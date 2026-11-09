# Sky 私服 · 活动系统模块（0.34.5 实测）

> 从一套已跑通的 Sky 0.34.5 私服里抽出来的「活动系统」独立模块：
> **后台开关的活动怎么真正下发到客户端** + **594 个活动的中文名** + **复刻先祖怎么让客户端看见**。
>
> 纯 Node.js，零依赖，直接 `require` 就能用。

---

## 一、这个模块解决什么问题

Sky 私服里「活动」是最容易踩坑的部分。你可能遇到：

| 现象 | 真实原因 |
|---|---|
| 后台把活动开关打开了，游戏里**什么都没发生** | 下发的 `when` 用了**绝对时间戳**，而客户端要的是**相对 `base_time` 的秒偏移** —— 差 50 多年，永远不生效 |
| 改完活动，客户端还是**按旧的来** | 同名旧条目没删掉，客户端取到的是那条未激活的 |
| 复刻先祖在商店里能买，但游戏里**看不见先祖** | 只改了商店，没激活 `visiting_vendor_<先祖>` 事件 |
| 活动列表**全是英文 ID**，看不懂 | 594 个活动名都是内部 ID（`ap18_ritual_02`、`spiritshopitem_butterfly_03`…） |

这个模块把这四个问题都解掉了。

---

## 二、文件说明

```
activity-module-0.34.5/
├── README.md                       ← 本文
├── package.json
├── data/
│   ├── event_schedule_defs.json    ← 官方活动表（594 条，必须有）
│   ├── event_names.json            ← 中文名字典（118 条，可自己扩充）
│   └── spirit_names.json           ← 先祖中文名（102 个，用于"先祖商品/收藏品"命名）
├── src/
│   └── events.js                   ← 核心模块（排期生成 + 中文名）
└── examples/
    ├── server-wiring.js            ← 怎么接进你的 get_event_schedule 接口
    ├── admin-api.js                ← 后台接口：列表 / 开关 / 复刻先祖
    └── panel-ui.js                 ← 后台前端片段（搜索 + 勾选）
```

---

## 三、快速接入

### 1. 放进去

```bash
cp -r activity-module-0.34.5 your-server/src/events
```

### 2. 你的 `get_event_schedule` 接口改成：

```js
const events = require("./src/events/events.js");

const defs = events.loadDefs("./data/event_schedule_defs.json");
events.loadNameDict("./src/events/data/event_names.json");
events.loadSpiritNames("./src/events/data/spirit_names.json");   // 可选，但"先祖商品"类名字靠它

// 你后台存的开关（示例：从 LevelDB / JSON / 数据库读）
const enabled = readEnabledEvents();        // 例如 ["global_skyfest", "event_aurora"]
const traveling = readTravelingSpirit();    // 例如 { mode: true, names: ["chestpound"] }
const season = readSeason();                // 例如 "ap31"

const body = events.scheduleResponse(defs, { enabled, traveling, season });
res.end(JSON.stringify(body));
```

返回结构（客户端认这个）：

```json
{
  "event_schedule": {
    "server_time": 1794200000,
    "valid_until": 1794201800,
    "base_time": 1587366000,
    "events": [
      { "name": "global_skyfest", "duration": "43200", "when": [206692558, 209284558] }
    ]
  }
}
```

### 3. 后台列表（带中文名）

```js
const list = defs.map((e) => ({
  name: e.name,
  cn: events.cnOfEvent(e.name),
  duration: e.duration,
  enabled: enabled.includes(e.name),
}));
```

---

## 四、四个关键机制（务必看）

### 1. `when` 是**偏移量**，不是时间戳

```js
// 官方数据长这样（when 最大也就 2 亿，而 2026 年的时间戳是 17 亿）
{ "name": "skyfest2026_w1", "duration": "1439", "when": [195987600] }

// 换算成绝对时间 = base_time + when[0]
// 1587366000 + 195987600 = 1783353600  → 2026-07-06
```

所以后台开活动要这样写：

```js
const elapsed = now - 1587366000;
when: [elapsed, elapsed + 30 * 86400]
```

❌ 写成 `when: [Date.now()]` 会被客户端当成「56 年后」，等于永远不生效。

### 2. 必须删掉同名旧条目

```js
// 先把 events 里所有同名条目删掉，再 push 新的
for (let i = events.length - 1; i >= 0; i--) {
  if (names.has(events[i].name)) events.splice(i, 1);
}
```

不删的话，同一个 `name` 会出现两次，客户端取**第一条**（未激活的那条），看起来就像"开关没生效"。

### 3. `duration` 单位是**分钟**

```js
duration: String(Math.floor(30 * 86400 / 60))  // 30 天 = "43200"
```

传秒数会让活动瞬间过期。

### 4. 复刻先祖 = 商店 + 事件，两件事

商店那边只决定"能不能买"，客户端要**看见先祖**还需要事件：

```js
{ mode: true, names: ["chestpound"] }
// → 自动激活：
//   visiting_vendor_chestpound
//   visiting_vendor_questchestpound
```

---

## 五、中文名系统

三层翻译，594 个活动里 **591 个**能出纯中文（剩下 3 个含品牌名 `TGC`，故意保留）：

| 层级 | 例子 |
|---|---|
| **精确字典**（`event_names.json`，118 条） | `global_skyfest` → 天空节 |
| **结构规则** | `spiritshopitem_butterfly_03` → 先祖商品 · 蝴蝶 · 03 |
| **逐词词表**（300+ 词 + 数字规则） | `wildlifepark_cycle_overcast_night` → 野生动物园·阴天夜晚 |

数字规则示例：`ap18` → 第18季、`part3` → 第3段、`questap10` → 复刻任务10、`tcandles2` → 季蜡2。

### 想加/改名字

直接编辑 `data/event_names.json`：

```json
{
  "global_skyfest": "天空节",
  "aurora_concert": "极光·演唱会",
  "你的活动ID": "你要的中文"
}
```

字典优先级最高，改完重启即可。

---

## 六、后台功能示例

`examples/admin-api.js` 里有三个现成接口：

```
GET  /admin/api/events            活动列表（带中文名 + 开关状态）
POST /admin/api/events/toggle     { name, enabled }       开关单个活动
POST /admin/api/spirits/traveling { mode, names }         设置复刻先祖
```

`examples/panel-ui.js` 是配套的前端片段：搜索框（中文/ID 都能搜）+ 复选框列表。

---

## 七、活动数据长什么样

`data/event_schedule_defs.json`（594 条）：

```json
{
  "events": [
    { "name": "ap18_ritual_02", "duration": 1439, "when": [195987600] },
    { "name": "spiritshopitem_butterfly_03", "duration": 1439, "when": [195987600, 196070400] }
  ]
}
```

- `duration`：分钟
- `when`：相对 `base_time`（1587366000）的秒偏移，1 个或 2 个元素
  - 1 个：从该时刻开始，持续 `duration`
  - 2 个：`[开始, 结束]`

---

## 八、注意

- 这个模块只负责**活动排期 + 中文名**，不包含客户端补丁、账号系统、商店逻辑
- 活动数据来自 0.34.5 客户端资源，更新客户端版本后需重新提取
- 游戏资源版权归 thatgamecompany 所有，本项目仅供学习研究

---

## 九、许可

MIT。数据文件版权归原游戏所有。
