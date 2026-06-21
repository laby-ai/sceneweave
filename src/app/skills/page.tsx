'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Search, Sparkles, ArrowLeft, Star, Clock, TrendingUp, 
  Zap, Brain, Sparkle, Layers, Rocket
} from 'lucide-react';
import { SKILLS, SKILL_CATEGORIES, TEMPLATES, type Skill, type Template } from '@/constants/skills';
import { useTheme } from '@/contexts/ThemeContext';

export default function SkillsPage() {
  const router = useRouter();
  const { themeGradient } = useTheme();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('skills');

  // 过滤技能
  const filteredSkills = SKILLS.filter(skill => {
    const matchesCategory = activeCategory === 'all' || skill.category === activeCategory;
    const matchesSearch = !searchQuery || 
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredSkills = SKILLS.filter(skill => skill.featured);
  const popularTemplates = [...TEMPLATES].sort((a, b) => b.usageCount - a.usageCount).slice(0, 4);

  const handleSkillClick = (skill: Skill) => {
    // 这里可以跳转到具体的技能页面或打开对话框
    console.log('打开技能:', skill);
    alert(`打开技能：${skill.name}\n\n功能开发中，敬请期待！`);
  };

  const handleTemplateClick = (template: Template) => {
    console.log('使用模板:', template);
    alert(`使用模板：${template.name}\n\n模板内容：\n${template.prompt}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <nav className="bg-white/80 backdrop-blur-xl border-b shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push('/')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                返回首页
              </Button>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5" style={{ color: `var(--primary)` }} />
                  AI技能中心
                </h1>
                <p className="text-xs text-muted-foreground">探索所有AI能力，释放创意潜能</p>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Search Bar */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="搜索技能、模板或功能..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
            />
          </div>
        </div>

        {/* Featured Section */}
        {!searchQuery && activeCategory === 'all' && (
          <div className="mb-8">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-red-500" />
              精选技能
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredSkills.map((skill) => (
                <Card 
                  key={skill.id}
                  className="cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2"
                  onClick={() => handleSkillClick(skill)}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${skill.color} flex items-center justify-center text-2xl`}>
                        {skill.icon}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-base mb-1">{skill.name}</CardTitle>
                        <CardDescription className="text-xs">{skill.description}</CardDescription>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        <Sparkle className="w-3 h-3 mr-1" />
                        热门
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="skills" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              AI技能
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              模板库
            </TabsTrigger>
          </TabsList>

          {/* Skills Tab */}
          <TabsContent value="skills" className="space-y-6">
            {/* Category Filter */}
            <div className="flex flex-wrap gap-2 justify-center">
              {SKILL_CATEGORIES.map((category) => (
                <Button
                  key={category.id}
                  variant={activeCategory === category.id ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setActiveCategory(category.id)}
                  className="flex items-center gap-1"
                >
                  <span>{category.icon}</span>
                  {category.name}
                </Button>
              ))}
            </div>

            {/* Skills Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredSkills.map((skill) => (
                <Card 
                  key={skill.id}
                  className="cursor-pointer hover:shadow-lg transition-all duration-200 group"
                  onClick={() => handleSkillClick(skill)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${skill.color} flex items-center justify-center text-xl group-hover:scale-110 transition-transform`}>
                        {skill.icon}
                      </div>
                      {skill.featured && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="w-3 h-3 mr-1 text-red-500" />
                          精选
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardTitle className="text-sm mb-1">{skill.name}</CardTitle>
                    <CardDescription className="text-xs line-clamp-2">
                      {skill.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredSkills.length === 0 && (
              <div className="text-center py-16">
                <div className="inline-block p-6 bg-muted/50 rounded-full mb-4">
                  <Search className="w-12 h-12 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-lg">没有找到相关技能</p>
                <p className="text-sm text-muted-foreground mt-2">试试其他关键词</p>
              </div>
            )}
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-6">
            {/* Popular Templates */}
            {!searchQuery && (
              <div className="mb-6">
                <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-red-500" />
                  热门模板
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {popularTemplates.map((template) => (
                    <Card 
                      key={template.id}
                      className="cursor-pointer hover:shadow-lg transition-all duration-200"
                      onClick={() => handleTemplateClick(template)}
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-xl">
                            {template.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm mb-1">{template.name}</CardTitle>
                            <CardDescription className="text-xs line-clamp-2">
                              {template.description}
                            </CardDescription>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="secondary" className="text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                {template.usageCount}次使用
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* All Templates */}
            <div>
              <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4" />
                所有模板
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {TEMPLATES
                  .filter(t => !searchQuery || 
                    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    t.description.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((template) => (
                    <Card 
                      key={template.id}
                      className="cursor-pointer hover:shadow-lg transition-all duration-200"
                      onClick={() => handleTemplateClick(template)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-500 to-red-500 flex items-center justify-center text-xl">
                            {template.icon}
                          </div>
                          <div>
                            <CardTitle className="text-sm">{template.name}</CardTitle>
                            <CardDescription className="text-xs">{template.category}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardDescription className="text-xs mb-3">{template.description}</CardDescription>
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-xs">
                            <Rocket className="w-3 h-3 mr-1" />
                            {template.usageCount}次使用
                          </Badge>
                          <Button size="sm" variant="secondary">
                            使用
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
