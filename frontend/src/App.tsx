import { NavLink, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import History from "./pages/History";
import Home from "./pages/Home";
import Sessions from "./pages/Sessions";

function Layout({ children }: { children: React.ReactNode }) {
  const navItems = [
    { path: "/", label: "Dashboard", icon: "◆" },
    { path: "/sessions", label: "Sessions", icon: "◎" },
    { path: "/history", label: "History", icon: "◈" },
  ];

  return (
    <div className="flex min-h-screen bg-surface-900">
      <aside className="w-64 bg-surface-800 border-r border-surface-700 flex flex-col">
        <div className="p-6 border-b border-surface-700">
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">
            acpx
          </h1>
          <p className="text-xs text-text-muted mt-1">Agent Client Protocol</p>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-accent-primary/10 text-accent-primary"
                        : "text-text-secondary hover:bg-surface-700 hover:text-text-primary"
                    }`
                  }
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-surface-700">
          <div className="flex items-center gap-3 px-4 py-2 text-text-muted text-sm">
            <div className="w-2 h-2 rounded-full bg-accent-success" />
            Connected
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}

function App() {
  return (
    <Layout>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  );
}

export default App;
