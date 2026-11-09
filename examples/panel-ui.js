/**
 * panel-ui.js —— 后台前端片段（原生 JS，无框架）
 *
 * 用法：放进你的后台页面，调用 renderEvents(list) 即可。
 * 特点：中文名 + 原始 ID 同时显示，搜索中文或 ID 都能命中。
 */
"use strict";

/**
 * @param {Array} list [{name, cn, duration, enabled}]
 * @param {string} keyword 搜索词（中文/ID 都行）
 * @returns {string} HTML
 */
function renderEventRows(list, keyword) {
  const kw = String(keyword || "").toLowerCase();
  const rows = list.filter(
    (e) =>
      !kw ||
      String(e.name).toLowerCase().indexOf(kw) >= 0 ||
      String(e.cn || "").indexOf(kw) >= 0
  );

  if (!rows.length) return '<div class="muted">没有匹配的活动</div>';

  return rows
    .slice(0, 300)
    .map(
      (e) => `
      <label class="row" style="align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #1b2434">
        <input type="checkbox" ${e.enabled ? "checked" : ""}
               onchange="toggleEvent('${escapeHtml(e.name)}', this.checked)">
        <b style="flex:1">${escapeHtml(e.cn || e.name)}</b>
        <span class="mono muted">${escapeHtml(e.name)}</span>
      </label>`
    )
    .join("");
}

/** 勾选开关 */
function toggleEvent(name, enabled) {
  fetch("/admin/api/events/toggle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name, enabled: enabled }),
  })
    .then((r) => r.json())
    .then((d) => {
      if (d.ok) {
        console.log("[活动] " + name + " -> " + (d.enabled ? "开" : "关"));
        if (d.expanded && d.expanded.length > 1) {
          console.log("  展开为: " + d.expanded.map((x) => x.cn).join("、"));
        }
      }
    });
}

/** 复刻先祖下拉（names 来自 spirit_shop_defs.json 的 spirit 字段） */
function renderTravelingSpirit(names, current) {
  return (
    '<select id="travSpirit">' +
    names
      .map(
        (n) =>
          `<option value="${escapeHtml(n)}"${
            current === n ? " selected" : ""
          }>${escapeHtml(n)}</option>`
      )
      .join("") +
    "</select>"
  );
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

if (typeof window !== "undefined") {
  window.renderEventRows = renderEventRows;
  window.toggleEvent = toggleEvent;
  window.renderTravelingSpirit = renderTravelingSpirit;
}

module.exports = { renderEventRows, toggleEvent, renderTravelingSpirit };
