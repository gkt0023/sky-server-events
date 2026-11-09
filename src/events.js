/**
 * events.js —— Sky 私服「活动系统」独立模块（0.34.5 实测可用）
 *
 * 解决三件事：
 *   1. 后台开关的活动，怎么真正下发给客户端（`when` 是相对 base_time 的**秒偏移**）
 *   2. 594 个活动的**中文名**（字典 + 规则 + 词表三层）
 *   3. 复刻先祖要让客户端看见，必须同时激活 `visiting_vendor_<先祖>` 事件
 *
 * 不依赖任何第三方库，可直接复制到你自己的 Node 服务里。
 */
"use strict";

const fs = require("fs");
const path = require("path");

/** 官方抓包确认的基准时间：2020-04-20 07:00:00 UTC */
const BASE_TIME = 1587366000;

/** 一次开启的有效窗口（秒）。30 天足够长，避免玩家玩到一半活动过期。 */
const WINDOW_SEC = 30 * 86400;

/**
 * 后台「分组开关」→ 实际下发的活动名。
 * 面板上按人话分组（"天空节"），实际一个分组往往对应好几个底层事件。
 */
const EVENT_MAP = {
  event_feast: ["global_feast_wonderland", "feast_toyvendorforever", "feast_teatable_rotation"],
  event_mischief: ["global_skyfest"],
  event_fortune: ["global_newyear_firework_interval", "global_rosegarden_forever"],
  event_bloom: ["global_flowflowerjourney_evergreen", "global_flowflowerpack_launch"],
  event_anniversary: ["global_sky_anniversary", "global_ann_perf1", "global_ann_perf12"],
  event_qixi: ["global_qixi_couple"],
  event_summer: ["global_summer", "global_ball_beach"],
  event_skyfest: ["global_skyfest", "skyfest_fireworks_show", "skyfest_parade"],
  event_wildlife: ["global_nature_geyser", "wildlifepark_cycle_day"],
  event_fireworks: ["fireworks_show_act1", "fireworks_show_medpad"],
  event_double_candles: ["wing_buff_conversion_period"],
  event_night: ["stormy_night", "event_night_tcandles1"],
  event_dusk: ["stormy_dusk", "event_dusk_tcandles3"],
  event_prairie: ["stormy_prairie", "event_prairie_tcandles2"],
  event_aurora: ["global_aurora", "aurora_concert", "aurora_orbit"],
  event_office: ["global_office_shop", "tgcoffice_behavior_employees"],
  event_weekend_shop: ["global_weekend_shop", "global_weekend_shop2"],
  event_dye_shop: ["enable_dye_shop", "weekly_dye_rotation_02"],
  event_magic_shop: ["sunset_village_spell_shop"],
  event_merch: ["global_merchandise_live"],
  event_music_shop: ["global_musicshop_sale", "musicshop_weekly_rotation_02"],
  event_cafe: ["global_cafe_open", "quest_cafe_serving"],
  event_hub_clocktower: ["hub_clocktower"],
  event_colosseum_fw: ["sunset_colosseum_firework_interval"],
  event_yeti: ["quest_sunset_yeti_race"],
  event_fishing: ["sunset_village_fishing"],
  event_armoire: ["collectible_armoire1", "collectible_armoire2"],
  event_turtle: ["social_turtle_on"],
  event_wax: ["social_wax_on"],
};

// ---------------------------------------------------------------------------
// 中文名
// ---------------------------------------------------------------------------

/** 精确字典（名称 → 中文），可由同目录的 event_names.json 覆盖/扩充 */
let EVENT_CN = {};
function loadNameDict(file) {
  try {
    EVENT_CN = JSON.parse(fs.readFileSync(file, "utf8")) || {};
  } catch (e) {
    EVENT_CN = {};
  }
  return EVENT_CN;
}

