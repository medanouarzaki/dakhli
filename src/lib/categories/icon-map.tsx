import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  UtensilsCrossed,
  MoreHorizontal,
  PlusCircle,
  BookOpen,
  Gift,
  GraduationCap,
  Zap,
  Users,
  Laptop,
  Home,
  Clapperboard,
  RotateCcw,
  Banknote,
  HeartPulse,
  ShoppingBag,
  Dumbbell,
  Smartphone,
  Car,
  Plane,
  HeartHandshake,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  UtensilsCrossed,
  MoreHorizontal,
  PlusCircle,
  BookOpen,
  Gift,
  GraduationCap,
  Zap,
  Users,
  Laptop,
  Home,
  Clapperboard,
  RotateCcw,
  Banknote,
  HeartPulse,
  ShoppingBag,
  Dumbbell,
  Smartphone,
  Car,
  Plane,
  HeartHandshake,
};

export function CategoryIcon({
  name,
  className,
  style,
}: {
  name: string | null;
  className?: string;
  style?: CSSProperties;
}) {
  const Icon =
    (name !== null ? CATEGORY_ICONS[name] : undefined) ?? MoreHorizontal;
  return <Icon className={className} style={style} />;
}
