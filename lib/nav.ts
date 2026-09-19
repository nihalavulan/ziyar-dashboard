export interface NavItem {
  label: string;
  href: string;
  icon: string; // emoji keeps it dependency-free and mobile-friendly
}

export const navItems: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: "📊" },
  { label: "Daily entry", href: "/dashboard/daily-entry", icon: "📝" },
  { label: "Staff & Salary", href: "/dashboard/staff", icon: "👥" },
];
