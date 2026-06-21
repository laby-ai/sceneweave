'use client';

import { useState } from 'react';
import { getBYOKRequestHeaders } from '@/lib/byok-client';

interface UseTaskCenterProviderRecoveryParams {
  taskId: string;
  onSync: () => Promise<void> | void;
}

export function useTaskCenterProviderRecovery({
  taskId,
  onSync,
}: UseTaskCenterProviderRecoveryParams) {
  const [segmentProviderRecoveryKey, setSegmentProviderRecoveryKey] = useState<string | null>(null);

  const recoverAssemblyProviderTask = async (segmentIndex: number, childTaskId?: string | null) => {
    if (!childTaskId) {
      alert('缺少子任务 ID，无法续查供应商任务。');
      return;
    }

    const byokHeaders = getBYOKRequestHeaders() as Record<string, string>;
    if (!byokHeaders['x-yh-api-key'] || !byokHeaders['x-yh-api-base'] || !byokHeaders['x-yh-provider']) {
      alert('请先在设置里保存 Ark API Base、API Key 和视频模型，再续查供应商任务。');
      return;
    }

    const recoveryKey = `${taskId}:${segmentIndex}:provider`;
    setSegmentProviderRecoveryKey(recoveryKey);
    try {
      const res = await fetch('/api/production/assembly-plan/segment/recover-provider-task', {
        method: 'POST',
        headers: {
          ...byokHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ childTaskId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || '供应商任务续查失败');
        return;
      }
      await onSync();
      if (res.status === 202 || data.status === 'pending') {
        alert('供应商任务仍在处理中，已同步当前状态；没有重新提交生成。');
      } else {
        alert('已从供应商任务恢复片段结果；没有重新提交生成。');
      }
    } catch {
      alert('网络错误，供应商任务续查失败');
    } finally {
      setSegmentProviderRecoveryKey(null);
    }
  };

  return {
    segmentProviderRecoveryKey,
    recoverAssemblyProviderTask,
  };
}
