'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface UserTemplate {
  id: string;
  name: string;
  description: string;
  type: 'video' | 'image';
  category: string;
  tags: string[];
  promptTemplate?: string;
  prompt?: string;
  style?: string;
  mood?: string;
  isPublic: boolean;
  isOfficial?: boolean;
  usageCount: number;
  createdAt: number;
  createdBy?: string;
  isFavorite?: boolean;
  isLiked?: boolean;
  likesCount?: number;
  sharesCount?: number;
  collaborators?: string[];
  config?: Record<string, any>;
}

interface TemplateContextType {
  userTemplates: UserTemplate[];
  addTemplate: (template: Partial<Omit<UserTemplate, 'id' | 'createdAt' | 'usageCount'>> & { name: string; type: 'video' | 'image' }) => UserTemplate;
  updateTemplate: (id: string, updates: Partial<UserTemplate>) => void;
  deleteTemplate: (id: string) => void;
  getTemplateById: (id: string) => UserTemplate | undefined;
  incrementUsage: (id: string) => void;
}

const TemplateContext = createContext<TemplateContextType | undefined>(undefined);

export function TemplateProvider({ children }: { children: ReactNode }) {
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);

  // 从 localStorage 加载用户模板
  useEffect(() => {
    const savedTemplates = localStorage.getItem('user-templates');
    if (savedTemplates) {
      try {
        setUserTemplates(JSON.parse(savedTemplates));
      } catch (error) {
        console.error('Failed to parse user templates:', error);
      }
    }
  }, []);

  // 保存用户模板到 localStorage
  useEffect(() => {
    localStorage.setItem('user-templates', JSON.stringify(userTemplates));
  }, [userTemplates]);

  const addTemplate = (template: Partial<Omit<UserTemplate, 'id' | 'createdAt' | 'usageCount'>> & { name: string; type: 'video' | 'image' }): UserTemplate => {
    const newTemplate: UserTemplate = {
      description: '',
      category: '自定义',
      tags: [],
      isPublic: false,
      ...template,
      id: `template-${Date.now()}`,
      createdAt: Date.now(),
      usageCount: 0,
    };
    setUserTemplates(prev => [newTemplate, ...prev]);
    return newTemplate;
  };

  const updateTemplate = (id: string, updates: Partial<UserTemplate>) => {
    setUserTemplates(prev => prev.map(t => 
      t.id === id ? { ...t, ...updates } : t
    ));
  };

  const deleteTemplate = (id: string) => {
    setUserTemplates(prev => prev.filter(t => t.id !== id));
  };

  const getTemplateById = (id: string): UserTemplate | undefined => {
    return userTemplates.find(t => t.id === id);
  };

  const incrementUsage = (id: string) => {
    setUserTemplates(prev => prev.map(t => 
      t.id === id ? { ...t, usageCount: t.usageCount + 1 } : t
    ));
  };

  return (
    <TemplateContext.Provider value={{
      userTemplates,
      addTemplate,
      updateTemplate,
      deleteTemplate,
      getTemplateById,
      incrementUsage,
    }}>
      {children}
    </TemplateContext.Provider>
  );
}

export function useTemplates() {
  const context = useContext(TemplateContext);
  if (context === undefined) {
    throw new Error('useTemplates must be used within a TemplateProvider');
  }
  return context;
}
