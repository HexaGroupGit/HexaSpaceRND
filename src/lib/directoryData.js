// Bundled default content for the lobby directory boards, transcribed from the
// supplied HEXA_L4/L2_Directory.png and the ground-floor East Commercial Lobby
// board.
//
// Used to pre-fill the admin editor on first load and as the display-page
// fallback before a row exists in Supabase (or before the migration is run), so
// the TV boards always render something. A `name` may contain a newline for a
// bilingual / two-tenant second line.
//
// Two layouts:
//   suites — one Hexa floor (levels 2, 4, 5): SUITE / BUSINESS NAME rows
//   lobby  — the ground-floor building board: every floor of the East
//            Commercial Lobby side by side, plus the registered-business list.
//            Its Hexa floors pull their rows from the level boards at render
//            time (`source`), so it can never drift from them.

// Community members = dedicated desks, flexible desks and virtual offices.
// They're announced on the Level 4 board and on the ground-floor board.
const COMMUNITY_MEMBERS = [
  '6Homes',
  '7AM Photography Studio',
  '澳中商圈 AC Bridge International Group',
  'Ace International Property Group Pty Ltd',
  'ALLSET Conveyancing',
  'AO HUA YOU YUE Pty Ltd',
  'Astra Education & Migration Pty Ltd',
  'Aurora Migration Services',
  'Australian Building and Property Association VIC',
  'BLUEGREAT Pty Ltd',
  'Bricklane Property Group',
  'Bruce Global Taste Hub Pty Ltd',
  'Drug Advisory Council Australia',
  'Emai Accounting & BA Service',
  'Emerald Family Enterprise Group',
  'Emition Photography Studio',
  'Fureeze',
  'GOMA Commercial Services Pty Ltd',
  'Heena4BoxHill',
  'HITPOINT Pty Ltd',
  'I Do International Pty Ltd',
  'Invincible Energy',
  'JC Partners Lawyers',
  'J & H Legal Pty Ltd',
  'Joyful Living Pty Ltd',
  'Joyowo Geo Pty Ltd',
  'LM Yarra Conveyancing Pty Ltd',
  'Lunea',
  'LuxeKey Capital',
  'Lydian GBS',
  'MAI Capital Pty Ltd',
  'MEBUILD',
  'Money Chain Foreign Exchange',
  'Mynt',
  'New Bridge Edu',
  'New Route Pty Ltd',
  'New Vision Education Australia',
  'NovaFab Curtains and Blinds',
  'Ocon Project Solutions',
  'Orchardlink Pty Ltd',
  'Overallead Pty Ltd',
  'OZ-East International',
  'Pinecone Petpro Pty Ltd',
  'Proud Cactus',
  'Regent Metal Group Pty Ltd',
  'TinTax | Expert Tax & Accounting Services',
  'TJLAW Lawyers',
  'Top Trading Australia Pty Ltd',
  'Trafficon',
  'Unique Roofing & Home Improvements',
  'Verge Legal',
  'You Hao Pty Ltd',
  'Young Zhang',
  'Yuen & Z Investment Pty Ltd',
  'ZC Mortgage Solutions',
  'Zecco Property Services',
  'Zheng Hong Capital Pty Ltd',
  'Z Property International',
]

// Board ids in the order they're shown in the admin and offered for export.
export const BOARD_IDS = ['G', '2', '4', '5']
export const BOARD_LABELS = { G: 'Ground', 2: 'Level 2', 4: 'Level 4', 5: 'Level 5' }

