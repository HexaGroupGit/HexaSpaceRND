// Floor-plan highlight map for the proposal generator.
//
// Coordinates are [left, top, width, height] as PERCENTAGES of the plan image
// (each plan is 2000×1414). Calibrated 2026-07-02 by Eric via the drag/stretch
// mapper tool, then verified visually. Key = the numeric part of a space's
// unitNumber ("Office 4" → "4", "Suite 15" → "15").
//
// When a lead picks an office, the proposal renders its floor's plan with a
// transparent olive box over the chosen suite(s).

export const FLOORS = {
  l2: { label: 'Level 2', image: '/floorplans/proposal-l2.png' },
  l4: { label: 'Level 4', image: '/floorplans/proposal-l4.png' },
  l5: { label: 'Level 5', image: '/floorplans/proposal-l5.png' },
}

export const HIGHLIGHTS = {
  l4: {
    '1': [3.26, 18.67, 7.45, 11.78], '2': [10.66, 18.96, 4.97, 9.38], '3': [15.64, 19.82, 4.28, 8.47],
    '4': [19.95, 19.36, 6.92, 9.1], '5': [26.7, 19.77, 4.1, 8.64], '6': [30.64, 19.72, 4.06, 8.69],
    '7': [34.68, 19.86, 4, 8.46], '8': [38.59, 19.95, 4.06, 8.46], '9': [42.72, 20.41, 4.45, 7.87],
    '10': [47.11, 20.41, 4.81, 7.91],
  },
  l2: {
    '1': [88.59, 29.96, 4.33, 9.16], '2': [84.43, 29.9, 4.22, 9.22], '3': [80.33, 29.45, 4.26, 7.84],
    '4': [76.14, 29.22, 4.26, 8.12], '5': [71.99, 29.2, 4.26, 8.03], '6': [67.92, 29.22, 4.11, 8.07],
    '7': [63.81, 29.27, 4.1, 8.03], '8': [59.21, 28.98, 4.53, 8.25], '9': [38.92, 28.13, 4.22, 9.19],
    '10': [34.79, 27.76, 4.28, 9.42], '11': [30.66, 27.83, 4.28, 9.4], '12': [26.51, 27.61, 4.21, 9.62],
    '13': [22.2, 27.6, 4.36, 9.63], '14': [18.11, 27.42, 4.19, 9.9], '15': [13.97, 27.59, 4.27, 9.78],
    '16': [9.95, 26.93, 4.16, 10.42], '17': [6.44, 26.9, 3.66, 10.33], '18': [2.61, 27.07, 4, 10.15],
    '19': [8.78, 40.08, 4.78, 3.17], '20': [13.46, 40.03, 4.74, 3.38], '21': [23.06, 40.08, 4.78, 3.38],
    '22': [34.87, 40.13, 4.78, 3.53], '23': [59.68, 40.61, 4.4, 8.2], '24': [64.06, 40.55, 4.33, 8.31],
    '25': [68.37, 40.55, 4.29, 8.2], '26': [76.87, 40.61, 4.29, 8.26], '27': [81.17, 40.61, 3.29, 8.26],
  },
  l5: {
    '11': [18.16, 24.39, 15.74, 20.06], '12': [32.11, 10.97, 16.53, 28.49], '13': [48.74, 12.11, 16.19, 27.46],
    '14': [56.16, 39.52, 8.55, 11.94], '15': [33.6, 44.26, 10.06, 12.99],
  },
}

// Extract the highlight box for a space. Tolerant of "Office 4", "Suite 15", "4".
export function highlightFor(floor, unitNumber) {
  const map = HIGHLIGHTS[floor]
  if (!map) return null
  const key = String(unitNumber ?? '').replace(/[^0-9]/g, '')
  return key && map[key] ? map[key] : null
}
