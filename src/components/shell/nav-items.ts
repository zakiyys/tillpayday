import {
  ArrowLeftRight, CalendarClock, HandCoins, Home, LayoutDashboard, MessageSquare, Newspaper, PiggyBank, Plane,
  Settings, Target, TrendingUp, Upload, Wallet, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  key: string;
  icon: LucideIcon;
}

export interface NavGroup {
  key: string;
  items: NavItem[];
}

/** Every page, grouped by the job it serves. The side rail shows all groups; the phone menu sheet shows the same. */
export const GROUPS: NavGroup[] = [
  {
    key: "groupDaily",
    items: [
      { href: "/", key: "home", icon: Home },
      { href: "/record", key: "record", icon: MessageSquare },
      { href: "/transactions", key: "transactions", icon: ArrowLeftRight },
    ],
  },
  {
    key: "groupMoney",
    items: [
      { href: "/accounts", key: "accounts", icon: Wallet },
      { href: "/debts", key: "debts", icon: HandCoins },
      { href: "/investments", key: "investments", icon: TrendingUp },
    ],
  },
  {
    key: "groupPlan",
    items: [
      { href: "/budgets", key: "budgets", icon: PiggyBank },
      { href: "/bills", key: "bills", icon: CalendarClock },
      { href: "/goals", key: "goals", icon: Target },
      { href: "/trips", key: "trips", icon: Plane },
    ],
  },
  {
    key: "groupReports",
    items: [
      { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
      { href: "/recap", key: "recap", icon: Newspaper },
      { href: "/import", key: "import", icon: Upload },
    ],
  },
];

export const SETTINGS: NavItem = { href: "/settings", key: "settings", icon: Settings };

/** Bottom bar on phones: two tabs, the raised Record button, two tabs. "More" opens every other page. */
export const TABS_LEFT: NavItem[] = [GROUPS[0]!.items[0]!, GROUPS[0]!.items[2]!];
export const TABS_RIGHT: NavItem[] = [GROUPS[1]!.items[0]!];
export const RECORD = GROUPS[0]!.items[1]!;

export const ALL_NAV: NavItem[] = [...GROUPS.flatMap((g) => g.items), SETTINGS];
