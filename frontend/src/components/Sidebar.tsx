'use client';

import React from 'react';
import { useApp, TabType } from './AppContext';
import { 
  LayoutDashboard, 
  KanbanSquare, 
  Bot, 
  Milestone, 
  Calendar, 
  FileText, 
  Activity, 
  Users, 
  Settings,
  Zap
} from 'lucide-react';

export default function Sidebar() {
  const { activeTab, setActiveTab } = useApp();

  const menuGroups = [
    {
      title: 'Giám sát & Kế hoạch',
      items: [
        { id: 'overview', name: 'Sprint Planner', icon: LayoutDashboard },
        { id: 'milestones', name: 'Milestones Gantt', icon: Milestone },
      ]
    },
    {
      title: 'Công việc',
      items: [
        { id: 'kanban', name: 'Kanban Board', icon: KanbanSquare },
        { id: 'ai-chat', name: 'LangGraph Chat', icon: Bot, highlight: true },
      ]
    },
    {
      title: 'Quản trị nhân sự (HR)',
      items: [
        { id: 'attendance', name: 'HR Điểm danh', icon: Calendar },
        { id: 'leave', name: 'Phê duyệt phép', icon: FileText },
        { id: 'workload', name: 'Ma trận tải trọng', icon: Activity },
        { id: 'team', name: 'Team Members', icon: Users },
      ]
    },
    {
      title: 'Hệ thống',
      items: [
        { id: 'config', name: 'Cấu hình System', icon: Settings },
      ]
    }
  ];

  return (
    <div className="w-64 bg-[#0a0a0c] border-r border-[#1f2023] h-screen flex flex-col text-neutral-400 select-none sticky top-0 shrink-0">
      
      {/* Brand logo Area */}
      <div className="flex items-center gap-3 p-6 border-b border-[#1f2023]">
        <div className="h-7 w-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/10">
          <Zap className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="font-black text-xs tracking-tight text-white uppercase font-mono">StoryMee Team</span>
          <span className="text-[9px] text-neutral-500 tracking-wider font-bold">Orchestrator Panel</span>
        </div>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {menuGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-2">
            <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest block px-2.5">
              {group.title}
            </span>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as TabType)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                      isActive
                        ? item.highlight
                          ? 'bg-indigo-650/20 text-indigo-300 border-indigo-500/30'
                          : 'bg-neutral-900 text-white border-neutral-800'
                        : 'text-neutral-500 hover:text-neutral-350 border-transparent hover:bg-neutral-950/60'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${
                      isActive ? 'text-indigo-400' : 'text-neutral-500'
                    }`} />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Footer Info */}
      <div className="p-4 border-t border-[#1f2023] text-center text-[9px] font-mono text-neutral-650">
        <span>StoryMee © 2026</span>
      </div>
    </div>
  );
}
