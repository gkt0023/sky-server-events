/**
 * admin-api.js —— 后台接口参考实现
 *
 * 三个接口：
 *   GET  /admin/api/events             活动列表（中文名 + 开关状态）
 *   POST /admin/api/events/toggle      { name, enabled }       开/关一个活动
 *   POST /admin/api/spirits/traveling  { mode, names }         设置复刻先祖
 *
 * 存储用你项目现成的（这里用 global 变量示意，换成 LevelDB/DB 即可）。
 */
"use strict";

const events = require("../src/events.js");
const DEFS = events.loadDefs(__dirname + "/../data/event_schedule_defs.json");
events.loadNameDict(__dirname + "/../data/event_names.json");

// ---- 存储占位（换成你自己的持久化） --------------------------------------
const store = {
  flags: {},                 // { 活动名或分组key: true }
  traveling: { mode: false, names: [] },
  save() {},
};
// --------------------------------------------------------------------------

function json(res, obj) {
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

/**
 * GET /admin/api/events
 */
function listEvents(req, res) {
  const enabled = Object.keys(store.flags).filter((k) => store.flags[k]);
  const list = DEFS.map((e) => ({
    name: e.name,
    cn: events.cnOfEvent(e.name),
    duration: e.duration,
    enabled: enabled.indexOf(e.name) >= 0,
  }));
  json(res, {
    ok: true,
    total: list.length,
    enabledCount: list.filter((x) => x.enabled).length,
    events: list,
  });
}

/**
 * POST /admin/api/events/toggle  { name, enabled }
 * 注意：name 可以是单个活动名（global_skyfest），也可以是分组 key（event_aurora）
 */
function toggleEvent(req, res) {
  const body = req.body || {};
  const name = String(body.name || "").trim();
  if (!name) return json(res, { ok: false, msg: "缺少 name" });

  store.flags[name] = !!body.enabled;
  store.save();
  console.log("[events] " + name + " -> " + (store.flags[name] ? "开" : "关"));

  // 打开分组时，把展开后的真实事件名也回给前端看
  const expanded = events.EVENT_MAP[name] || [name];
  json(res, {
    ok: true,
    name: name,
    enabled: store.flags[name],
    expanded: expanded.map((n) => ({ name: n, cn: events.cnOfEvent(n) })),
  });
}

/**
 * POST /admin/api/spirits/traveling  { mode: true, names: ["chestpound"] }
 *   names 用先祖内部名（配合 spirit_shop_defs.json 里的 spirit 字段）
 */
function setTravelingSpirit(req, res) {
  const body = req.body || {};
  const mode = !!body.mode;
  const names = Array.isArray(body.names) ? body.names.filter(Boolean) : [];
  store.traveling = { mode: mode, names: names };
  store.save();

  // 提示：这两个事件会被自动激活
  const vendorEvents = [];
  for (const sp of names) {
    vendorEvents.push("visiting_vendor_" + sp);
    vendorEvents.push("visiting_vendor_quest" + sp);
  }
  console.log("[events] 复刻先祖 -> " + (mode ? names.join(",") : "关"));

  json(res, {
    ok: true,
    mode: mode,
    names: names,
    autoEvents: vendorEvents,
  });
}

module.exports = { listEvents, toggleEvent, setTravelingSpirit };
