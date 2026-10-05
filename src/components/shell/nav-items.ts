import {
  ArrowLeftRight, CalendarClock, HandCoins, Home, LayoutDashboard, MessageSquare, Newspaper, PiggyBank, Plane,
  Receipt, Settings, Target, TrendingUp, Upload, Wallet, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  key: string;
  icon: LucideIcon;
}

/** Bottom tabs on phones (SPEC 10). */
export const PRIMARY: NavItem[] = [
  { href: "/", key: "home", icon: Home },
  { href: "/transactions", key: "transactions", icon: ArrowLeftRight },
  { href: "/accounts", key: "accounts", icon: Wallet },
  { href: "/goals", key: "goals", icon: Target },
  { href: "/investments", key: "investments", icon: TrendingUp },
];

export const SECONDARY: NavItem[] = [
  { href: "/record", key: "record", icon: MessageSquare },
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/debts", key: "debts", icon: HandCoins },
  { href: "/budgets", key: "budgets", icon: PiggyBank },
  { href: "/bills", key: "bills", icon: CalendarClock },
  { href: "/import", key: "import", icon: Upload },
  { href: "/recap", key: "recap", icon: Newspaper },
  { href: "/trips", key: "trips", icon: Plane },
  { href: "/settings", key: "settings", icon: Settings },
];

export const ALL_NAV = [...PRIMARY, ...SECONDARY];
export { Receipt };
