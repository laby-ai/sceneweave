'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Package, Plus, Trash2, CheckSquare, Square, Play, FileText,
  Image as ImageIcon, Eye, Download, X, Loader2, RefreshCw,
  ChevronDown, Filter, ZoomIn, Wand2, LayoutGrid, List,
  Users, MapPin, Wrench, AlertCircle, Check, Clock, AlertTriangle
} from 'lucide-react';
import { formatProviderError, getBYOKRequestHeaders, hasBYOKConnectionConfigured } from '@/lib/byok-client';
import { confirmImageGenerationPlan } from '@/lib/generation-cost-guard';

/* ========== Types ========== */
interface AssetItem {
  id: string;
  name: string;
  type: 'character' | 'scene' | 'prop';
  description: string;
  promptZh: string;
  promptEn: string;
  status: 'pending' | 'prompt_ready' | 'generating' | 'generated' | 'error';
  imageUrl?: string;
  errorMessage?: string;
  selected?: boolean;
}

interface AssetWorkshopProps {
  onBack?: () => void;
  initialStoryText?: string;
}

/* ========== Constants ========== */
const TYPE_CONFIG = {
  character: { label: '角色', icon: Users, color: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400', borderColor: 'border-orange-200 dark:border-orange-500/30' },
  scene: { label: '场景', icon: MapPin, color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400', borderColor: 'border-blue-200 dark:border-blue-500/30' },
  prop: { label: '道具', icon: Wrench, color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400', borderColor: 'border-purple-200 dark:border-purple-500/30' },
};

const MODEL_OPTIONS = [
  { id: 'ark-seedream-image', label: 'Ark Seedream', desc: '主链路生成' },
  { id: 'byok-image', label: 'BYOK Image', desc: '自定义模型' },
];

const RESOLUTION_OPTIONS = [
  { id: '1k', label: '1K', desc: '1024×1024' },
  { id: '1.5k', label: '1.5K', desc: '1536×1024' },
  { id: '2k', label: '2K', desc: '2048×2048' },
];

/* ========== Component ========== */
export function AssetWorkshop({ onBack, initialStoryText }: AssetWorkshopProps) {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [storyText, setStoryText] = useState(initialStoryText || '');
  const [selectedModel, setSelectedModel] = useState('ark-seedream-image');
  const [selectedResolution, setSelectedResolution] = useState('1k');
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set(['character', 'scene', 'prop']));
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [currentGenIndex, setCurrentGenIndex] = useState(-1);
  const [currentGenTotal, setCurrentGenTotal] = useState(0);
  const [previewAsset, setPreviewAsset] = useState<AssetItem | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', type: 'character' as AssetItem['type'], description: '' });
  const [storyParsed, setStoryParsed] = useState(false);
  const [parseProgress, setParseProgress] = useState('');
  const abortRef = useRef(false);

  /* ---- Computed ---- */
  const filteredAssets = assets.filter(a => filterTypes.has(a.type));
  const selectedCount = filteredAssets.filter(a => a.selected).length;
  const readyImageCount = filteredAssets.filter(a => (a.status === 'prompt_ready' || a.status === 'error') && a.selected && a.promptEn).length;
  const totalAssets = assets.length;
  const pendingCount = assets.filter(a => a.status === 'pending').length;
  const promptReadyCount = assets.filter(a => a.status === 'prompt_ready').length;
  const generatedCount = assets.filter(a => a.status === 'generated').length;
  const errorCount = assets.filter(a => a.status === 'error').length;

  /* ---- Parse Story → Assets ---- */
  const handleParseStory = useCallback(async () => {
    if (!storyText.trim()) return;
    setIsGeneratingPrompts(true);
    setParseProgress('正在分析故事，提取角色/场景/道具...');
    abortRef.current = false;

    try {
      // Step 1: Extract characters
      setParseProgress('正在提取角色设定...');
      const charRes = await fetch('/api/film/character-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
        body: JSON.stringify({ text: storyText, style: '通用' }),
      });
      const charData = await charRes.json();
      const characters: AssetItem[] = (charData.characters || []).map((c: Record<string, string>, i: number) => ({
        id: `char-${Date.now()}-${i}`,
        name: c.name || `角色${i + 1}`,
        type: 'character' as const,
        description: c.appearance || c.personality || '',
        promptZh: c.outfit ? `${c.appearance}\n${c.outfit}` : c.appearance || '',
        promptEn: c.prompt_en || '',
        status: 'prompt_ready' as const,
        selected: false,
      }));

      if (abortRef.current) return;
      setAssets(prev => [...prev, ...characters]);

      // Step 2: Extract scenes
      setParseProgress('正在提取场景设定...');
      const sceneRes = await fetch('/api/film/scene-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
        body: JSON.stringify({ text: storyText }),
      });
      const sceneData = await sceneRes.json();
      const scenes: AssetItem[] = (sceneData.scenes || []).map((s: Record<string, string>, i: number) => ({
        id: `scene-${Date.now()}-${i}`,
        name: s.name || `场景${i + 1}`,
        type: 'scene' as const,
        description: s.description || '',
        promptZh: s.description || '',
        promptEn: s.prompt_en || s.description_en || '',
        status: 'prompt_ready' as const,
        selected: false,
      }));

      if (abortRef.current) return;
      setAssets(prev => [...prev, ...scenes]);

      // Step 3: Extract props
      setParseProgress('正在提取道具设定...');
      const propRes = await fetch('/api/film/prop-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
        body: JSON.stringify({ text: storyText }),
      });
      const propData = await propRes.json();
      const props: AssetItem[] = (propData.props || []).map((p: Record<string, string>, i: number) => ({
        id: `prop-${Date.now()}-${i}`,
        name: p.name || `道具${i + 1}`,
        type: 'prop' as const,
        description: p.description || '',
        promptZh: p.description || '',
        promptEn: p.prompt_en || p.description_en || '',
        status: 'prompt_ready' as const,
        selected: false,
      }));

      if (abortRef.current) return;
      setAssets(prev => [...prev, ...props]);
      setStoryParsed(true);
      setParseProgress(`解析完成！共提取 ${characters.length} 个角色、${scenes.length} 个场景、${props.length} 个道具`);
    } catch (err) {
      setParseProgress('解析失败，请重试');
      console.error('[AssetWorkshop] parse error:', err);
    } finally {
      setIsGeneratingPrompts(false);
    }
  }, [storyText]);

  /* ---- Batch Generate Prompts ---- */
  const handleBatchGenPrompts = useCallback(async () => {
    const pendingAssets = filteredAssets.filter(a => a.status === 'pending' && a.selected);
    if (pendingAssets.length === 0) return;
    setIsGeneratingPrompts(true);
    abortRef.current = false;

    for (const asset of pendingAssets) {
      if (abortRef.current) break;
      try {
        const endpoint = asset.type === 'character' ? '/api/film/character-prompt'
          : asset.type === 'scene' ? '/api/film/scene-generate'
          : '/api/film/prop-generate';
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
          body: JSON.stringify({ text: `${asset.name}: ${asset.description}`, style: '通用' }),
        });
        const data = await res.json();
        const extracted = asset.type === 'character' ? data.characters?.[0]
          : asset.type === 'scene' ? data.scenes?.[0]
          : data.props?.[0];

        if (extracted) {
          setAssets(prev => prev.map(a => a.id === asset.id ? {
            ...a,
            promptZh: extracted.appearance || extracted.description || a.promptZh || a.description,
            promptEn: extracted.prompt_en || extracted.description_en || '',
            status: 'prompt_ready' as const,
            selected: false,
          } : a));
        }
      } catch {
        setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, status: 'error' as const, errorMessage: '提示词生成失败' } : a));
      }
    }
    setIsGeneratingPrompts(false);
  }, [filteredAssets]);

  /* ---- Batch Generate Images ---- */
  const handleBatchGenImages = useCallback(async () => {
    const readyAssets = filteredAssets.filter(a => (a.status === 'prompt_ready' || a.status === 'error') && a.selected && a.promptEn);
    if (readyAssets.length === 0) return;

    const shouldContinue = confirmImageGenerationPlan({
      imageCount: readyAssets.length,
      actionLabel: '批量生成素材参考图',
      scopeLabel: `${readyAssets.length} 个已选且具备提示词的资产`,
      usesBYOK: hasBYOKConnectionConfigured(),
    });
    if (!shouldContinue) return;

    setIsGeneratingImages(true);
    setCurrentGenTotal(readyAssets.length);
    abortRef.current = false;

    for (let i = 0; i < readyAssets.length; i++) {
      if (abortRef.current) break;
      const asset = readyAssets[i];
      setCurrentGenIndex(i);
      setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, status: 'generating' as const } : a));

      try {
        // Generate the appropriate type of reference image
        let prompt = asset.promptEn;
        if (asset.type === 'character') {
          prompt = `Character design reference sheet of ${asset.name}, ${prompt}, turnaround sheet showing head portrait, front view, 3/4 side view and back view, plain white background, consistent character design, detailed`;
        } else if (asset.type === 'scene') {
          prompt = `Scene reference sheet of ${asset.name}, ${prompt}, 4 variations in 2x2 grid: top-left daytime wide shot, top-right nighttime mood shot, bottom-left close-up detail, bottom-right aerial overview, consistent style`;
        } else {
          prompt = `Prop reference sheet of ${asset.name}, ${prompt}, 4 views in 2x2 grid: front view, side view, detail close-up, in-use context, plain white background, product photography style`;
        }

        const res = await fetch('/api/image/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getBYOKRequestHeaders() },
          body: JSON.stringify({ prompt, size: '1536x1024' }),
        });
        const data = await res.json();

        if (data.imageUrls?.[0] || data.imageUrl) {
          setAssets(prev => prev.map(a => a.id === asset.id ? {
            ...a,
            imageUrl: data.imageUrls?.[0] || data.imageUrl,
            status: 'generated' as const,
            selected: false,
          } : a));
        } else {
          throw new Error(formatProviderError(data, '图片生成失败'));
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '图片生成失败';
        setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, status: 'error' as const, errorMessage: msg, selected: false } : a));
      }
    }
    setIsGeneratingImages(false);
    setCurrentGenIndex(-1);
    setCurrentGenTotal(0);
  }, [filteredAssets]);

  /* ---- Selection helpers ---- */
  const toggleSelect = (id: string) => setAssets(prev => prev.map(a => a.id === id ? { ...a, selected: !a.selected } : a));
  const selectAll = () => setAssets(prev => prev.map(a => ({ ...a, selected: true })));
  const selectByStatus = (status: AssetItem['status'] | 'no_prompt') => {
    setAssets(prev => prev.map(a => ({
      ...a,
      selected: status === 'no_prompt' ? (!a.promptEn && a.status === 'pending') : a.status === status,
    })));
  };
  const invertSelection = () => setAssets(prev => prev.map(a => ({ ...a, selected: !a.selected })));
  const deselectAll = () => setAssets(prev => prev.map(a => ({ ...a, selected: false })));
  const deleteSelected = () => setAssets(prev => prev.filter(a => !a.selected));

  /* ---- Add Asset ---- */
  const handleAddAsset = () => {
    if (!addForm.name.trim()) return;
    const newAsset: AssetItem = {
      id: `manual-${Date.now()}`,
      name: addForm.name.trim(),
      type: addForm.type,
      description: addForm.description,
      promptZh: addForm.description,
      promptEn: '',
      status: 'pending',
      selected: false,
    };
    setAssets(prev => [...prev, newAsset]);
    setAddForm({ name: '', type: 'character', description: '' });
    setShowAddDialog(false);
  };

  /* ---- Cancel ---- */
  const handleCancel = () => { abortRef.current = true; };

  /* ---- Save to localStorage ---- */
  useEffect(() => {
    if (assets.length > 0) {
      localStorage.setItem('asset-workshop-assets', JSON.stringify(assets));
    }
  }, [assets]);

  useEffect(() => {
    const saved = localStorage.getItem('asset-workshop-assets');
    if (saved) {
      try { setAssets(JSON.parse(saved)); setStoryParsed(true); } catch { /* ignore */ }
    }
  }, []);

  /* ========== RENDER ========== */
  return (
    <div className="fixed inset-0 z-50 bg-[var(--background)] flex flex-col">
      {/* ---- Top Bar ---- */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-[#EF4444] hover:text-[#DC2626] font-medium flex items-center gap-1">
            ← 返回
          </button>
          <div className="w-px h-6 bg-[var(--border)]" />
          <Package className="w-5 h-5 text-[#EF4444]" />
          <h1 className="font-bold text-lg">资产工坊</h1>
          {totalAssets > 0 && (
            <span className="bg-[#EF4444] text-white text-xs px-2 py-0.5 rounded-full">{totalAssets}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {viewMode === 'grid' ? (
            <button onClick={() => setViewMode('list')} className="p-1.5 rounded hover:bg-[var(--accent)]"><List className="w-4 h-4" /></button>
          ) : (
            <button onClick={() => setViewMode('grid')} className="p-1.5 rounded hover:bg-[var(--accent)]"><LayoutGrid className="w-4 h-4" /></button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ==== Left Panel: Batch Controls ==== */}
        <div className="w-72 border-r border-[var(--border)] bg-[var(--card)] flex flex-col overflow-y-auto shrink-0">
          {/* Story Input */}
          <div className="p-4 border-b border-[var(--border)]">
            <label className="text-sm font-semibold mb-2 block">故事文本</label>
            <textarea
              value={storyText}
              onChange={e => { setStoryText(e.target.value); setStoryParsed(false); }}
              placeholder="输入故事文本，AI将自动提取角色、场景、道具..."
              className="w-full h-32 text-sm p-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)] resize-none focus:outline-none focus:ring-2 focus:ring-[#EF4444]/30"
            />
            <button
              onClick={handleParseStory}
              disabled={isGeneratingPrompts || !storyText.trim()}
              className="w-full mt-2 py-2 rounded-lg bg-[#EF4444] text-white text-sm font-medium hover:bg-[#DC2626] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGeneratingPrompts ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {storyParsed ? '重新解析' : '解析故事'}
            </button>
            {parseProgress && (
              <p className={`text-xs mt-1.5 ${parseProgress.includes('失败') ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                {parseProgress}
              </p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="p-4 border-b border-[var(--border)]">
            <label className="text-sm font-semibold mb-2 block">快速选择</label>
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={selectAll} className="text-xs py-1.5 rounded bg-[var(--secondary)] hover:bg-[var(--accent)]">全选</button>
              <button onClick={deselectAll} className="text-xs py-1.5 rounded bg-[var(--secondary)] hover:bg-[var(--accent)]">取消选择</button>
              <button onClick={() => selectByStatus('pending')} className="text-xs py-1.5 rounded bg-[var(--secondary)] hover:bg-[var(--accent)]">选未生成项</button>
              <button onClick={() => selectByStatus('generated')} className="text-xs py-1.5 rounded bg-[var(--secondary)] hover:bg-[var(--accent)]">选已生成项</button>
              <button onClick={() => selectByStatus('error')} className="text-xs py-1.5 rounded bg-[var(--secondary)] hover:bg-[var(--accent)]">选错误项</button>
              <button onClick={invertSelection} className="text-xs py-1.5 rounded bg-[var(--secondary)] hover:bg-[var(--accent)]">反选</button>
            </div>
          </div>

          {/* Type Filter */}
          <div className="p-4 border-b border-[var(--border)]">
            <label className="text-sm font-semibold mb-2 block">素材类型筛选</label>
            <div className="flex flex-col gap-2">
              {(['character', 'scene', 'prop'] as const).map(type => {
                const cfg = TYPE_CONFIG[type];
                const Icon = cfg.icon;
                const count = assets.filter(a => a.type === type).length;
                return (
                  <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterTypes.has(type)}
                      onChange={() => setFilterTypes(prev => {
                        const next = new Set(prev);
                        next.has(type) ? next.delete(type) : next.add(type);
                        return next;
                      })}
                      className="rounded border-[var(--border)] accent-[#EF4444]"
                    />
                    <Icon className="w-4 h-4" />
                    <span>{cfg.label}</span>
                    <span className="ml-auto text-xs text-[var(--muted-foreground)]">{count}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Generation Settings */}
          <div className="p-4 border-b border-[var(--border)]">
            <label className="text-sm font-semibold mb-2 block">生成设置</label>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-[var(--muted-foreground)]">生成模型</span>
                <select
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                  className="w-full mt-1 text-sm p-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]"
                >
                  {MODEL_OPTIONS.map(m => <option key={m.id} value={m.id}>{m.label} - {m.desc}</option>)}
                </select>
              </div>
              <div>
                <span className="text-xs text-[var(--muted-foreground)]">分辨率</span>
                <select
                  value={selectedResolution}
                  onChange={e => setSelectedResolution(e.target.value)}
                  className="w-full mt-1 text-sm p-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]"
                >
                  {RESOLUTION_OPTIONS.map(r => <option key={r.id} value={r.id}>{r.label} ({r.desc})</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-4 space-y-2 mt-auto">
            <button
              onClick={handleBatchGenPrompts}
              disabled={isGeneratingPrompts || selectedCount === 0}
              className="w-full py-2.5 rounded-lg bg-[var(--secondary)] border border-[var(--border)] text-sm font-medium hover:bg-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGeneratingPrompts ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              批量生成提示词
            </button>
            <button
              onClick={handleBatchGenImages}
              disabled={isGeneratingImages || readyImageCount === 0}
              className="w-full py-2.5 rounded-lg bg-[#EF4444] text-white text-sm font-medium hover:bg-[#DC2626] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGeneratingImages ? <><Loader2 className="w-4 h-4 animate-spin" /> 生成中 {currentGenIndex + 1}/{currentGenTotal}</> : <><ImageIcon className="w-4 h-4" /> 开始批量生成图片 ({readyImageCount})</>}
            </button>
            {(isGeneratingImages || isGeneratingPrompts) && (
              <button onClick={handleCancel} className="w-full py-2 rounded-lg border border-[#EF4444] text-[#EF4444] text-sm font-medium hover:bg-[#EF4444]/10 flex items-center justify-center gap-2">
                <X className="w-4 h-4" /> 取消
              </button>
            )}
            {selectedCount > 0 && (
              <button onClick={deleteSelected} className="w-full py-2 rounded-lg text-red-600 text-sm hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center justify-center gap-2">
                <Trash2 className="w-4 h-4" /> 删除选中 ({selectedCount})
              </button>
            )}
          </div>
        </div>

        {/* ==== Main Area: Asset Grid ==== */}
        <div className="flex-1 overflow-y-auto p-6">
          {assets.length === 0 && !storyParsed ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Package className="w-16 h-16 text-[var(--muted-foreground)] mb-4" />
              <h2 className="text-xl font-semibold mb-2">资产工坊</h2>
              <p className="text-[var(--muted-foreground)] max-w-md mb-6">
                在左侧输入故事文本，AI将自动提取角色、场景、道具。<br />
                也可以手动添加资产，批量生成提示词和参考图。
              </p>
              <button
                onClick={() => setShowAddDialog(true)}
                className="px-4 py-2 rounded-lg bg-[#EF4444] text-white text-sm font-medium hover:bg-[#DC2626] flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> 手动添加资产
              </button>
            </div>
          ) : (
            <>
              {/* Stats Bar */}
              <div className="flex items-center gap-4 mb-6 text-sm">
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-gray-400" /> 待处理 {pendingCount}</span>
                <span className="flex items-center gap-1.5"><FileText className="w-4 h-4 text-green-500" /> 提示词就绪 {promptReadyCount}</span>
                <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-600" /> 已生成 {generatedCount}</span>
                {errorCount > 0 && <span className="flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-red-500" /> 错误 {errorCount}</span>}
                <div className="ml-auto">
                  <button
                    onClick={() => setShowAddDialog(true)}
                    className="px-3 py-1.5 rounded-lg bg-[#EF4444] text-white text-xs font-medium hover:bg-[#DC2626] flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> 添加
                  </button>
                </div>
              </div>

              {/* Grid / List View */}
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredAssets.map(asset => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      onToggleSelect={() => toggleSelect(asset.id)}
                      onPreview={() => setPreviewAsset(asset)}
                      onRetry={() => {
                        setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, selected: true, status: a.status === 'error' ? 'prompt_ready' : a.status } : a));
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAssets.map(asset => (
                    <AssetListItem
                      key={asset.id}
                      asset={asset}
                      onToggleSelect={() => toggleSelect(asset.id)}
                      onPreview={() => setPreviewAsset(asset)}
                    />
                  ))}
                </div>
              )}

              {filteredAssets.length === 0 && assets.length > 0 && (
                <div className="text-center py-12 text-[var(--muted-foreground)]">
                  <Filter className="w-8 h-8 mx-auto mb-2" />
                  <p>当前筛选条件下没有资产</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ==== Add Asset Dialog ==== */}
      {showAddDialog && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40">
          <div className="bg-[var(--card)] rounded-xl shadow-2xl p-6 w-96">
            <h3 className="font-semibold text-lg mb-4">添加资产</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--muted-foreground)]">名称</label>
                <input
                  value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full mt-1 text-sm p-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)] focus:outline-none focus:ring-2 focus:ring-[#EF4444]/30"
                  placeholder="如：少女、古宅、宝剑..."
                />
              </div>
              <div>
                <label className="text-xs text-[var(--muted-foreground)]">类型</label>
                <div className="flex gap-2 mt-1">
                  {(['character', 'scene', 'prop'] as const).map(type => {
                    const cfg = TYPE_CONFIG[type];
                    return (
                      <button
                        key={type}
                        onClick={() => setAddForm(f => ({ ...f, type }))}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium border ${addForm.type === type ? `${cfg.color} ${cfg.borderColor} border` : 'border-[var(--border)] text-[var(--muted-foreground)]'}`}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--muted-foreground)]">描述</label>
                <textarea
                  value={addForm.description}
                  onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full mt-1 text-sm p-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)] resize-none h-20 focus:outline-none focus:ring-2 focus:ring-[#EF4444]/30"
                  placeholder="详细描述该资产的外貌/环境/细节..."
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowAddDialog(false)} className="flex-1 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--accent)]">取消</button>
              <button onClick={handleAddAsset} disabled={!addForm.name.trim()} className="flex-1 py-2 rounded-lg bg-[#EF4444] text-white text-sm hover:bg-[#DC2626] disabled:opacity-40">添加</button>
            </div>
          </div>
        </div>
      )}

      {/* ==== Preview Lightbox ==== */}
      {previewAsset && previewAsset.imageUrl && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/70" onClick={() => setPreviewAsset(null)}>
          <div className="relative max-w-3xl max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <img src={previewAsset.imageUrl} alt={previewAsset.name} className="max-w-full max-h-[80vh] rounded-lg shadow-2xl" />
            <div className="absolute top-2 right-2 flex gap-1.5">
              <a href={previewAsset.imageUrl} download={`${previewAsset.name}.png`} className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70"><Download className="w-4 h-4" /></a>
              <button onClick={() => setPreviewAsset(null)} className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70"><X className="w-4 h-4" /></button>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent rounded-b-lg">
              <p className="text-white font-semibold">{previewAsset.name}</p>
              <p className="text-white/70 text-xs line-clamp-2">{previewAsset.promptZh}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========== Sub-components ========== */

function AssetCard({ asset, onToggleSelect, onPreview, onRetry }: {
  asset: AssetItem;
  onToggleSelect: () => void;
  onPreview: () => void;
  onRetry: () => void;
}) {
  const cfg = TYPE_CONFIG[asset.type];
  const Icon = cfg.icon;

  return (
    <div className={`rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden transition-all hover:shadow-lg hover:scale-[1.01] ${asset.selected ? 'ring-2 ring-[#EF4444]' : ''}`}>
      {/* Image Area */}
      <div className="relative aspect-square bg-[var(--secondary)] flex items-center justify-center overflow-hidden group">
        {/* Selection Checkbox */}
        <button onClick={onToggleSelect} className="absolute top-2 left-2 z-10">
          {asset.selected ? <CheckSquare className="w-5 h-5 text-[#EF4444]" /> : <Square className="w-5 h-5 text-white/60 hover:text-white" />}
        </button>

        {asset.status === 'generated' && asset.imageUrl ? (
          <>
            <img src={asset.imageUrl} alt={asset.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="flex gap-2">
                <button onClick={onPreview} className="p-2 rounded-full bg-white/90 hover:bg-white"><Eye className="w-4 h-4" /></button>
                <a href={asset.imageUrl} download={`${asset.name}.png`} onClick={e => e.stopPropagation()} className="p-2 rounded-full bg-white/90 hover:bg-white"><Download className="w-4 h-4" /></a>
              </div>
            </div>
          </>
        ) : asset.status === 'generating' ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-[#EF4444] animate-spin" />
            <span className="text-xs text-[var(--muted-foreground)]">生成中...</span>
          </div>
        ) : asset.status === 'error' ? (
          <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={onRetry}>
            <AlertCircle className="w-8 h-8 text-red-400" />
            <span className="text-xs text-red-400">点击重试</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Icon className="w-8 h-8 text-[var(--muted-foreground)]" />
            <span className="text-xs text-[var(--muted-foreground)]">
              {asset.status === 'prompt_ready' ? '提示词就绪' : '等待生成'}
            </span>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm truncate">{asset.name}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>
        {asset.status === 'prompt_ready' && (
          <span className="inline-flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-1.5 py-0.5 rounded-full">
            <FileText className="w-3 h-3" /> 已生成提示词
          </span>
        )}
        {asset.status === 'generated' && (
          <span className="text-[10px] text-[var(--muted-foreground)]">coze/image text-to-image {selectedResolution(asset)}</span>
        )}
        {asset.promptZh && (
          <p className="text-xs text-[var(--muted-foreground)] mt-1.5 line-clamp-2">{asset.promptZh}</p>
        )}
      </div>
    </div>
  );
}

function selectedResolution(asset: AssetItem): string {
  // Just show a reasonable default
  return '1K';
}

function AssetListItem({ asset, onToggleSelect, onPreview }: {
  asset: AssetItem;
  onToggleSelect: () => void;
  onPreview: () => void;
}) {
  const cfg = TYPE_CONFIG[asset.type];
  const Icon = cfg.icon;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--card)] ${asset.selected ? 'ring-2 ring-[#EF4444]' : ''}`}>
      <button onClick={onToggleSelect}>
        {asset.selected ? <CheckSquare className="w-4 h-4 text-[#EF4444]" /> : <Square className="w-4 h-4 text-[var(--muted-foreground)]" />}
      </button>
      <div className="w-10 h-10 rounded-lg bg-[var(--secondary)] flex items-center justify-center shrink-0 overflow-hidden">
        {asset.imageUrl ? (
          <img src={asset.imageUrl} alt={asset.name} className="w-full h-full object-cover cursor-pointer" onClick={onPreview} />
        ) : (
          <Icon className="w-4 h-4 text-[var(--muted-foreground)]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{asset.name}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${cfg.color}`}>{cfg.label}</span>
          {asset.status === 'prompt_ready' && (
            <span className="text-[10px] text-green-600 dark:text-green-400">提示词就绪</span>
          )}
          {asset.status === 'generated' && (
            <span className="text-[10px] text-green-700 dark:text-green-300">已生成</span>
          )}
          {asset.status === 'generating' && (
            <span className="text-[10px] text-[#EF4444]">生成中...</span>
          )}
          {asset.status === 'error' && (
            <span className="text-[10px] text-red-500">错误</span>
          )}
        </div>
        <p className="text-xs text-[var(--muted-foreground)] truncate">{asset.promptZh || asset.description}</p>
      </div>
      {asset.imageUrl && (
        <button onClick={onPreview} className="p-1.5 rounded hover:bg-[var(--accent)]"><Eye className="w-4 h-4" /></button>
      )}
    </div>
  );
}
