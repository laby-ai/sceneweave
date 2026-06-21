'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  TrendingUp, 
  Lightbulb, 
  Star, 
  Clock,
  Zap,
  Heart,
  RefreshCw
} from 'lucide-react';
import { useVideoHistory } from '@/hooks/useVideoHistory';

interface Recommendation {
  id: string;
  type: 'prompt' | 'style' | 'mood' | 'filter' | 'color';
  title: string;
  description: string;
  content: string;
  reason: string;
  icon: string;
}

const STYLE_RECOMMENDATIONS = [
  { title: '水墨丹青', description: '中国传统水墨画风格', reason: '根据您喜欢的山水风景推荐' },
  { title: '赛博朋克', description: '未来都市霓虹风格', reason: '热门趋势推荐' },
  { title: '极简主义', description: '简洁现代的设计风格', reason: '基于您历史偏好' },
  { title: '梦幻童话', description: '温暖可爱的童话风格', reason: '高人气推荐' },
];

const PROMPT_RECOMMENDATIONS = [
  { title: '星空下的城市', description: '夜晚璀璨的都市风景', reason: '热门生成主题' },
  { title: '神秘森林小屋', description: '奇幻的森林场景', reason: '根据您的历史推荐' },
  { title: '未来科技实验室', description: '充满科技感的场景', reason: '趋势推荐' },
  { title: '海边日落', description: '美丽的海边黄昏', reason: '经典热门主题' },
];

const COLOR_RECOMMENDATIONS = [
  { title: '暖金色调', description: '温暖的金色和橙色', reason: '温暖舒适' },
  { title: '极光色彩', description: '神秘的极光配色', reason: '梦幻效果' },
  { title: '莫兰迪色', description: '柔和的低饱和度配色', reason: '高级质感' },
];

export function SmartRecommendations({ 
  onSelectRecommendation 
}: { 
  onSelectRecommendation?: (content: string, type: string) => void 
}) {
  const { videoHistory, imageHistory } = useVideoHistory();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const generateRecommendations = () => {
    setIsRefreshing(true);
    
    setTimeout(() => {
      const newRecs: Recommendation[] = [];
      
      // 根据历史生成推荐
      const hasVideos = videoHistory.length > 0;
      const hasImages = imageHistory.length > 0;
      
      // 提示词推荐
      PROMPT_RECOMMENDATIONS.slice(0, 2).forEach((rec, index) => {
        newRecs.push({
          id: `prompt-${index}`,
          type: 'prompt',
          title: rec.title,
          description: rec.description,
          content: rec.description,
          reason: rec.reason,
          icon: '💡',
        });
      });
      
      // 风格推荐
      STYLE_RECOMMENDATIONS.slice(0, 2).forEach((rec, index) => {
        newRecs.push({
          id: `style-${index}`,
          type: 'style',
          title: rec.title,
          description: rec.description,
          content: rec.title,
          reason: rec.reason,
          icon: '🎨',
        });
      });
      
      // 颜色推荐
      COLOR_RECOMMENDATIONS.slice(0, 1).forEach((rec, index) => {
        newRecs.push({
          id: `color-${index}`,
          type: 'color',
          title: rec.title,
          description: rec.description,
          content: rec.title,
          reason: rec.reason,
          icon: '🌈',
        });
      });
      
      // 如果是新用户，添加更多推荐
      if (!hasVideos && !hasImages) {
        newRecs.push({
          id: 'welcome',
          type: 'prompt',
          title: '开始您的创作',
          description: '一只可爱的猫咪在阳光下玩耍',
          content: '一只可爱的猫咪在阳光下玩耍，毛发蓬松，眼神温柔',
          reason: '新用户推荐',
          icon: '🐱',
        });
      }
      
      setRecommendations(newRecs);
      setIsRefreshing(false);
    }, 500);
  };

  useEffect(() => {
    generateRecommendations();
  }, []);

  const handleSelect = (rec: Recommendation) => {
    if (onSelectRecommendation) {
      onSelectRecommendation(rec.content, rec.type);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'prompt':
        return <Badge variant="secondary" className="bg-red-100 text-red-700">提示词</Badge>;
      case 'style':
        return <Badge variant="secondary" className="bg-red-100 text-red-700">风格</Badge>;
      case 'color':
        return <Badge variant="secondary" className="bg-rose-100 text-rose-700">配色</Badge>;
      default:
        return <Badge variant="secondary">推荐</Badge>;
    }
  };

  const getIconComponent = (icon: string) => {
    switch (icon) {
      case '💡': return <Lightbulb className="w-4 h-4" />;
      case '🎨': return <Sparkles className="w-4 h-4" />;
      case '🌈': return <Zap className="w-4 h-4" />;
      case '🐱': return <Heart className="w-4 h-4" />;
      default: return <Star className="w-4 h-4" />;
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-red-500" />
            智能推荐
          </h3>
          <p className="text-sm text-muted-foreground">
            基于您的偏好和热门趋势生成的个性化推荐
          </p>
        </div>
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={generateRecommendations}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          换一批
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recommendations.map((rec) => (
          <Card 
            key={rec.id}
            className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
            onClick={() => handleSelect(rec)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-xl">{rec.icon}</div>
                  {getTypeBadge(rec.type)}
                </div>
                <Badge variant="secondary" className="text-xs">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  推荐
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-base mb-1">{rec.title}</CardTitle>
              <CardDescription className="text-sm mb-2 line-clamp-2">
                {rec.description}
              </CardDescription>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{rec.reason}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {recommendations.length === 0 && (
        <div className="text-center py-8">
          <div className="inline-block p-4 bg-muted/50 rounded-full mb-4">
            <Sparkles className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">正在为您生成推荐...</p>
        </div>
      )}
    </div>
  );
}