export const DEFAULT_BOARDS = {
  '4': {
    level: '4',
    levelLabel: 'LEVEL 4',
    address: '830 WHITEHORSE ROAD · BOX HILL',
    suites: [
      { suite: '1', name: 'GrantGuru / GrantReady' },
      { suite: '2', name: 'Simple Stacks Accounting Services' },
      { suite: '3', name: 'Melbourne Creative Group' },
      { suite: '4', name: 'Connected Logics' },
      { suite: '5', name: 'New U Life' },
      { suite: '6', name: 'WKM Consumer Brands' },
      { suite: '7', name: 'Mindmetta Counseling & Integrative Therapy\n心慈心理咨询与整合疗愈工作室' },
      { suite: '8', name: 'Simple Stacks Accounting Services' },
      { suite: '9', name: 'Digitec IT 鼎捷数字技术' },
      { suite: '10', name: 'Chethana Psychology' },
    ],
    showCommunity: true,
    communityHeading: 'COMMUNITY MEMBERS',
    communitySubheading: '六 合 空 间 · 社 区 成 员',
    community: [...COMMUNITY_MEMBERS],
  },
  '2': {
    level: '2',
    levelLabel: 'LEVEL 2',
    address: '830 WHITEHORSE ROAD · BOX HILL',
    suites: [
      { suite: '1', name: 'Brixton Insurance / Prestige Car Insurance' },
      { suite: '2', name: 'Canwealth Property Group' },
      { suite: '3', name: 'PHC Accounting\nCentral Conveyancing Services' },
      { suite: '4', name: 'QBS Partners Chartered Accountants' },
      { suite: '5', name: 'JJT Finance Group' },
      { suite: '6', name: 'Raiden Centauri' },
      { suite: '7', name: 'Wehome Real Estate' },
      { suite: '8', name: 'Victor Group Holdings' },
      { suite: '9', name: 'Grand Galaxy 星空出行 & MSJ Media 禾子传媒' },
      { suite: '10', name: 'Nexus Interactive' },
      { suite: '11', name: '首选居家养老 Top 1 Care' },
      { suite: '12', name: '首选居家养老 Top 1 Care' },
      { suite: '13', name: 'Tantu' },
      { suite: '14', name: 'AJ Lee Property Group' },
      { suite: '15', name: 'Level Up | Consulting Engineers' },
      { suite: '17', name: 'Top Bridge Group 盛大移民 / 留学' },
      { suite: '18', name: 'Earth Power Co' },
      { suite: '19', name: 'PanAus Partners Melbourne' },
      { suite: '20', name: 'Sleek Circle' },
      { suite: '21', name: 'Karad & Bradley Architects & Planners' },
      { suite: '22', name: 'Brown & Turner Legal\nAzlan Lawyers' },
      { suite: '23', name: 'Masterlink Communications' },
      { suite: '24', name: 'Wehome Real Estate' },
      { suite: '25', name: 'Olivecast Podcast Studio' },
      { suite: '26', name: 'Global Link Logistics / Easy Way Logistics' },
      { suite: '27', name: 'RIO Capital' },
    ],
    showCommunity: false,
    communityHeading: 'COMMUNITY MEMBERS',
    communitySubheading: '六 合 空 间 · 社 区 成 员',
    community: [],
  },
  '5': {
    level: '5',
    levelLabel: 'LEVEL 5',
    address: '830 WHITEHORSE ROAD · BOX HILL',
    suites: [
      { suite: '11', name: 'Steadfast Eastern Insurance Brokers' },
      { suite: '12', name: 'HEXA Group 六合集团' },
      { suite: '13', name: 'Steadfast Eastern Insurance Brokers' },
      { suite: '14', name: 'M&Y OmniReach' },
      { suite: '15', name: '融侨金融 RongQiao Financial Group\n中信移民 Veritas\n中信会计 Zero2One Accounting\nLegalment 仁合律师事务所\nMondami Constructions' },
    ],
    showCommunity: false,
    communityHeading: 'COMMUNITY MEMBERS',
    communitySubheading: '六 合 空 间 · 社 区 成 员',
    community: [],
  },
  // Ground floor — the building's own East Commercial Lobby board. It covers
  // every floor (including the non-Hexa tenancies) and carries the community
  // members. There is no internet down here, so this board is meant to be
  // exported (PNG for print, HTML for a screen on a USB stick) rather than
  // polled live.
  'G': {
    level: 'G',
    layout: 'lobby',
    levelLabel: 'GROUND',
    buildingName: 'PANORAMA',
    buildingSub: 'BOX HILL',
    buildingCn: '白 马 · 御 景',
    title: 'EAST\nCOMMERCIAL LOBBY',
    address: '830 WHITEHORSE ROAD · BOX HILL',
    // Sections with a `source` pull their rows from that level's board when the
    // page renders, so the ground board follows every suite change made above.
    sections: [
      { floor: 'M', rows: [{ suite: '', name: 'Snap Fitness' }] },
      { floor: '1F', rows: [{ suite: '', name: 'Tizona Fencing Club' }] },
      { floor: '2F', heading: 'HEXA SPACE L2 Reception', subheading: '六合空间前台', source: '2' },
      { floor: '4F', heading: 'HEXA SPACE L4 Reception', subheading: '六合空间前台', source: '4' },
      { floor: '5F', source: '5' },
      { floor: '6F', rows: [{ suite: '', name: 'AU XIN PTY LTD' }, { suite: '', name: 'CBR Development Group Pty Ltd' }] },
      { floor: '7F', rows: [{ suite: '', name: 'AUTA Group' }, { suite: '', name: 'Jiayin MasterClass 杜佳音芭蕾舞大师班' }] },
    ],
    columnSplitAfter: 3,        // sections 1-3 in the left column, the rest right
    showCommunity: true,
    communityLead: 'LEVEL 4 · HEXA SPACE',
    communityHeading: 'Registered Businesses',
    communitySubheading: '六合空间 · 注册企业',
    community: [...COMMUNITY_MEMBERS],
  },
}

// Deep-ish clone so the editor never mutates the shared default.
export function cloneBoard(level) {
  return JSON.parse(JSON.stringify(DEFAULT_BOARDS[level]))
}
