"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  BarChart2,
  Building2,
  CreditCard,
  LayoutDashboard,
  Receipt,
} from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { ProtezioneAdmin } from "@/components/admin/ProtezioneAdmin";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: APP_ROUTES.ADMIN, label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: APP_ROUTES.ADMIN_ABBONAMENTO, label: "Abbonamento", icon: CreditCard, exact: false },
  { href: APP_ROUTES.ADMIN_CONSUMI, label: "Consumi AI", icon: BarChart2, exact: false },
  { href: APP_ROUTES.ADMIN_FATTURAZIONE, label: "Fatturazione", icon: Receipt, exact: false },
  { href: APP_ROUTES.ADMIN_DATI, label: "Dati azienda", icon: Building2, exact: false },
] as const;

function NavLink({
  href,
  label,
  icon: Icon,
  exact,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  exact: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
        active
          ? "bg-brand-50 text-brand-600"
          : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProtezioneAdmin>
      <div className="min-h-dvh bg-bg-base">
        <AppHeader
          actions={
            <>
              <Link href={APP_ROUTES.BACKOFFICE}>
                <Button variant="secondary" size="sm">
                  Back-office
                </Button>
              </Link>
              <Link href={APP_ROUTES.HOME}>
                <Button variant="secondary" size="sm">
                  Timbrature
                </Button>
              </Link>
            </>
          }
        />

        <div className="mx-auto max-w-[1100px] px-4 py-6">
          <div className="flex gap-6">
            {/* Sidebar — hidden on mobile, shown md+ */}
            <aside className="hidden md:flex w-52 shrink-0 flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <NavLink key={link.href} {...link} />
              ))}
            </aside>

            {/* Mobile top tabs */}
            <div className="md:hidden w-full">
              <nav className="flex gap-1 overflow-x-auto pb-4 mb-2">
                {NAV_LINKS.map((link) => (
                  <NavLink key={link.href} {...link} />
                ))}
              </nav>
              <div className="w-full">{children}</div>
            </div>

            {/* Main content — desktop */}
            <main className="hidden md:block flex-1 min-w-0">{children}</main>
          </div>
        </div>
      </div>
    </ProtezioneAdmin>
  );
}
