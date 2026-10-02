import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppProvider } from "../lib/app-context";
import { feedback } from "../lib/feedback";

const INTERACTIVE_SELECTOR =
  'button, a, [role="button"], [role="switch"], [role="tab"], [role="menuitem"], [role="option"], label[for], input[type="checkbox"], input[type="radio"], input[type="submit"], input[type="button"], [data-tap]';

function findInteractive(target: EventTarget | null): HTMLElement | null {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== "function") return null;
  const hit = el.closest(INTERACTIVE_SELECTOR) as HTMLElement | null;
  if (!hit) return null;
  if (hit.hasAttribute("disabled") || hit.getAttribute("aria-disabled") === "true") return null;
  return hit;
}

function useGlobalClickFeedback() {
  useEffect(() => {
    const pressed = new WeakSet<HTMLElement>();

    const onDown = (e: Event) => {
      const el = findInteractive(e.target);
      if (!el) return;
      pressed.add(el);
      el.setAttribute("data-pressed", "");
      feedback("tap");
    };
    const onUp = (e: Event) => {
      const el = findInteractive(e.target);
      if (el && pressed.has(el)) {
        el.removeAttribute("data-pressed");
        pressed.delete(el);
      }
      // Also clear any stragglers if pointer released outside
      document.querySelectorAll('[data-pressed]').forEach((n) => n.removeAttribute("data-pressed"));
    };

    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onUp, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);
    };
  }, []);
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { title: "TalkMe — Anonymous chat" },
      { name: "description", content: "Make new friends with TalkMe." },
      { property: "og:title", content: "TalkMe — Anonymous chat" },
      { property: "og:description", content: "Make new friends with TalkMe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "theme-color", content: "#1a1226" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "TalkMe" },
      { name: "twitter:title", content: "TalkMe — Anonymous chat" },
      { name: "twitter:description", content: "Make new friends with TalkMe." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/f187844b-5af5-4535-aa77-3adf223cec25" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/f187844b-5af5-4535-aa77-3adf223cec25" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
    ],

  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const brandBootScript = `(function(){try{var brands=['white','pink','blue','purple','green','orange','red','yellow','teal','mint'];var b=JSON.parse(localStorage.getItem('talkme_brand'));document.documentElement.setAttribute('data-brand',brands.indexOf(b)>-1?b:'white');var th=JSON.parse(localStorage.getItem('talkme_theme'));document.documentElement.setAttribute('data-theme',th==='light'?'light':'dark');var l=JSON.parse(localStorage.getItem('talkme_lang'));if(typeof l==='string'){document.documentElement.lang=l;}}catch(e){document.documentElement.setAttribute('data-brand','white');document.documentElement.setAttribute('data-theme','dark');}})();`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" data-brand="white" data-theme="dark">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: brandBootScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useGlobalClickFeedback();

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <Outlet />
      </AppProvider>
    </QueryClientProvider>
  );
}
