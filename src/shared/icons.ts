import {
  createIcons,
  Settings,
  List,
  ScanSearch,
  Plus,
  Search,
  RotateCw,
  Download,
  Upload,
  Trash2,
  Copy,
  Pencil,
  Inbox,
  AlertTriangle,
  AlertCircle,
  Check,
  Save,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Tag,
  SlidersHorizontal,
  FolderTree,
  FileText,
  HelpCircle,
  X,
  Link2,
  Zap,
  PlugZap,
  ArrowUpRight,
  Target,
  type IconNode,
} from 'lucide';

/**
 * Registry of all Lucide icons used across Form Secretary
 */
export const ICONS: Record<string, IconNode> = {
  settings: Settings,
  fields: List,
  scanner: ScanSearch,
  plus: Plus,
  save: Save,
  search: Search,
  refresh: RotateCw,
  export: Download,
  import: Upload,
  trash: Trash2,
  copy: Copy,
  edit: Pencil,
  empty: Inbox,
  warning: AlertTriangle,
  'alert-circle': AlertCircle,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  'external-link': ExternalLink,
  sparkles: Sparkles,
  tag: Tag,
  filter: SlidersHorizontal,
  sliders: SlidersHorizontal,
  categories: FolderTree,
  file: FileText,
  help: HelpCircle,
  close: X,
  connect: PlugZap,
  zap: Zap,
  link: Link2,
  'arrow-up-right': ArrowUpRight,
  target: Target,
  goto: ArrowUpRight,
  locate: Target,
};

export interface IconOptions {
  class?: string;
  size?: number | string;
  strokeWidth?: number | string;
  style?: string;
  id?: string;
  ariaHidden?: boolean;
}

/**
 * Serialize an IconNode definition into a clean, inline SVG markup string
 */
export function getIconSvg(name: string, options: IconOptions = {}): string {
  const iconNode = ICONS[name];
  if (!iconNode) {
    console.warn(`[Icons] Icon "${name}" not found in ICONS registry.`);
    return '';
  }

  const size = options.size !== undefined ? String(options.size) : '16';
  const strokeWidth = options.strokeWidth !== undefined ? String(options.strokeWidth) : '2';
  const className = options.class ? `lucide-icon lucide-${name} ${options.class}` : `lucide-icon lucide-${name}`;
  const ariaHidden = (options.ariaHidden ?? true) ? 'true' : 'false';

  const defaultAttrs: Record<string, string> = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': strokeWidth,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    class: className,
    'aria-hidden': ariaHidden,
  };

  if (options.id) defaultAttrs.id = options.id;
  if (options.style) defaultAttrs.style = options.style;

  const attrString = Object.entries(defaultAttrs)
    .map(([key, val]) => `${key}="${val}"`)
    .join(' ');

  const childrenMarkup = iconNode
    .map(([tagName, tagAttrs]) => {
      const childAttrs = Object.entries(tagAttrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
      return `<${tagName} ${childAttrs}></${tagName}>`;
    })
    .join('');

  return `<svg ${attrString}>${childrenMarkup}</svg>`;
}

export function createIconElement(name: string, options: IconOptions = {}): SVGElement | null {
  const iconNode = ICONS[name];
  if (!iconNode) {
    console.warn(`[Icons] Icon "${name}" not found in ICONS registry.`);
    return null;
  }

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const size = options.size !== undefined ? String(options.size) : '16';
  const strokeWidth = options.strokeWidth !== undefined ? String(options.strokeWidth) : '2';
  const className = options.class ? `lucide-icon lucide-${name} ${options.class}` : `lucide-icon lucide-${name}`;
  const ariaHidden = (options.ariaHidden ?? true) ? 'true' : 'false';

  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', strokeWidth);
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', ariaHidden);

  if (options.id) svg.setAttribute('id', options.id);
  if (options.style) svg.setAttribute('style', options.style);

  iconNode.forEach(([tagName, tagAttrs]) => {
    const child = document.createElementNS('http://www.w3.org/2000/svg', tagName);
    Object.entries(tagAttrs).forEach(([k, v]) => {
      child.setAttribute(k, String(v));
    });
    svg.appendChild(child);
  });

  return svg;
}

/**
 * Initialize Lucide icons on any static DOM elements containing data-lucide="icon-name"
 */
export function initIcons(root?: HTMLElement | Document): void {
  const container = root || document;
  const elements = container.querySelectorAll<HTMLElement>('[data-lucide]');

  elements.forEach((el) => {
    const iconName = el.getAttribute('data-lucide');
    if (!iconName) return;

    const size = el.getAttribute('data-size') || undefined;
    const strokeWidth = el.getAttribute('data-stroke-width') || undefined;
    const extraClass = el.className || '';
    const style = el.getAttribute('style') || undefined;
    const id = el.id || undefined;

    const svgElement = createIconElement(iconName, {
      class: extraClass,
      size,
      strokeWidth,
      style,
      id,
    });

    if (svgElement) {
      el.replaceWith(svgElement);
    }
  });
}
