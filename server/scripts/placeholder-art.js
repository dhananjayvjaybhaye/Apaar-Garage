// Line art for the sample catalog only. Every listing should receive real photos before sale.
const artwork = {
  car: [
    'DIECAST CAR',
    '#ef8454',
    'M79 225l38-20 44-53q10-12 37-14h119q36 1 66 33l22 23 39 13 11 21v26H72v-16z',
    [
      [138, 254, 32],
      [387, 254, 32],
    ],
  ],
  truck: [
    'DIECAST TRUCK',
    '#d7a765',
    'M87 118h225v91h21v-89h62l53 55 11 33v45H82v-36h5z',
    [
      [149, 250, 33],
      [312, 250, 33],
      [412, 250, 33],
    ],
  ],
  bike: [
    'DIECAST BIKE',
    '#69c7b6',
    'M104 219l44-78 63 18 46-18 33-47 56 17-5 41 38 62-49 15-53-62-31 67h-73l-27-46-25 42z',
    [
      [124, 239, 38],
      [386, 239, 38],
    ],
  ],
  'rc-car': [
    'RC CAR',
    '#62dbd3',
    'M77 223l47-24 50-60 104-13 86 52 56 13 31 31v27H70z',
    [
      [136, 245, 35],
      [383, 245, 35],
    ],
  ],
  'rc-truck': [
    'RC TRUCK',
    '#f0964a',
    'M78 194l45-13h126l25-62h88l68 52 21 26v26H78z',
    [
      [133, 239, 48],
      [393, 239, 48],
    ],
  ],
  'rc-plane': [
    'RC PLANE',
    '#a6b5fb',
    'M63 177l26-11 37 11 57-3 64-70 56-7-31 72 153-7 31 10-22 18-157 18-18 60-39 6 10-62-98-3-47 21-28-6 36-35z',
    [],
  ],
  'rc-boat': [
    'RC BOAT',
    '#56c8ee',
    'M60 195l97 6 42-47h89l46 32 129-12-64 70H111z M89 266q34 15 68 0t68 0 68 0 68 0 68 0',
    [],
  ],
  'rc-drone': [
    'RC DRONE',
    '#b4dc74',
    'M74 118l149 55h77l160-55v15l-134 72 134 60v15l-160-44h-77L74 280v-15l127-60-127-72z M60 112h79m255 0h79M60 280h79m255 0h79',
    [],
  ],
  'rc-bike': [
    'RC BIKE',
    '#ed92bc',
    'M111 211l32-63 75 5 41-36 76-7 11 53 43 57-37 16-73-59-31 63h-86l-19-45-21 33z',
    [
      [123, 239, 39],
      [391, 239, 39],
    ],
  ],
  'rc-accessory': [
    'RC ACCESSORY',
    '#e1c26c',
    'M131 142h67v-28h135v28h67v117H131z M142 186h247m-83-39v109m-80-71v71m-19-124h114',
    [],
  ],
};

const finishes = ['#f18865', '#7cbfdc', '#e9c774', '#8ed3bc', '#ad9edc', '#d97f92', '#a4ccd4'];
const vehicleProfiles = [1, 0.89, 1.06, 0.93, 1.03];
const canvas = { width: 720, height: 540 };

function escapeXml(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function wheel(x, y, radius, accent) {
  return `<circle cx="${x}" cy="${y}" r="${radius}" fill="#111820" stroke="${accent}" stroke-width="4"/>
    <circle cx="${x}" cy="${y}" r="${Math.round(radius * 0.57)}" fill="#34404b" stroke="#d1d4d9" stroke-width="2"/>
    <path d="M${x - radius / 3} ${y}h${(radius * 2) / 3}m-${radius / 3} -${radius / 3}v${(radius * 2) / 3}" stroke="#9aa4af" stroke-width="2"/>`;
}

export function renderPlaceholder(product, index) {
  const [category, accent, path, wheels] = artwork[product.category];
  const finish = finishes[index % finishes.length];
  const profile = vehicleProfiles[index % vehicleProfiles.length];
  const title = escapeXml(product.name);
  const scale = product.scale ?? 'HOBBY SERIES';
  const serial = String(index + 1).padStart(2, '0');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 720 540" role="img" aria-labelledby="title">
  <title id="title">Placeholder illustration of ${title}</title>
  <defs>
    <radialGradient id="light" cx=".67" cy=".32" r=".78">
      <stop stop-color="${accent}" stop-opacity=".27"/><stop offset="1" stop-color="#10151d" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="paint" x2="0" y2="1">
      <stop stop-color="${finish}"/><stop offset="1" stop-color="#242733"/>
    </linearGradient>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M0 32V0h32" fill="none" stroke="${accent}" opacity=".18"/>
    </pattern>
  </defs>
  <rect width="720" height="540" fill="#11151c"/>
  <rect width="720" height="540" fill="url(#light)"/>
  <rect x="28" y="28" width="664" height="484" rx="20" fill="url(#grid)" stroke="${accent}" stroke-opacity=".45"/>
  <path d="M54 104h612M54 404h612M54 374h612" fill="none" stroke="${accent}" stroke-opacity=".46"/>
  <g font-family="system-ui,sans-serif">
    <text x="54" y="78" fill="${accent}" font-size="20" font-weight="800" letter-spacing="4">${category}</text>
    <text x="666" y="78" fill="#d7dbe0" font-size="18" text-anchor="end">${scale} / ${serial}</text>
    <text x="54" y="450" fill="#f2eee8" font-size="29" font-weight="750">${title}</text>
    <text x="54" y="486" fill="#c8cbd3" font-size="16" letter-spacing="3">SAMPLE ARTWORK</text>
  </g>
  <ellipse cx="360" cy="364" rx="${222 + (index % 5) * 7}" ry="19" fill="#070b10" opacity=".8"/>
  <g transform="translate(100 ${350 - 260 * profile}) scale(1 ${profile})" stroke-linejoin="round">
    <path d="${path}" fill="url(#paint)" stroke="${accent}" stroke-width="4"/>
    ${wheels.map(([x, y, radius]) => wheel(x, y, radius, finish)).join('\n    ')}
  </g>
</svg>
`;
}
