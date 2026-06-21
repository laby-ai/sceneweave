import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wand2, Copy, Check, Clock } from 'lucide-react';

interface SceneBuilderProps {
  onApply?: (prompt: string) => void;
}

const SUBJECT_TEMPLATES = [
  { value: 'custom', label: '自定义输入...' },
  { value: '一架白色无人机', label: '无人机' },
  { value: '一台工业机器人手臂', label: '机械臂' },
  { value: '一位工程师', label: '人物-工程师' },
  { value: '现代化生产线', label: '生产线' },
  { value: '精密电子元器件', label: '电子产品' },
  { value: '大型工业设备', label: '工业设备' },
];

const ACTION_TEMPLATES = [
  { value: 'custom', label: '自定义输入...' },
  { value: '在空中平稳飞行，镜头跟随侧拍', label: '飞行展示' },
  { value: '精准抓取零件，流畅完成装配动作', label: '精准操作' },
  { value: '专注地操作控制台，查看数据屏幕', label: '操作设备' },
  { value: '360度旋转展示，突出产品细节', label: '旋转展示' },
  { value: '快速运转，展示高效生产能力', label: '高速运转' },
  { value: '缓缓推进，聚焦核心部件特写', label: '特写推进' },
];

const ENVIRONMENT_TEMPLATES = [
  { value: 'custom', label: '自定义输入...' },
  { value: '现代化工业厂房内，背景可见精密设备', label: '工业厂房' },
  { value: '开阔的田野上空，蓝天白云背景', label: '户外自然' },
  { value: '高科技实验室，蓝色灯光氛围', label: '科技实验室' },
  { value: '城市CBD高楼背景，展现商务场景', label: '城市商务' },
  { value: '简洁纯色背景，突出主体', label: '简洁背景' },
  { value: '日落时分海边，温暖光线', label: '黄昏海边' },
];

const STYLE_TEMPLATES = [
  { value: 'custom', label: '自定义输入...' },
  { value: '科技工业风，冷蓝色调，未来感', label: '科技工业' },
  { value: '商务专业风，简洁大气，高端感', label: '商务专业' },
  { value: '清新自然风，明亮光线，活力感', label: '清新自然' },
  { value: '电影纪录片风，电影级调色', label: '电影纪实' },
  { value: '极简主义风，留白设计，纯粹感', label: '极简主义' },
  { value: '赛博朋克风，霓虹光效，科幻感', label: '赛博朋克' },
];

