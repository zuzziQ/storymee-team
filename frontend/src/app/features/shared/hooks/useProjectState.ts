import { useState, useEffect } from 'react';
import { Project, TeamMember } from '../../../constants';
import { coreApiClient } from '../../../../lib/apiClient';
import { API_ROUTES } from '@/lib/apiClient';
import { fetchAxios } from '@/lib/fetchAxios';

export function useProjectState() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('p4');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<'week' | 'next-week' | 'sprint'>('sprint');
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#6366f1');
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiProjectInsights, setAiProjectInsights] = useState<Record<string, string>>({});
  const [aiSuccessRate, setAiSuccessRate] = useState<Record<string, number>>({ p1: 75, p2: 60, p3: 80, p4: 90 });
  const [aiPredictedDate, setAiPredictedDate] = useState<Record<string, string>>({});

  // localStorage persistence for AI states
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedInsights = localStorage.getItem('storymee_ai_project_insights');
      if (savedInsights) setAiProjectInsights(JSON.parse(savedInsights));
      const savedRates = localStorage.getItem('storymee_ai_success_rate');
      if (savedRates) setAiSuccessRate(JSON.parse(savedRates));
      const savedDates = localStorage.getItem('storymee_ai_predicted_date');
      if (savedDates) setAiPredictedDate(JSON.parse(savedDates));
    }
  }, []);

  useEffect(() => { localStorage.setItem('storymee_ai_project_insights', JSON.stringify(aiProjectInsights)); }, [aiProjectInsights]);
  useEffect(() => { localStorage.setItem('storymee_ai_success_rate', JSON.stringify(aiSuccessRate)); }, [aiSuccessRate]);
  useEffect(() => { localStorage.setItem('storymee_ai_predicted_date', JSON.stringify(aiPredictedDate)); }, [aiPredictedDate]);

  const fetchProjectsData = async () => {
    try {
      const projectsData = await coreApiClient.get(API_ROUTES.PLANE.PROJECTS);
      if ((projectsData.status === 'success' || projectsData.success === true) && Array.isArray(projectsData.data)) {
        const mappedProjects = projectsData.data.map((p: any) => ({
          id: p.id,
          name: p.name,
          key: p.identifier || 'PROJ',
          description: p.description || '',
          color: p.color || '#6366f1',
          progress: 0,
          tasksCount: 0,
          completedCount: 0
        }));
        setProjects(mappedProjects);
        setActiveProjectId(prev => {
          if (prev && mappedProjects.some((p: any) => p.id === prev)) return prev;
          return mappedProjects[0]?.id || '';
        });
      }
    } catch (err) {
      console.error('Lỗi fetch projects:', err);
    }
  };

  const handleAddProject = async (onRefresh: () => void) => {
    if (!newProjectName.trim()) return;
    const newProj: Project = {
      id: `p-${Date.now()}`,
      name: newProjectName.trim(),
      description: newProjectDesc.trim() || 'Dự án mới tạo',
      color: newProjectColor,
      status: 'Active'
    } as any;
    setProjects(prev => [...prev, newProj]);
    setShowAddProjectModal(false);
    setNewProjectName('');
    setNewProjectDesc('');
    try {
      await coreApiClient.post(API_ROUTES.PLANE.PROJECTS, {
        name: newProj.name,
        description: newProj.description,
        color: newProj.color
      });
      onRefresh();
    } catch (err) {
      console.error('Lỗi tạo dự án:', err);
      alert('Không thể tạo dự án trên server.');
    }
  };

  const handleDeleteProject = async (id: string, onRefresh?: () => void) => {
    try {
      await coreApiClient.delete(`${API_ROUTES.PLANE.PROJECTS}/${id}`);
      setProjects(prev => prev.filter(p => p.id !== id));
      setActiveProjectId(prev => prev === id
        ? (projects.find(p => p.id !== id)?.id || '')
        : prev
      );
      onRefresh?.();
    } catch (err) {
      console.error('Lỗi xóa dự án:', err);
      alert('Không thể xóa dự án: ' + String(err));
    }
  };

  const handleUpdateProject = async (id: string, updates: Partial<Project>, onRefresh?: () => void) => {
    try {
      setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
      await coreApiClient.patch(`${API_ROUTES.PLANE.PROJECTS}/${id}`, updates);
      onRefresh?.();
    } catch (err) {
      console.error('Lỗi cập nhật dự án:', err);
    }
  };

  const handleAnalyzeProject = async (
    id: string,
    tasks: any[],
    teamMembers: TeamMember[],
    omniConfig: any
  ) => {
    setAiAnalyzing(true);
    try {
      const proj = projects.find(p => p.id === id);
      const res = await fetchAxios('/api/ai/project-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: proj,
          tasks: tasks.filter(t => t.projectId === id),
          team: teamMembers,
          config: omniConfig
        })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' || json.success === true) {
          setAiProjectInsights(prev => ({ ...prev, [id]: json.data.insights }));
          setAiSuccessRate(prev => ({ ...prev, [id]: json.data.successRate || 85 }));
          setAiPredictedDate(prev => ({ ...prev, [id]: json.data.predictedDeadline || '10/07/2026' }));
        }
      }
    } catch (err) {
      console.error('Lỗi phân tích dự án:', err);
    }
    setAiAnalyzing(false);
  };

  return {
    projects,
    setProjects,
    activeProjectId,
    setActiveProjectId,
    selectedProjectId,
    setSelectedProjectId,
    timeFilter,
    setTimeFilter,
    showAddProjectModal,
    setShowAddProjectModal,
    newProjectName,
    setNewProjectName,
    newProjectDesc,
    setNewProjectDesc,
    newProjectColor,
    setNewProjectColor,
    aiAnalyzing,
    aiProjectInsights,
    aiSuccessRate,
    aiPredictedDate,
    fetchProjectsData,
    handleAddProject,
    handleDeleteProject,
    handleUpdateProject,
    handleAnalyzeProject,
  };
}
