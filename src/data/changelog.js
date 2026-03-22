export const CURRENT_VERSION = 'v1.07';

// 约定：后续每次有用户可感知的功能 / 修复 / UI 变化时，提交前同步追加一条。
// 保持倒序、简短、面向用户可理解。
export const CHANGELOG_ENTRIES = Object.freeze([
    { time: '2026-03-23 01:33', version: 'v1.07', summary: '世界书微调新增 planner 阶段与模块拆分。' },
    { time: '2026-03-23 01:16', version: 'v1.06', summary: '世界书微调升级为结构化 patch 引擎与多条目预览。' },
    { time: '2026-03-22 20:35', version: 'v1.05', summary: '补齐最近修复日志，并新增当前版本标识。' },
    { time: '2026-03-22 20:27', version: 'v1.04', summary: '修复导入区原生文件按钮重复显示。' },
    { time: '2026-03-22 20:02', version: 'v1.03', summary: '新增更新日志按钮与弹窗。' },
    { time: '2026-03-22 19:58', version: 'v1.02', summary: '修复世界书条目标题导出。' },
    { time: '2026-03-22 19:21', version: 'v1.01', summary: '整理项目说明与仓库展示文案。' },
]);
