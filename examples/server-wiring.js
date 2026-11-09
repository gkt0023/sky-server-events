/**
 * server-wiring.js —— 把活动模块接进你的 HTTP 服务
 *
 * 假设你的服务里有个统一分发函数：
 *     handle(path, body, res, headers, method, query)
 *
 * 只需要在 `/account/get_event_schedule` 这个分支里调用 scheduleResponse()。
 */
"use strict";

const events = require("../src/events.js");

// 数据只加载一次（放模块顶层）
const DEFS = events.loadDefs(__dirname + "/../data/event_schedule_defs.json");
events.loadNameDict(__dirname + "/../data/event_names.json");

// ---------------------------------------------------------------------------
// 下面三个「读取后台配置」的函数按你的存储方式改（LevelDB / JSON / MySQL 都行）
// ---------------------------------------------------------------------------

/** 后台打开的活动，返回活动名或分组 key 数组，例如 ["global_skyfest","event_aurora"] */
function readEnabledEvents() {
  // 示例：从 LevelDB 读一个 key
  // const raw = store.getString("event_flags2");
  // const flags = raw ? JSON.parse(raw) : {};
  // return Object.keys(flags).filter((k) => flags[k]);
  return [];
}

/** 复刻先祖，例如 { mode: true, names: ["chestpound"] } */
function readTravelingSpirit() {
  // const raw = store.getString("traveling_spirits");
  // return raw ? JSON.parse(raw) : { mode: false, names: [] };
  return { mode: false, names: [] };
}

/** 当前季节，例如 "ap31"（没有就 "none"） */
function readSeason() {
  // const raw = store.getString("admin_season");
  // return raw ? (JSON.parse(raw).season_id || "none") : "none";
  return "none";
}

// ---------------------------------------------------------------------------
// 接口实现
// ---------------------------------------------------------------------------

/**
 * POST /account/get_event_schedule
 * 客户端每次进图/切图都会拉这个表。
 */
function handleGetEventSchedule(body, res) {
  const now = Math.floor(Date.now() / 1000);

  const payload = events.scheduleResponse(DEFS, {
    now: now,
    enabled: readEnabledEvents(),
    traveling: readTravelingSpirit(),
    season: readSeason(),
  });

  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

/**
 * GET /admin/api/events —— 后台列表（带中文名）
 */
function handleAdminEventList(res) {
  const enabled = readEnabledEvents();
  const list = DEFS.map((e) => ({
    name: e.name,
    cn: events.cnOfEvent(e.name),
    duration: e.duration,
    enabled: enabled.indexOf(e.name) >= 0,
  }));
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ ok: true, total: list.length, events: list }));
}

module.exports = { handleGetEventSchedule, handleAdminEventList, DEFS };
