import React from 'react';
import { X, MessageSquare } from 'lucide-react';
import { TeamMember, Task, Priority } from '../../constants';
import { ChatWidgetContent } from './components/ChatWidgetContent';

export default function AiChatSidebar({
  currentUser,
  tasks,
  onUpdate,
  onCreateTask,
  chatOpen,
  setChatOpen,
  chatLayout,
  setChatLayout,
  onAddRoutingLog,
  omniConfig,
  rawMarkdownRules
}: {
  currentUser: TeamMember;
  tasks: Task[];
  onUpdate?: (t: Task) => void;
  onCreateTask?: (title: string, assignee: string, estimate: number, priority: Priority) => void;
  chatOpen: boolean;
  setChatOpen: (o: boolean) => void;
  chatLayout: 'popup' | 'sidebar';
  setChatLayout: (l: 'popup' | 'sidebar') => void;
  onAddRoutingLog?: (log: any, sentTokens: number) => void;
  omniConfig?: any;
  rawMarkdownRules?: string;
}) {
  return (
    <>
      <button 
        className="chat-bubble-btn" 
        onClick={() => setChatOpen(!chatOpen)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99
        }}
      >
        {chatOpen ? <X size={22} color="white" /> : <MessageSquare size={22} color="white" />}
      </button>

      {chatOpen && chatLayout === 'popup' && (
        <div 
          className="chat-bubble" 
          style={{ 
            position: 'fixed',
            bottom: 90,
            right: 24,
            width: 450,
            height: 480,
            zIndex: 100,
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.08)'
          }}
        >
          <ChatWidgetContent
            currentUser={currentUser}
            tasks={tasks}
            onUpdate={onUpdate}
            onCreateTask={onCreateTask}
            onClose={() => setChatOpen(false)}
            chatLayout={chatLayout}
            setChatLayout={setChatLayout}
            onAddRoutingLog={onAddRoutingLog}
            omniConfig={omniConfig}
            rawMarkdownRules={rawMarkdownRules}
          />
        </div>
      )}
    </>
  );
}