export function SceneBuilder({ onApply }: SceneBuilderProps) {
  const [duration, setDuration] = useState<number>(10);
  const [subject, setSubject] = useState('custom');
  const [customSubject, setCustomSubject] = useState('');
  const [action, setAction] = useState('custom');
  const [customAction, setCustomAction] = useState('');
  const [environment, setEnvironment] = useState('custom');
  const [customEnvironment, setCustomEnvironment] = useState('');
  const [style, setStyle] = useState('custom');
  const [customStyle, setCustomStyle] = useState('');
  const [additional, setAdditional] = useState('');
  const [copied, setCopied] = useState(false);

  const getFinalSubject = () => subject === 'custom' ? customSubject : subject;
  const getFinalAction = () => action === 'custom' ? customAction : action;
  const getFinalEnvironment = () => environment === 'custom' ? customEnvironment : environment;
  const getFinalStyle = () => style === 'custom' ? customStyle : style;

  const generatePrompt = () => {
    const parts = [
      `${duration}秒`,
      getFinalSubject(),
      getFinalAction(),
      getFinalEnvironment(),
      getFinalStyle(),
      additional,
    ].filter(Boolean);

    return parts.join('，');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatePrompt());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    onApply?.(generatePrompt());
  };

  const previewPrompt = generatePrompt();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wand2 className="w-5 h-5" />
          场景构建器
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 时长 — 预设按钮 + 手动输入 */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            视频时长
            <span className="text-xs font-normal opacity-50">(支持自定义)</span>
          </Label>

          {/* 快捷预设按钮 */}
          <div className="flex flex-wrap gap-1.5">
            {[5, 10, 20, 30].map((d) => (
              <Button
                key={d}
                variant={duration === d ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDuration(d)}
                className={`text-xs px-2.5 py-1 h-7 ${
                  duration === d
                    ? 'bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {d}s
              </Button>
            ))}
          </div>

          {/* 自定义时长输入 */}
          <div className="relative">
            <Input
              type="number"
              min={1}
              max={300}
              value={duration}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val >= 1 && val <= 300) {
                  setDuration(val);
                }
              }}
              onBlur={(e) => {
                const val = parseInt(e.target.value);
                if (isNaN(val) || val < 1) setDuration(10);
                else if (val > 300) setDuration(300);
              }}
              placeholder="输入秒数"
              className="h-8 pr-10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">秒</span>
          </div>

          {/* 自定义值提示 */}
          {!([5, 10, 20, 30].includes(duration)) && (
            <p className="text-xs text-primary/70">自定义时长：{duration}秒</p>
          )}
        </div>

        {/* 主体 */}
        <div className="space-y-2">
          <Label>主体/产品</Label>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger>
              <SelectValue placeholder="选择或自定义..." />
            </SelectTrigger>
            <SelectContent>
              {SUBJECT_TEMPLATES.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {subject === 'custom' && (
            <input
              type="text"
              placeholder="输入自定义主体，如：一台智能检测仪器"
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm mt-2"
            />
          )}
        </div>

        {/* 动作 */}
        <div className="space-y-2">
          <Label>动作/状态</Label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger>
              <SelectValue placeholder="选择或自定义..." />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TEMPLATES.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {action === 'custom' && (
            <input
              type="text"
              placeholder="输入自定义动作，如：悬浮在空中缓慢旋转"
              value={customAction}
              onChange={(e) => setCustomAction(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm mt-2"
            />
          )}
        </div>

        {/* 环境 */}
        <div className="space-y-2">
          <Label>环境背景</Label>
          <Select value={environment} onValueChange={setEnvironment}>
            <SelectTrigger>
              <SelectValue placeholder="选择或自定义..." />
            </SelectTrigger>
            <SelectContent>
              {ENVIRONMENT_TEMPLATES.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {environment === 'custom' && (
            <input
              type="text"
              placeholder="输入自定义环境，如：智能制造车间内"
              value={customEnvironment}
              onChange={(e) => setCustomEnvironment(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm mt-2"
            />
          )}
        </div>

        {/* 风格 */}
        <div className="space-y-2">
          <Label>视觉风格</Label>
          <Select value={style} onValueChange={setStyle}>
            <SelectTrigger>
              <SelectValue placeholder="选择或自定义..." />
            </SelectTrigger>
            <SelectContent>
              {STYLE_TEMPLATES.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {style === 'custom' && (
            <input
              type="text"
              placeholder="输入自定义风格，如：温暖生活化风格"
              value={customStyle}
              onChange={(e) => setCustomStyle(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm mt-2"
            />
          )}
        </div>

        {/* 补充描述 */}
        <div className="space-y-2">
          <Label>补充描述（可选）</Label>
          <Textarea
            placeholder="添加额外的细节描述，如镜头运动、光线效果等"
            value={additional}
            onChange={(e) => setAdditional(e.target.value)}
            className="min-h-[60px] text-sm"
          />
        </div>

        {/* 预览 */}
        <div className="space-y-2">
          <Label>生成的提示词</Label>
          <div className="p-3 bg-slate-100 rounded-md text-sm text-slate-800 border border-slate-200 min-h-[60px]">
            {previewPrompt || '请选择或输入内容生成提示词...'}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={!previewPrompt}
            className="flex-1"
          >
            {copied ? (
              <><Check className="w-4 h-4 mr-1" />已复制</>
            ) : (
              <><Copy className="w-4 h-4 mr-1" />复制</>
            )}
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            disabled={!previewPrompt}
            className="flex-1"
          >
            应用到表单
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
