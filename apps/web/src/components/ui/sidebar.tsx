"use client";

import { cn } from "@/lib/utils";
import Link, { LinkProps } from "next/link";
import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { Menu, X, ChevronLeft } from "lucide-react";
import { usePathname } from "next/navigation";

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(true);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props: React.ComponentProps<typeof m.div>) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...(props as React.ComponentProps<"div">)} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof m.div>) => {
  const { open, setOpen } = useSidebar();
  return (
    <div
      className={cn(
        "relative hidden h-full flex-shrink-0 border-r border-border bg-card py-4 text-foreground md:flex md:flex-col",
        open ? "w-[250px] px-4" : "w-[72px] px-2",
        className
      )}
      {...(props as any)}
    >
      {/* Collapse/Expand Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "absolute -right-2 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground shadow-sm transition-colors",
          "hover:bg-muted/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
        aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
        aria-expanded={open}
      >
        <span
          className={cn(
            "transition-transform duration-200 motion-reduce:transition-none",
            open ? "rotate-0" : "rotate-180"
          )}
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </button>
      {children}
    </div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();
  const prefersReducedMotion = useReducedMotion();
  const mobileMenuPanelId = "mobile-sidebar-panel";

  return (
    <>
      <div
        className={cn(
          "flex min-h-[56px] w-full flex-row items-center justify-between border-b border-border bg-card px-4 py-2 text-foreground md:hidden"
        )}
        {...props}
      >
        <div className="z-20 flex w-full justify-end">
          <button
            type="button"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors hover:bg-muted/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            aria-controls={mobileMenuPanelId}
            aria-expanded={open}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <AnimatePresence>
          {open && (
            <m.div
              id={mobileMenuPanelId}
              role="dialog"
              aria-modal="true"
              aria-label="Sidebar navigation"
              initial={prefersReducedMotion ? false : { x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={prefersReducedMotion ? { x: 0, opacity: 1 } : { x: "-100%", opacity: 0 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.25,
                ease: "easeInOut",
              }}
              className={cn(
                "fixed inset-0 z-[100] flex h-full w-full flex-col justify-between bg-card p-6 text-foreground",
                className
              )}
            >
              <button
                type="button"
                className="absolute right-6 top-6 z-50 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors hover:bg-muted/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                onClick={() => setOpen(!open)}
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
              {children}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export const SidebarLink = ({
  link,
  className,
  ...props
}: {
  link: Links;
  className?: string;
  props?: LinkProps<any>;
}) => {
  const { open } = useSidebar();
  const pathname = usePathname();
  const isActive =
    pathname === link.href ||
    (link.href !== "/" && pathname?.startsWith(`${link.href}/`));

  return (
    <div>
      <Link
        href={link.href as any}
        aria-label={link.label}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "group/sidebar flex min-h-[44px] w-full items-center border-l-4 border-transparent transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isActive && "border-coral",
          open ? "justify-start pl-3 py-2" : "justify-center px-4 py-3",
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "flex h-5 w-5 flex-shrink-0 items-center justify-center transition-colors",
            open && "mr-4",
            isActive ? "text-foreground" : "text-muted-foreground group-hover/sidebar:text-foreground"
          )}
        >
          {link.icon}
        </div>
        <div className={cn(open ? "overflow-visible" : "overflow-hidden")}>
          <span
            aria-hidden={!open}
            className={cn(
              "inline-block whitespace-nowrap !m-0 !p-0 font-sans text-lg transition-opacity duration-150 motion-reduce:transition-none",
              open ? "opacity-100" : "pointer-events-none opacity-0",
              isActive
                ? "font-semibold text-foreground"
                : "text-muted-foreground group-hover/sidebar:text-foreground"
            )}
          >
            {link.label}
          </span>
        </div>
      </Link>
    </div>
  );
};
