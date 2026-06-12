# Changelog

## [1.1.0] - 2026-06-12

### UI/UX 重設計 — 深色工程儀表板(instrument dark)

整站改為唯一深色主題,定位為工程師的評測儀器。功能邏輯(API、SSE 進度串流、實驗流程)無任何變更。

#### 變更
- **設計 tokens**:石墨深色底(`oklch(0.16 0.01 250)`)、signal green 主操作色(`oklch(0.75 0.17 150)`)、髮絲線邊框、`color-scheme: dark`
- **指標色**:徹底移除紫色——recall 青 / precision 藍 / faithfulness 綠 / correctness 琥珀,雷達圖色盤同步更新
- **字體**:DM Sans 改為 IBM Plex Sans + JetBrains Mono;所有數值(指標、延遲 ms、行號)一律等寬 + `tabular-nums`
- **首頁**:行銷式版面改為工具列 header(等寬字標 + health 狀態)+ 4 格儀表數字行;實驗列表從卡片格改為高密度表格(髮絲線分隔、無 striping、整列 hover)
- **實驗詳情**:最佳組合改為 5 格儀表數字行(各指標用其專屬色);總覽表格最佳值以 primary tint 標示;SSE 進度 log 改終端機質感(深一階底色、等寬、行號 gutter)
- **狀態徽章**:lucide icon 徽章改為小型 tinted pill(圓點指示,執行中琥珀 pulse)
- **細節**:移除卡片陰影、emoji 與標題 icon;圖表 grid / tooltip 配合深色主題
