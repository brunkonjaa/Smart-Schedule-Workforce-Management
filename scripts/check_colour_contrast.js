const hexToRgb = (hex) => {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
};

const channel = (value) => value <= 0.04045
  ? value / 12.92
  : ((value + 0.055) / 1.055) ** 2.4;

const luminance = (hex) => {
  const [red, green, blue] = hexToRgb(hex).map(channel);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const ratio = (first, second) => {
  const values = [luminance(first), luminance(second)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

const pairs = [
  ['Light text', '#111827', '#f5f7fb'],
  ['Light muted text', '#536075', '#f5f7fb'],
  ['Light accent', '#4f46e5', '#ffffff'],
  ['White on purple button', '#ffffff', '#4f46e5'],
  ['White on darker teal button', '#ffffff', '#0f766e'],
  ['Light success', '#287950', '#ffffff'],
  ['Light unread blue', '#2563eb', '#ffffff'],
  ['Light error', '#b42318', '#ffffff'],
  ['Dark text', '#e5eefb', '#09111f'],
  ['Dark muted text', '#9fb0ca', '#09111f'],
  ['Dark accent', '#8b7cff', '#09111f'],
  ['Dark success override', '#4ade80', '#09111f'],
  ['Dark unread override', '#93c5fd', '#09111f'],
  ['Dark error override', '#fca5a5', '#09111f']
];

pairs.forEach(([name, foreground, background]) => {
  const value = ratio(foreground, background);
  console.log(`${name}|${foreground}|${background}|${value.toFixed(2)}|${value >= 4.5 ? 'AA normal pass' : 'FAIL normal text'}`);
});
