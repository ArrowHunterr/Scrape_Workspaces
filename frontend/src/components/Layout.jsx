import { Outlet, Link, useLocation } from "react-router-dom";
import { 
  List, 
  Plus, 
  FileCode, 
  Gear,
  Bug
} from "@phosphor-icons/react";

const navItems = [
  { path: "/", label: "Jobs", icon: List },
  { path: "/new-job", label: "New Job", icon: Plus },
  { path: "/templates", label: "Templates", icon: FileCode },
  { path: "/settings", label: "Settings", icon: Gear },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-border bg-white flex items-center px-6 justify-between">
        <div className="flex items-center gap-3">
          <Bug size={24} weight="bold" className="text-primary" />
          <span className="text-lg font-semibold tracking-tight">Scrape Workbench</span>
        </div>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                className={`
                  flex items-center gap-2 px-4 py-2 text-sm font-medium
                  transition-colors duration-150
                  ${isActive 
                    ? "bg-primary text-white" 
                    : "text-foreground hover:bg-secondary"
                  }
                `}
              >
                <Icon size={18} weight={isActive ? "bold" : "regular"} />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
