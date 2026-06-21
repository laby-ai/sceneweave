/**
 * 错误处理服务 - 友好错误码 + 智能诊断
 */

import type {
  ErrorDefinition,
  ErrorCategory,
  ErrorSeverity,
  DiagnosticResult,
} from './types';
import { ERROR_MAP, ERROR_CATEGORY_PREFIX } from './constants';

export class ErrorHandler {
  /**
   * 根据技术错误信息自动匹配错误码
   */
  static classifyError(rawError: string): ErrorDefinition {
    // 匹配已知模式
    const patternMap: Array<[RegExp, string]> = [
      [/cuda.*out.of.memory|OOM|VRAM/i, 'E1001'],
      [/gpu.*pool|queue.*wait|排队/i, 'E1002'],
      [/disk.*space|storage.*full/i, 'E1003'],
      [/timeout|ETIMEDOUT|超时/i, 'E2001'],
      [/503|service.*unavailable|维护/i, 'E2002'],
      [/content.*policy|safety.*filter|不当内容/i, 'E3001'],
      [/insufficient.*credit|积分不足/i, 'E3002'],
      [/unsupported.*resolution|不.*支持.*分辨率/i, 'E3003'],
      [/internal.*error|unknown.*error/i, 'E4001'],
      [/data.*corrupt|数据异常/i, 'E4002'],
      [/model.*fail|inference.*fail|生成失败/i, 'E5001'],
      [/quality.*low|质量.*不佳/i, 'E5002'],
      [/model.*unavailable|模型.*维护/i, 'E5003'],
    ];

    for (const [pattern, code] of patternMap) {
      if (pattern.test(rawError)) {
        return ERROR_MAP[code];
      }
    }

    // 无法匹配则返回通用系统错误
    return ERROR_MAP['E4001'];
  }

  /**
   * 根据错误码获取错误定义
   */
  static getErrorDefinition(code: string): ErrorDefinition | undefined {
    return ERROR_MAP[code];
  }

  /**
   * 生成诊断结果（面向用户）
   */
  static diagnose(rawError: string, errorCode?: string): DiagnosticResult {
    const definition = errorCode
      ? ERROR_MAP[errorCode]
      : this.classifyError(rawError);

    if (!definition) {
      return {
        errorCode: 'E4001',
        userMessage: '系统异常，请稍后重试',
        suggestions: ['稍后重试', '联系客服并提供错误码 E4001'],
        autoFixAvailable: false,
        retryable: true,
      };
    }

    return {
      errorCode: definition.code,
      userMessage: definition.userMessage,
      suggestions: definition.suggestions,
      autoFixAvailable: definition.autoActions.length > 0,
      autoFixAction: definition.autoActions[0] || undefined,
      retryable: definition.retryable,
    };
  }

  /**
   * 根据错误严重级别获取UI展示样式
   */
  static getSeverityStyle(severity: ErrorSeverity): {
    bgClass: string;
    textClass: string;
    iconClass: string;
  } {
    const styles: Record<ErrorSeverity, { bgClass: string; textClass: string; iconClass: string }> = {
      info: {
        bgClass: 'bg-red-500/10',
        textClass: 'text-red-400',
        iconClass: 'text-red-400',
      },
      warning: {
        bgClass: 'bg-red-500/10',
        textClass: 'text-red-400',
        iconClass: 'text-red-400',
      },
      error: {
        bgClass: 'bg-red-500/10',
        textClass: 'text-red-400',
        iconClass: 'text-red-400',
      },
      critical: {
        bgClass: 'bg-red-600/10',
        textClass: 'text-red-500',
        iconClass: 'text-red-500',
      },
    };
    return styles[severity];
  }

  /**
   * 格式化用户友好的错误展示文本
   */
  static formatUserError(diagnostic: DiagnosticResult): string {
    const parts = [diagnostic.userMessage];
    if (diagnostic.errorCode) {
      parts.push(`(错误码: ${diagnostic.errorCode})`);
    }
    if (diagnostic.retryable) {
      parts.push('可重试');
    }
    return parts.join(' ');
  }
}