/** 词表：把 `wildlifepark_cycle_overcast_night` 这种逐词翻成中文 */
const EV_TOKEN = {
  global: "全局", quest: "任务", questap: "任务季", spiritshopitem: "先祖商品",
  collectible: "收藏品", visiting: "来访", vendor: "商人", miniquest: "小任务",
  aurora: "极光", skyfest: "天空节", feast: "宴会", sunset: "落日", social: "社交",
  stormy: "暴风", wildlifepark: "野生动物园", season: "季节", event: "活动",
  mainstreet: "主街", dusk: "黄昏", night: "夜晚", prairie: "草原", rain: "雨林",
  valley: "山谷", vault: "禁阁", wasteland: "荒野", forest: "森林", isle: "孤岛",
  radiant: "黑暗石", darkstone: "黑暗石", spawn: "出现", despawn: "消失",
  enable: "启用", warning: "预警", gen: "通用", shop: "商店", reset: "重置",
  daily: "每日", weekly: "每周", monthly: "每月", yearly: "每年",
  concert: "演唱会", countdown: "倒计时", wrap: "收尾", minigame: "小游戏",
  vote: "投票", rotation: "轮换", orbit: "星轨", queendom: "极光王国",
  runaway: "逃离", softinside: "柔软内心", warrior: "战士", theseed: "种子",
  eyesofachild: "童真之眼", exhaleinhale: "呼吸律动", soundbath: "音浴",
  session: "场次", gallerydawn: "画展·晨岛", oreo: "奥利奥", parade: "巡游",
  fireworks: "烟花", show: "表演", act1: "第一幕", medpad: "医疗台",
  wonderland: "幻境", teatable: "茶桌", toyvendor: "玩具商", crabbit: "蟹兔",
  catch: "抓取", cycle: "昼夜", day: "白天", morning: "清晨", overcast: "阴天",
  not: "非", hint: "提示", embersanctuary: "余烬圣所", spitroastpassive: "篝火",
  eelwatercreature: "水鳗", feed: "投喂", prompt: "提示", birthday: "生日",
  party: "派对", casual: "休闲", cafe: "咖啡馆", grand: "盛大", entrance: "入场",
  cozycave: "温暖洞穴", bonfirecamp: "篝火营地", skyway: "天路", speedtube: "滑管",
  labyrinth: "迷宫", turtle: "海龟", wax: "蜡烛", on: "开启", tcandle: "季蜡",
  tcandles: "季蜡", master: "主控", ann: "周年", perf: "演出", ball: "舞会",
  beach: "海滩", open: "开业", flowflowerjourney: "流花之旅", evergreen: "常驻",
  flowflowerpack: "流花礼包", launch: "上线", merchandise: "周边", live: "上线",
  musicshop: "音乐商店", sale: "特卖", nature: "自然", geyser: "喷泉",
  newyear: "新年", interval: "间隔", office: "办公室", pc: "PC", qixi: "七夕",
  couple: "双人", rosegarden: "玫瑰园", forever: "常驻", anniversary: "周年",
  summer: "夏日", transcendent: "超凡", traveler: "旅人", violin: "小提琴",
  weekend: "周末", wing: "光翼", none: "关闭", deersummon: "召唤鹿",
  ch4: "第4章", end: "结束", start: "开场", spell: "魔法", colosseum: "竞技场",
  firework: "烟花", yeti: "雪人", fishing: "钓鱼", village: "村", house: "房屋",
  w1: "第1周", w2: "第2周", ritual: "仪式", fetch: "搜集",
  timer: "计时器", ap: "季", audience: "观众", lobby: "大厅",
  video: "视频", thankyou: "致谢", revolvingdance: "旋转舞", cuteclap: "可爱鼓掌",
  secret: "秘密", whisper: "耳语", armoire1: "衣柜 1", armoire2: "衣柜 2",
  armwave: "挥手", bask: "晒太阳", cape: "斗篷", cheer: "欢呼", dance: "跳舞",
  emote: "表情", flower: "花", gift: "礼物", heart: "爱心",
  juggle: "杂耍", kite: "风筝", laugh: "大笑", light: "光", manta: "蝠鲼",
  music: "音乐", notes: "音符", plant: "种植", pray: "祈祷",
  rocket: "火箭", sail: "航行", scare: "吓人", sing: "唱歌", sit: "坐下",
  sleep: "睡觉", snow: "雪", sparkle: "闪光", star: "星星", swim: "游泳",
  tea: "茶", twirl: "旋转", umbrella: "雨伞", wave: "挥手", whale: "鲸鱼",
  B: "B", ap06unlock: "第6季解锁", basecamp: "营地",
  beachday1: "海滩日1", beachday2: "海滩日2", behavior: "行为", bells: "铃铛",
  boat: "船", buff: "加成", challenge: "挑战", cloudcollect: "云收集", coin: "硬币",
  competition: "比赛", cough: "咳嗽", draw: "画画", duetbow: "双人鞠躬", duo: "双人",
  ember: "余烬", employees: "员工", ep: "篇章", fairyring: "仙女环",
  fertilizer: "肥料", flyrace: "飞行赛", frustration: "沮丧", guard: "护卫",
  hub: "枢纽", ip: "联动", lighthorn: "光角", manatee: "海牛",
  miniHouse: "小房屋", miniShop: "小商店", miniSocial: "小社交",
  onboarding: "新手引导", painting: "画作", patrol: "巡逻",
  personality: "性格", projector: "投影", prop: "道具", rail: "轨道",
  random: "随机", reading: "阅读", raisetheroof: "举手欢呼",
  rhythmicclap: "节奏鼓掌", rockcollection1: "石头收集1", sanctuary: "圣所",
  scavenger: "拾荒", serving: "服务", sidequest: "支线", sky: "天空",
  sliderace: "滑行赛", slowwalk: "慢走", speedskate: "滑冰", spirit: "先祖",
  started: "曾开启", survey: "问卷", te: "特别", tgc: "TGC",
  tgcoffice: "TGC办公室", time: "时间", travis: "崔维斯", vince: "文斯",
  voidcollect: "虚空收集", quiz: "问答", race: "竞速",
  shop2: "商店2", perf1: "演出1", perf12: "演出12",
  dawn: "晨岛", elder: "长老", force: "强制", snake: "蛇", dye: "染料",
  clocktower: "钟楼", unlock: "解锁", journey: "旅程", sand: "沙",
  snowball: "雪球", jellyfish: "水母", lantern: "灯笼", mask: "面具",
  ocean: "海洋", petal: "花瓣", puzzle: "谜题", raft: "木筏",
  shell: "贝壳", ship: "船", shooting: "流星", skate: "滑冰",
  sled: "雪橇", slide: "滑梯", stage: "舞台", statue: "雕像",
  bucket: "水桶", castle: "城堡", chair: "椅子", crab: "螃蟹",
  wing_buff: "光翼加成", conversion: "转换", period: "周期",
};

