/**
 * hopium.family mark: a capsule tilted 30°, top half Hopium Green, bottom half
 * Dream Violet, with a four-point Moon Gold spark above-right — "a dose of
 * hopium" that also reads as a rocket. Geometry is shared by the React Native
 * <LogoMark/> and scripts/generate-icons.ts so every asset matches.
 */
export const LOGO_COLORS = {
  green: '#3DFFA8',
  violet: '#8B5CFF',
  gold: '#FFD166',
  ink: '#07060F',
  paper: '#F5F3FF',
  inkOnLight: '#14121F',
} as const;

export const LOGO_MARK = {
  viewBox: 1024,
  capsule: { x: 250, y: 307, width: 300, height: 600, rx: 150 },
  rotation: { angle: 30, cx: 400, cy: 607 },
  seam: { y: 607, thickness: 16 },
  highlight: { x: 305, y: 380, width: 44, height: 170, rx: 22, opacity: 0.35 },
  sparkPath:
    'M755 130 C766 214 776 234 870 245 C776 256 766 276 755 360 C744 276 734 256 640 245 C734 234 744 214 755 130 Z',
  sparkSmallPath:
    'M880 372 C884 400 888 404 916 408 C888 412 884 416 880 444 C876 416 872 412 844 408 C872 404 876 400 880 372 Z',
} as const;

export interface LogoSvgOptions {
  /** Paint a full-bleed background (app icon, favicon). */
  background?: string | null;
  /** Scale of the mark inside the square (1 = native geometry). */
  scale?: number;
  /** Rounded corner radius for the background, in viewBox units. */
  cornerRadius?: number;
  seamColor?: string;
}

/** Standalone SVG string of the mark. */
export function logoMarkSvg(opts: LogoSvgOptions = {}): string {
  const { background = null, scale = 1, cornerRadius = 0, seamColor = LOGO_COLORS.ink } = opts;
  const { capsule: c, rotation: r, seam, highlight: h } = LOGO_MARK;
  const size = LOGO_MARK.viewBox;
  const bg = background
    ? `<rect width="${size}" height="${size}" rx="${cornerRadius}" fill="${background}"/>`
    : '';
  const s = scale;
  // Visual center of the mark is ~(522, 508); recenter to 512 while scaling.
  const transform = `translate(512 512) scale(${s}) translate(-522 -508)`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <clipPath id="capsule"><rect x="${c.x}" y="${c.y}" width="${c.width}" height="${c.height}" rx="${c.rx}"/></clipPath>
  </defs>
  ${bg}
  <g transform="${transform}">
    <g transform="rotate(${r.angle} ${r.cx} ${r.cy})">
      <g clip-path="url(#capsule)">
        <rect x="${c.x}" y="${c.y}" width="${c.width}" height="${c.height}" fill="${LOGO_COLORS.violet}"/>
        <rect x="${c.x}" y="${c.y}" width="${c.width}" height="${c.height / 2}" fill="${LOGO_COLORS.green}"/>
        <rect x="${c.x}" y="${seam.y - seam.thickness / 2}" width="${c.width}" height="${seam.thickness}" fill="${seamColor}" opacity="0.9"/>
      </g>
      <rect x="${h.x}" y="${h.y}" width="${h.width}" height="${h.height}" rx="${h.rx}" fill="#FFFFFF" opacity="${h.opacity}"/>
    </g>
    <path d="${LOGO_MARK.sparkPath}" fill="${LOGO_COLORS.gold}"/>
    <path d="${LOGO_MARK.sparkSmallPath}" fill="${LOGO_COLORS.gold}" opacity="0.8"/>
  </g>
</svg>`;
}
