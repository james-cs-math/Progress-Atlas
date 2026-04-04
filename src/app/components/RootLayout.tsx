import { Outlet, useNavigate, useLocation } from 'react-router';
import { useAuth } from '../lib/AuthContext';
import { useTier } from '../lib/TierContext';
import { FilterProvider } from '../lib/FilterContext';
import { FilterPanel } from './FilterPanel';
import { Button } from './ui/button';
import { 
  BookOpen, 
  MessageSquare, 
  BarChart3, 
  HelpCircle, 
  LogOut,
  Menu,
  X,
  Crown,
  Circle,
  GraduationCap,
  Sparkles,
  Target
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
// @ts-ignore
const logoImage = "/Progress-Atlas/logo.png";

const TIER_CONFIG = {
  euclid: {
    name: 'Euclid',
    icon: Circle,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  aristotle: {
    name: 'Aristotle',
    icon: GraduationCap,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
  plato: {
    name: 'Plato',
    icon: Sparkles,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  socrates: {
    name: 'Socrates',
    icon: Crown,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
};

export function RootLayout() {
  const { signOut } = useAuth();
  const { currentTier } = useTier();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/');
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast.error('Failed to sign out');
    }
  };

  const navItems = [
    { path: '/app/chat', label: 'AI Workspace', icon: MessageSquare },
    { path: '/app/dashboard', label: 'Dashboard', icon: BarChart3 },
  ];

  const isActive = (path: string) => {
    if (path === '/app') {
      return location.pathname === '/app';
    }
    return location.pathname.startsWith(path);
  };

  const tierConfig = TIER_CONFIG[currentTier];
  const TierIcon = tierConfig.icon;

  return (
    <FilterProvider>
      <div className="flex h-screen bg-gray-50">
        {/* Mobile menu button - more discrete */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lg:hidden fixed top-4 left-4 z-50 p-1.5 bg-white/90 backdrop-blur-sm rounded-md shadow-sm border border-gray-200 hover:bg-white transition-all"
          aria-label="Toggle sidebar"
        >
          {sidebarOpen ? <X size={20} className="text-gray-600" /> : <Menu size={20} className="text-gray-600" />}
        </button>

        {/* Sidebar */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-40
            w-64 bg-white border-r border-gray-200
            transform transition-transform duration-200 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            overflow-y-auto
          `}
        >
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="p-6 border-b border-gray-200 text-center">
              <img 
                src={logoImage} 
                alt="Progress Atlas Logo" 
                className="h-10 w-auto object-contain" 
              />
              <h1 className="text-xl font-bold text-gray-800">ProgressAtlas</h1>
              <p className="text-sm text-gray-500">Your map to improvement.</p>
              
              {/* Tier Display */}
              <div className={`mt-3 mx-auto inline-flex items-center gap-2 px-3 py-2 rounded-lg ${tierConfig.bgColor}`}>
                <TierIcon className={tierConfig.color} size={18} />
                <span className={`text-sm font-semibold ${tierConfig.color}`}>
                  {tierConfig.name}
                </span>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setSidebarOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-lg
                      transition-colors duration-150
                      ${
                        isActive(item.path)
                          ? 'bg-blue-50 text-blue-600 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }
                    `}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </button>
                );
              })}

              {/* Filter Panel in Sidebar */}
              <div className="pt-4 mt-4 border-t border-gray-200">
                <FilterPanel />
              </div>
            </nav>

            {/* Bottom actions */}
            <div className="p-4 border-t border-gray-200 space-y-2">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                onClick={() => {
                  navigate('/app/subscription');
                  setSidebarOpen(false);
                }}
              >
                <Crown size={20} />
                Subscription
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={handleSignOut}
              >
                <LogOut size={20} />
                Sign Out
              </Button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </FilterProvider>
  );
}