/** 带数字的 token 用规则翻译：ap18 → 第18季，part3 → 第3段 */
function trToken(t) {
  if (!t) return "";
  if (EV_TOKEN[t]) return EV_TOKEN[t];
  let m;
  if ((m = /^ap(\d+)$/.exec(t))) return "第" + m[1] + "季";
  if ((m = /^questap(\d+)manatee$/.exec(t))) return "复刻任务" + m[1] + "·海牛";
  if ((m = /^questap(\d+)$/.exec(t))) return "复刻任务" + m[1];
  if ((m = /^part(\d+)$/.exec(t))) return "第" + m[1] + "段";
  if ((m = /^perf(\d+)$/.exec(t))) return "演出" + m[1];
  if ((m = /^skyfest(\d+)$/.exec(t))) return "天空节" + m[1];
  if ((m = /^vortex(\d+)$/.exec(t))) return "漩涡" + m[1];
  if ((m = /^tcandles?(\d*)$/.exec(t))) return "季蜡" + (m[1] || "");
  if ((m = /^w(\d+)$/.exec(t))) return "第" + m[1] + "周";
  if ((m = /^beachday(\d+)$/.exec(t))) return "海滩日" + m[1];
  if ((m = /^rockcollection(\d+)$/.exec(t))) return "石头收集" + m[1];
  if ((m = /^p(\d+)$/.exec(t))) return "第" + m[1] + "阶段";
  if ((m = /^shop(\d+)$/.exec(t))) return "商店" + m[1];
  if ((m = /^ep(\d+)$/.exec(t))) return "第" + m[1] + "章";
  return t;
}

/** 先祖内部名 → 中文（102 个，来自 spirit_names.json） */
let SPIRIT_CN = {};
function loadSpiritNames(file) {
  try {
    SPIRIT_CN = JSON.parse(fs.readFileSync(file, "utf8")) || {};
  } catch (e) {
    SPIRIT_CN = {};
  }
  return SPIRIT_CN;
}

/** 查先祖中文名：`butterfly`、`butterfly_03`、`questap10` 都能兜一下 */
function spiritName(t) {
  if (!t) return "";
  const key = String(t);
  if (SPIRIT_CN[key]) return SPIRIT_CN[key];
  const base = key.replace(/_\d+$/, "");
  if (SPIRIT_CN[base]) return SPIRIT_CN[base];
  return "";
}

/** 逐词翻译整串（snake_case） */
function cnTokens(str) {
  if (!str) return "";
  return String(str)
    .split("_")
    .filter(Boolean)
    .map((t) => (/^\d+$/.test(t) ? t : trToken(t)))
    .join("·");
}

/**
 * 活动名 → 中文。三层：精确字典 → 结构规则 → 逐词词表。
 * 594 个活动里 591 个能出纯中文（剩下 3 个含品牌名 TGC）。
 */
