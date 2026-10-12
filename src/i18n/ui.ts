/**
 * The editor's own wording, in every language it supports.
 *
 * Only chrome lives here. Anything that comes from the game -- item, challenge, logbook and
 * category names -- is looked up from the game's shipped translation instead (see `lang.ts`), so
 * these dictionaries stay small and nothing game-facing can drift from the real thing.
 *
 * The English table is the source of truth for the key set: `UiKey` is derived from it, so a
 * missing Chinese entry is a type error rather than a blank label at runtime.
 */
import type { Lang } from "./lang";

export const UI_EN = {
  // ---------------------------------------------------------------- shell
  title: "Risk of Rain 2: Save Editor",
  openDifferent: "Open a different savefile",
  viewCode: "View the code",
  importTitle: "Risk of Rain 2: Save Editor",
  importBlurb:
    "This editor is still a work in progress, and might cause some game breaking bugs or other data loss.",
  importBackup: "Always keep a backup of your original save.",
  importPathLead: "Your savefile should be located at:",
  /**
   * The fork relationship, stated next to the work-in-progress notice. Split either side of the
   * link so the repository can be clickable; the two halves must still read as one sentence in
   * every language.
   */
  forkNote: "This is a fork of the original editor by",
  forkAdds:
    "The fork adds all four expansions, the in-game logbook, and an English/Chinese interface.",
  importAction: "Import savefile",
  importSample: "Just want to try it out? Use our sample savefile",
  readFailed: "Could not read that file.",
  notAProfile: "That does not look like a Risk of Rain 2 profile:",

  // ---------------------------------------------------------------- header / export
  profile: "Profile",
  profileName: "Profile name",
  lunarCoins: "Lunar coins (0 – 2,147,483,647)",
  unlockedEntries: "unlocked entries",
  achievementsWord: "achievements",
  saveVersion: "save version",
  unknownAchievementsKept: "{count} unknown achievement id(s) preserved",
  exportSave: "Export savefile",
  exportBlocked: "Export blocked — see save check",
  exportReadyTitle: "Download the edited profile",
  exportBlockedTitle: "Export blocked:",
  blockedReject: "{count} problems the game would reject",
  blockedRejectOne: "{count} problem the game would reject",

  // ---------------------------------------------------------------- tabs
  tabChallenges: "Challenges",
  tabViewables: "Viewables",
  tabLogbook: "Logbook",
  saveContents: "Save contents",
  allSeen: "Everything in the logbook has been seen",
  tabAlertTitle: "{count} entries not seen yet",
  clickToMarkSeen: "Click to mark seen",
  clickToMarkUnseen: "Click to mark unseen",

  // ---------------------------------------------------------------- shared filters
  searchChallenges: "Search name, description, id or unlock…",
  unlockAll: "Unlock all",
  lockAll: "Lock all",
  allTypes: "All types",
  hideUnlocked: "Hide unlocked",
  noChallenges: "No challenges match these filters.",
  unlockScopeAll: "all",
  allDlcs: "All DLCs",
  needsDlc: "needs",
  requires: "requires",

  // ---------------------------------------------------------------- logbook
  searchLogbook: "Search the logbook…",
  markSeen: "Mark seen",
  markUnseen: "Mark unseen",
  onlyUnseen: "Only not seen",
  noLogbookEntries: "No logbook entries match these filters.",
  seen: "seen",
  notSeen: "not seen",
  notSeenYet: "Not seen yet",
  notSeenCount: "not seen",
  showing: "showing",

  // ---------------------------------------------------------------- logbook hover card
  factTier: "Tier",
  factType: "Type",
  factBaseHealth: "Base health",
  factStage: "Stage",
  factDroneTier: "Drone tier",
  factSortOrder: "Character select order",
  factClass: "Class",
  factCategory: "Category",
  factGamePosition: "Game position",

  // ---------------------------------------------------------------- viewables
  searchViewables: "Search viewables…",
  hideSeen: "Hide seen",
  noViewables: "No viewables match these filters.",
  allWord: "All",
  seenOfTotal: "{seen} of {total} seen",
  unknownKept: "· {count} unknown kept",

  // ---------------------------------------------------------------- metadata
  saveMetadata: "Save metadata",
  metadataBlurb: "These are the profile's plain settings. Editing",
  metadataVersionWord: "version",
  metadataBlurbTail: "or the counters below can affect how the game loads this profile.",
  achievementCounters: "Achievement counters",
  filterFields: "Filter fields…",

  // ---------------------------------------------------------------- validation
  saveCheckOk: "Save check: no problems found.",
  saveCheckSummary: "Save check",
  errors: "errors",
  warnings: "warnings",

  // ---------------------------------------------------------------- confirmation
  confirmUnlockTitle: "Unlock everything?",
  confirmLockTitle: "Lock everything?",
  confirmUnlockBody: "This grants every challenge in the current scope.",
  confirmLockBody: "This revokes every challenge in the current scope.",
  confirm: "Confirm",
  cancel: "Cancel",
} as const;

