'use client';

import { useState, useCallback } from 'react';
import { SubtitleEditor } from '@/components/subtitle-editor';
import { SubtitleConfig, DEFAULT_SUBTITLE_STYLE } from '@/constants/subtitles';

export default function SubtitleEditorPage() {
  const [config, setConfig] = useState<SubtitleConfig>({
    enabled: true,
    segments: [],
    style: { ...DEFAULT_SUBTITLE_STYLE },
    generateVoice: false,
    voiceType: 'female',
    voiceLanguage: 'zh',
    speechSpeed: 1.0,
    enableVideoText: false,
    videoTextSegments: [],
    useMultiSegmentVideoText: false,
  });

  const handleChange = useCallback((newConfig: SubtitleConfig) => {
    setConfig(newConfig);
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <SubtitleEditor
        config={config}
        onChange={handleChange}
        videoDuration={60}
      />
    </div>
  );
}