function cnOfEvent(name) {
  if (!name) return "";
  if (EVENT_CN[name]) return EVENT_CN[name];

  let m;
  m = /^spiritshopitem_(.+)_(\d+)$/.exec(name);
  if (m) return "先祖商品 · " + (spiritName(m[1]) || cnTokens(m[1])) + " · " + m[2];

  m = /^collectible_(.+)$/.exec(name);
  if (m) return "收藏品 · " + (spiritName(m[1]) || cnTokens(m[1]));

  m = /^visiting_vendor_(.+)$/.exec(name);
  if (m) return "来访先祖 · " + (spiritName(m[1]) || cnTokens(m[1]));

  m = /^quest_(.+)$/.exec(name);
  if (m) return "任务 · " + cnTokens(m[1].replace(/^ap(\d+)/i, "第$1季"));

  m = /^quest(.+)$/.exec(name);
  if (m) return "任务 · " + cnTokens(m[1].replace(/^_?ap(\d+)/i, "第$1季"));

  m = /^ap(\d+)_(.+)$/.exec(name);
  if (m) return "第" + m[1] + "季 · " + cnTokens(m[2]);

  return cnTokens(name);
}

// ---------------------------------------------------------------------------
// 排期生成
// ---------------------------------------------------------------------------

/** 读取官方活动表（594 条），返回数组 */
function loadDefs(file) {
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  return d.events || [];
}

/**
 * 生成下发给客户端的活动表。
 *
 * @param {object[]} defs     官方活动定义（loadDefs 的返回值）
 * @param {object}   opts
 * @param {string[]} opts.enabled     后台打开的活动/分组 key
 * @param {number}   opts.now         当前时间戳（秒），默认 Date.now()/1000
 * @param {object}   [opts.traveling] {mode:boolean, names:string[]} 复刻先祖
 * @param {string}   [opts.season]    季节号，如 "ap31"（用于季节相关事件）
 * @returns {object[]} events，每项 { name, duration, when:[start,end] }
 */
function buildSchedule(defs, opts) {
  const o = opts || {};
  const now = Number(o.now) || Math.floor(Date.now() / 1000);
  const elapsed = now - BASE_TIME;
  const enabled = Array.isArray(o.enabled) ? o.enabled : [];

  // 1) 官方原始表：duration 统一成字符串
  const events = (defs || []).map((ev) => {
    const e = Object.assign({}, ev);
    if (typeof e.duration === "number") e.duration = String(e.duration);
    return e;
  });

  // 2) 后台开关：分组展开成真实事件名
  const names = new Set();
  for (const key of enabled) {
    if (EVENT_MAP[key]) EVENT_MAP[key].forEach((n) => names.add(n));
    else names.add(key);
  }

  // 3) 复刻先祖：必须同时激活 visiting_vendor_<先祖>，客户端才会显示复刻先祖
  const traveling = o.traveling || {};
  if (traveling.mode && Array.isArray(traveling.names)) {
    for (const sp of traveling.names) {
      if (!sp) continue;
      names.add("visiting_vendor_" + sp);
      names.add("visiting_vendor_quest" + sp);
    }
  }

  // 4) 季节：让 apNN_* / season_NN_* 相关事件生效
  const season = String(o.season || "").toLowerCase();
  if (season && season !== "none") {
    const num = season.replace(/[^0-9]/g, "");
    if (num) {
      for (const e of events) {
        const n = String(e.name || "").toLowerCase();
        if (n.includes("ap" + num) || n.includes("season_" + num)) {
          names.add(e.name);
        }
      }
    }
  }

  if (!names.size) return events;

  // 5) 关键：先删掉同名旧条目，否则客户端会用到那条**未激活**的
  for (let i = events.length - 1; i >= 0; i--) {
    if (names.has(events[i].name)) events.splice(i, 1);
  }

  // 6) 关键：when 是「相对 base_time 的秒偏移」，不是绝对时间戳
  names.forEach((n) => {
    events.push({
      name: n,
      duration: String(Math.floor(WINDOW_SEC / 60)), // 分钟
      when: [elapsed, elapsed + WINDOW_SEC],
    });
  });

  return events;
}

/** 组装成 /account/get_event_schedule 的完整响应体 */
function scheduleResponse(defs, opts) {
  const o = opts || {};
  const now = Number(o.now) || Math.floor(Date.now() / 1000);
  return {
    event_schedule: {
      server_time: now,
      valid_until: now + 1800,
      base_time: BASE_TIME,
      events: buildSchedule(defs, o),
    },
  };
}

module.exports = {
  BASE_TIME,
  WINDOW_SEC,
  EVENT_MAP,
  EV_TOKEN,
  loadDefs,
  loadNameDict,
  loadSpiritNames,
  spiritName,
  cnOfEvent,
  cnTokens,
  trToken,
  buildSchedule,
  scheduleResponse,
};
