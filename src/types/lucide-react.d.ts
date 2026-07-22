declare module 'lucide-react' {
  import type { SVGProps, FC } from 'react';

  export interface LucideProps extends SVGProps<SVGSVGElement> {
    size?: number | string;
    strokeWidth?: number | string;
    absoluteStrokeWidth?: boolean;
  }

  export type LucideIcon = FC<LucideProps>;

  // Icons used in VIBEFUNNY
  export const Video: LucideIcon;
  export const Upload: LucideIcon;
  export const Link2: LucideIcon;
  export const PenLine: LucideIcon;
  export const Check: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const MessageSquare: LucideIcon;
  export const X: LucideIcon;
  export const ClipboardList: LucideIcon;
  export const Target: LucideIcon;
  export const PartyPopper: LucideIcon;
  export const CheckCircle2: LucideIcon;
  export const XCircle: LucideIcon;
  export const Clock: LucideIcon;
  export const Send: LucideIcon;
  export const Search: LucideIcon;
  export const Megaphone: LucideIcon;
  export const Users: LucideIcon;
  export const Clapperboard: LucideIcon;
  export const HeartHandshake: LucideIcon;
  export const ShieldOff: LucideIcon;
}