export type UiKey = keyof typeof UI_EN;

export const UI_ZH: Record<UiKey, string> = {
  title: "雨中冒险 2：存档编辑器",
  openDifferent: "打开其他存档",
  viewCode: "查看源码",
  importTitle: "雨中冒险 2：存档编辑器",
  importBlurb: "本编辑器仍在开发中，可能导致游戏出错或数据丢失。",
  importBackup: "请务必备份你的原始存档。",
  importPathLead: "你的存档应该位于：",
  forkNote: "本项目是原版编辑器的分支，原作者：",
  forkAdds: "本分支增加了全部四个扩展包、游戏内日志，以及中英文界面。",
  importAction: "导入存档",
  importSample: "只是想试试？使用我们的示例存档",
  readFailed: "无法读取该文件。",
  notAProfile: "这不像是雨中冒险 2 的档案：",

  profile: "档案",
  profileName: "档案名称",
  lunarCoins: "月球币（0 – 2,147,483,647）",
  unlockedEntries: "条已解锁",
  achievementsWord: "项成就",
  saveVersion: "存档版本",
  unknownAchievementsKept: "保留了 {count} 个未知成就 ID",
  exportSave: "导出存档",
  exportBlocked: "导出已阻止 —— 见存档检查",
  exportReadyTitle: "下载编辑后的档案",
  exportBlockedTitle: "导出已阻止：",
  blockedReject: "游戏会拒绝的 {count} 个问题",
  blockedRejectOne: "游戏会拒绝的 {count} 个问题",

  tabChallenges: "挑战",
  tabViewables: "外观",
  tabLogbook: "日志",
  saveContents: "存档内容",
  allSeen: "日志已全部查看",
  tabAlertTitle: "{count} 个条目尚未查看",
  clickToMarkSeen: "点击标记为已查看",
  clickToMarkUnseen: "点击标记为未查看",

  searchChallenges: "搜索名称、描述、ID 或解锁内容…",
  unlockAll: "全部解锁",
  lockAll: "全部锁定",
  allTypes: "全部类型",
  hideUnlocked: "隐藏已解锁",
  noChallenges: "没有符合筛选条件的挑战。",
  unlockScopeAll: "全部",
  allDlcs: "全部 DLC",
  needsDlc: "需要",
  requires: "需要",

  searchLogbook: "搜索日志…",
  markSeen: "标记为已查看",
  markUnseen: "标记为未查看",
  onlyUnseen: "仅未查看",
  noLogbookEntries: "没有符合筛选条件的日志条目。",
  seen: "已查看",
  notSeen: "未查看",
  notSeenYet: "尚未查看",
  notSeenCount: "条未查看",
  showing: "显示",

  factTier: "等级",
  factType: "类型",
  factBaseHealth: "基础生命值",
  factStage: "关卡",
  factDroneTier: "无人机等级",
  factSortOrder: "选人顺序",
  factClass: "类名",
  factCategory: "分类",
  factGamePosition: "游戏内序号",

  searchViewables: "搜索外观…",
  hideSeen: "隐藏已查看",
  noViewables: "没有符合筛选条件的外观。",
  allWord: "全部",
  seenOfTotal: "已查看 {seen} / {total}",
  unknownKept: "· 保留 {count} 个未知项",

  saveMetadata: "存档元数据",
  metadataBlurb: "这些是档案的普通设置项。修改",
  metadataVersionWord: "版本",
  metadataBlurbTail: "或下方的计数器会影响游戏读取该档案的方式。",
  achievementCounters: "成就计数器",
  filterFields: "筛选字段…",

  saveCheckOk: "存档检查：未发现问题。",
  saveCheckSummary: "存档检查",
  errors: "错误",
  warnings: "警告",

  confirmUnlockTitle: "解锁全部内容？",
  confirmLockTitle: "锁定全部内容？",
  confirmUnlockBody: "这会授予当前范围内所有挑战。",
  confirmLockBody: "这会撤销当前范围内所有挑战。",
  confirm: "确认",
  cancel: "取消",
};

