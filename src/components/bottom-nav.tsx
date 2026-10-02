import { Link, useRouterState } from "@tanstack/react-router";
import { MessageCircle, Phone } from "lucide-react";
import { useApp } from "@/lib/app-context";

export function BottomNav() {
  const { t } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = [
    { to: "/", label: t("chatTab"), icon: MessageCircle },
    { to: "/voice", label: t("voiceTab"), icon: Phone },
  ] as const;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
      <div className="mx-auto max-w-md px-4 pb-4">
        <div className="card-soft flex items-center justify-around gap-2 p-2">
          {items.map((it) => {
            const active = pathname === it.to;
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                className={
                  "btn-pill flex-1 !py-2.5 text-sm " +
                  (active ? "btn-brand" : "btn-ghost-pill")
                }
              >
                <Icon className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
