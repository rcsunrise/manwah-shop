import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MonitorPlay, Settings, LayoutDashboard, Users, UserCircle, ChevronRight, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('role').eq('id', user.id).single()
          .then(({ data }) => {
            if (data?.role === 'admin' || data?.role === 'dept_admin') {
              setIsAdmin(true);
            }
          });
      }
    });
  }, []);

  const settingsItems = [
    { id: 'dashboard', label: '控制台', icon: <LayoutDashboard size={15} />, path: '/dashboard' },
    ...(isAdmin ? [
      { id: 'users', label: '员工管理', icon: <Users size={15} />, path: '/admin/users' },
      { id: 'billing', label: '数据审计', icon: <LayoutDashboard size={15} />, path: '/admin/billing' }
    ] : []),
    { id: 'profile', label: '个人中心', icon: <UserCircle size={15} />, path: '/profile' }
  ];

  const getActiveTab = () => {
    if (location.pathname.startsWith('/manwah')) return 'manwah';
    if (location.pathname.startsWith('/dashboard')) return 'dashboard';
    if (location.pathname.startsWith('/admin/billing')) return 'billing';
    if (location.pathname.startsWith('/admin/users')) return 'users';
    if (location.pathname.startsWith('/admin')) return 'users';
    if (location.pathname.startsWith('/profile')) return 'profile';
    return 'manwah';
  };

  const activeTab = getActiveTab();

  return (
    <div className="min-h-screen bg-stone-100/50 flex flex-col font-sans">
      
      {/* ----------------- 非工作流页面的顶部页眉栏 ----------------- */}
      {activeTab !== 'manwah' && (
        <header className="bg-white/90 backdrop-blur-xl border-b border-[#E5E0D8]/60 px-3 sm:px-6 py-2.5 sticky top-0 z-40 shadow-xs flex items-center justify-between gap-2">
          {/* 左侧品牌 */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-tr from-[#B28C5A] to-[#E2D1B3] rounded-xl flex items-center justify-center text-white font-serif font-bold text-base sm:text-lg shadow-sm">
              MH
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm md:text-base font-bold text-stone-900 tracking-wide">MH 智慧门店</h1>
                <span className="hidden sm:inline-block bg-[#F9F5EF] text-[#B28C5A] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#B28C5A]/20">
                  控制中心
                </span>
              </div>
            </div>
          </div>

          {/* 页眉中央导航胶囊 (桌面端/平板端展示) */}
          <div className="hidden sm:flex items-center bg-stone-100/90 p-1 rounded-full border border-[#E5E0D8] shadow-inner">
            <button
              onClick={() => navigate('/manwah')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 whitespace-nowrap"
            >
              <MonitorPlay size={15} />
              <span>工作流</span>
            </button>

            <div className="w-[1px] h-4 bg-stone-300/70 mx-1" />

            <div className="relative">
              <button
                onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all bg-[#B28C5A] text-white shadow-sm whitespace-nowrap"
              >
                <Settings size={15} strokeWidth={2.5} />
                <span>设置</span>
                <ChevronDown size={13} className={`transition-transform duration-200 ${showSettingsDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* 下拉菜单 */}
              {showSettingsDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSettingsDropdown(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-stone-200/80 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-stone-400 uppercase tracking-wider border-b border-stone-100 mb-1">
                      系统设置
                    </div>
                    {settingsItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setShowSettingsDropdown(false);
                          navigate(item.path);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                          activeTab === item.id 
                            ? 'bg-[#F9F5EF] text-[#B28C5A] font-bold' 
                            : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {item.icon}
                          <span>{item.label}</span>
                        </div>
                        {activeTab === item.id && <ChevronRight size={14} className="text-[#B28C5A]" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 右侧：操作与设置 */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => navigate('/manwah')}
              className="flex sm:hidden items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#F9F5EF] text-[#B28C5A] border border-[#B28C5A]/30 text-xs font-bold transition-all"
            >
              <MonitorPlay size={15} />
              <span>工作流</span>
            </button>

            {/* 移动端独立设置按钮 */}
            <div className="relative sm:hidden">
              <button
                onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-all"
              >
                <Settings size={15} className="text-[#B28C5A]" />
                <ChevronDown size={12} className={`transition-transform duration-200 ${showSettingsDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showSettingsDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSettingsDropdown(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-stone-200/80 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-stone-400 uppercase tracking-wider border-b border-stone-100 mb-1">
                      系统设置
                    </div>
                    {settingsItems.map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setShowSettingsDropdown(false);
                          navigate(item.path);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                          activeTab === item.id 
                            ? 'bg-[#F9F5EF] text-[#B28C5A] font-bold' 
                            : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {item.icon}
                          <span>{item.label}</span>
                        </div>
                        {activeTab === item.id && <ChevronRight size={14} className="text-[#B28C5A]" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-all"
            >
              <UserCircle size={15} className="text-[#B28C5A]" />
              <span className="hidden sm:inline">个人中心</span>
            </button>
          </div>
        </header>
      )}

      <div className="flex-1 flex flex-col md:flex-row min-w-0">
        {/* ----------------- PC 端左侧栏 ----------------- */}
        {activeTab !== 'manwah' && (
          <aside className="hidden md:flex flex-col w-60 bg-white/80 backdrop-blur-xl border-r border-[#E5E0D8]/40 p-4 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
            <nav className="space-y-1 flex-1">
              <button 
                onClick={() => navigate('/manwah')} 
                className="w-full flex items-center justify-between p-3 rounded-2xl transition-all text-stone-500 hover:bg-stone-50 hover:text-stone-700"
              >
                <div className="flex items-center gap-3">
                  <MonitorPlay size={18} strokeWidth={2.5} />
                  <span className="text-sm font-semibold">工作流</span>
                </div>
              </button>

              <div className="pt-4 pb-2 px-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#B28C5A]/70">设置 Settings</span>
              </div>

              <div className="space-y-1">
                {settingsItems.map(item => (
                  <button 
                    key={item.id}
                    onClick={() => navigate(item.path)} 
                    className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all ${
                      activeTab === item.id 
                        ? 'bg-[#F9F5EF] text-[#B28C5A] font-bold shadow-xs' 
                        : 'text-stone-500 hover:bg-[#FDFBF7] hover:text-[#B28C5A]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.icon}
                      <span className="text-sm">{item.label}</span>
                    </div>
                    {activeTab === item.id && <div className="w-1.5 h-1.5 rounded-full bg-[#B28C5A]" />}
                  </button>
                ))}
              </div>
            </nav>
          </aside>
        )}

        {/* 主内容区域 */}
        <main className="flex-1 w-full min-w-0 overflow-x-hidden md:h-screen md:overflow-y-auto relative">
          <div className="fixed inset-0 pointer-events-none bg-gradient-to-br from-stone-50 via-[#FDFBF7] to-stone-100/50 -z-10" />
          {children}
        </main>
      </div>
    </div>
  );
}