export const UI: Record<Lang, Record<UiKey, string>> = { en: UI_EN, zh: UI_ZH };

/**
 * The plain-settings field labels.
 *
 * Kept beside the UI table rather than inside `metadata.ts` so the data module stays free of
 * presentation, and keyed by the English label the specs already carry -- that way an unknown label
 * simply falls through to English instead of blanking out.
 */
export const FIELD_LABELS_ZH: Record<string, string> = {
  "Profile name": "档案名称",
  "Save format version": "存档格式版本",
  "Lunar coins": "月球币",
  "Lunar coins collected (lifetime)": "累计获得月球币",
  "Total login seconds": "累计登录时长（秒）",
  "Total seconds alive": "累计存活时长（秒）",
  "Total seconds in runs": "累计游戏时长（秒）",
  "Total runs started": "开始游戏次数",
  "Preferred survivor": "默认幸存者",
  "Rebirth item": "转生道具",
  "Disable item displays": "禁用道具显示",
  "Increased difficulty bar FX": "难度条特效增强",
  "Inspect feature enabled": "启用观察功能",
  "Inspect autopause": "观察时自动暂停",
  "Toggle scoreboard": "切换记分板",
  "Teleporter discovery indicator": "传送器发现提示",
  "Teleporter particle scaling": "传送器粒子缩放",
  "HUD size mode": "HUD 尺寸模式",
  "Screen shake scale": "屏幕震动幅度",
  "Gamepad vibration scale": "手柄震动幅度",
  "Games played": "游戏场次",
  "Total kills": "总击杀数",
  "Total deaths": "总死亡数",
  "Elite kills": "精英击杀数",
  "Minion kills": "召唤物击杀数",
  "Damage dealt": "造成伤害",
  "Damage taken": "承受伤害",
  "Health healed": "治疗量",
  "Highest single hit": "最高单次伤害",
  "Highest level": "最高等级",
  "Gold collected": "累计获得金币",
  "Most gold held": "单局最高持币",
  "Distance travelled": "移动距离",
  "Items collected": "拾取道具数",
  "Most items held": "单局最高道具数",
  "Stages completed": "通关关卡数",
  "Most stages in a run": "单局最高关卡数",
  Purchases: "购买次数",
  "Gold purchases": "金币购买",
  "Blood purchases": "鲜血购买",
  "Lunar purchases": "月球购买",
  "Tier 1 purchases": "一级道具购买",
  "Tier 2 purchases": "二级道具购买",
  "Tier 3 purchases": "三级道具购买",
  "Drones purchased": "购买无人机",
  "Turrets purchased": "购买炮塔",
  "Green soups purchased": "购买绿色汤剂",
  "Red soups purchased": "购买红色汤剂",
  "Teleporters completed": "完成传送器",
  "Teleporter bosses killed": "击杀传送器首领",
  "Deaths by burning": "被灼烧致死",
  "Deaths while burning": "灼烧状态下死亡",
  "Flying rocks destroyed": "击碎飞行岩石",
  "Acrid poison stacks": "酸液毒层数",
  "Acrid 1-HP kills": "酸液 1 血击杀",
  "Hermit crabs chased off": "赶走寄居蟹",
};

export const FIELD_GROUPS_ZH: Record<string, string> = {
  Profile: "档案",
  Currency: "货币",
  Gameplay: "玩法",
  Playtime: "时长",
  Input: "操作",
  Tutorial: "教程",
  Other: "其他",
};

/** The five release groups, as the store and the game's own UI name them. */
export const DLC_LABELS_EN: Record<string, string> = {
  base: "Base Game",
  sotv: "Survivors of the Void",
  sots: "Seekers of the Storm",
  ac: "Alloyed Collective",
  hc: "Hallowed Concepts",
};

export const DLC_LABELS_ZH: Record<string, string> = {
  base: "基础游戏",
  sotv: "虚空幸存者",
  sots: "风暴探寻者",
  ac: "合金集合体",
  hc: "万象归衡",
};
