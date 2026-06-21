"use client";

import { AlertTriangle, Clapperboard, Shield, X } from 'lucide-react';

export interface FilmDirectorAnalysis {
  contentType: string;
  totalShots: number;
  estimatedDuration: number;
  emotionCurve: string;
  modelRecommendation: { video: string; image: string; llm: string };
  styleTags: string[];
  riskNotes: string[];
  cameraDirections?: string[];
  transitionStyles?: string[];
}

export interface FilmComplianceResult {
  overallRisk: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  issues: Array<{
    category: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    legalBasis: string;
    suggestion: string;
  }>;
  piiDetected: { type: string; value: string; position: number }[];
  watermarkRequired: boolean;
  labelRequired: boolean;
  summary: string;
}

const isHighRisk = (risk: FilmComplianceResult['overallRisk'] | FilmComplianceResult['issues'][number]['riskLevel']) =>
  risk === 'high' || risk === 'critical';

export function FilmDirectorAnalysisPanel({
  analysis,
  onClose,
}: {
  analysis: FilmDirectorAnalysis;
  onClose: () => void;
}) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clapperboard className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-primary">自动化导演方案</span>
        </div>
        <button
          onClick={onClose}
          className="text-foreground/30 hover:text-foreground/60 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div className="rounded-lg bg-background/60 p-2 text-center">
          <div className="text-foreground/40">内容类型</div>
          <div className="font-semibold text-foreground/80 mt-0.5">{analysis.contentType}</div>
        </div>
        <div className="rounded-lg bg-background/60 p-2 text-center">
          <div className="text-foreground/40">镜头数</div>
          <div className="font-semibold text-foreground/80 mt-0.5">{analysis.totalShots} 镜</div>
        </div>
        <div className="rounded-lg bg-background/60 p-2 text-center">
          <div className="text-foreground/40">预估时长</div>
          <div className="font-semibold text-foreground/80 mt-0.5">{analysis.estimatedDuration}s</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-[10px]">
        <span className="text-foreground/40">情感曲线:</span>
        <span className="font-medium text-foreground/70">{analysis.emotionCurve}</span>
      </div>
      {analysis.styleTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
          <span className="text-foreground/40">风格标签:</span>
          {analysis.styleTags.map((tag, i) => (
            <span key={i} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary/70 text-[9px]">{tag}</span>
          ))}
        </div>
      )}
      {analysis.riskNotes.length > 0 && (
        <div className="space-y-1 text-[10px]">
          <span className="text-foreground/40">优化建议:</span>
          {analysis.riskNotes.map((note, i) => (
            <div key={i} className="flex items-start gap-1 text-red-600/70">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{note}</span>
            </div>
          ))}
        </div>
      )}
      {analysis.cameraDirections?.length ? (
        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
          <span className="text-foreground/40">摄像机:</span>
          {analysis.cameraDirections.map((dir, i) => (
            <span key={i} className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-600/70 text-[9px]">{dir}</span>
          ))}
        </div>
      ) : null}
      {analysis.transitionStyles?.length ? (
        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
          <span className="text-foreground/40">转场:</span>
          {analysis.transitionStyles.map((transition, i) => (
            <span key={i} className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-600/70 text-[9px]">{transition}</span>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-2 text-[10px] text-foreground/40">
        <span>推荐模型:</span>
        <span className="text-foreground/60">视频={analysis.modelRecommendation.video}</span>
        <span className="text-foreground/60">图像={analysis.modelRecommendation.image}</span>
        <span className="text-foreground/60">LLM={analysis.modelRecommendation.llm}</span>
      </div>
    </div>
  );
}

export function FilmCompliancePanel({ result }: { result: FilmComplianceResult }) {
  const highRisk = isHighRisk(result.overallRisk);
  const mediumRisk = result.overallRisk === 'medium';

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${
      highRisk ? 'border-red-500/30 bg-red-500/5' :
      mediumRisk ? 'border-amber-500/30 bg-amber-500/5' :
      'border-green-500/30 bg-green-500/5'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className={`w-4 h-4 ${
            highRisk ? 'text-red-500' :
            mediumRisk ? 'text-amber-500' :
            'text-green-500'
          }`} />
          <span className={`text-xs font-semibold ${
            highRisk ? 'text-red-600' :
            mediumRisk ? 'text-amber-600' :
            'text-green-600'
          }`}>
            AIGC 合规检测
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
            highRisk ? 'bg-red-500/15 text-red-600' :
            mediumRisk ? 'bg-amber-500/15 text-amber-600' :
            'bg-green-500/15 text-green-600'
          }`}>
            {highRisk ? '高风险' :
             mediumRisk ? '中风险' :
             result.overallRisk === 'low' ? '低风险' : '合规/安全'}
          </span>
        </div>
      </div>

      {result.issues.length > 0 && (
        <div className="space-y-1.5">
          {result.issues.map((issue, i) => (
            <div key={i} className="rounded-lg bg-background/60 p-2 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isHighRisk(issue.riskLevel) ? 'bg-red-500' :
                  issue.riskLevel === 'medium' ? 'bg-amber-500' : 'bg-green-500'
                }`} />
                <span className="text-[10px] font-medium text-foreground/80">{issue.category}</span>
                <span className="text-[9px] text-foreground/40 ml-auto">{issue.legalBasis}</span>
              </div>
              <p className="text-[10px] text-foreground/60 pl-3">{issue.description}</p>
              {issue.suggestion && (
                <p className="text-[10px] text-primary/70 pl-3">建议: {issue.suggestion}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {result.summary && (
        <p className="text-[10px] text-foreground/50 italic">{result.summary}</p>
      )}
    </div>
  );
}
