#!/usr/bin/env python3
"""
PII检测与脱敏脚本
自动识别文本中的个人身份信息(PII)并提供脱敏建议
"""

import re
import json
import argparse
from typing import Dict, List, Tuple

def detect_and_sanitize(text: str) -> Tuple[str, List[Dict], Dict]:
    """
    检测并脱敏PII
    只替换实际敏感内容，不处理标签词
    """
    
    replacements = []
    
    # 1. 身份证号（纯数字）
    for match in re.finditer(r'\d{17}[\dXx]|\b\d{15}\b', text):
        replacements.append({
            'type': '身份证号', 'value': match.group(),
            'start': match.start(), 'end': match.end(),
            'replacement': '【身份证号-已脱敏】'
        })
    
    # 2. 手机号（11位数字，以1开头）
    for match in re.finditer(r'1[3-9]\d{9}', text):
        # 避免被身份证号覆盖的区域
        if not any(r['type'] == '身份证号' and 
                   not (match.end() <= r['start'] or match.start() >= r['end'])
                   for r in replacements):
            replacements.append({
                'type': '手机号', 'value': match.group(),
                'start': match.start(), 'end': match.end(),
                'replacement': '【手机号-已脱敏】'
            })
    
    # 3. 银行卡号（16-19位，排除手机号和身份证号）
    for match in re.finditer(r'\b\d{16,19}\b', text):
        if not any(not (match.end() <= r['start'] or match.start() >= r['end'])
                   for r in replacements):
            replacements.append({
                'type': '银行卡号', 'value': match.group(),
                'start': match.start(), 'end': match.end(),
                'replacement': '【银行账号-已脱敏】'
            })
    
    # 4. 邮箱
    for match in re.finditer(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text):
        replacements.append({
            'type': '邮箱', 'value': match.group(),
            'start': match.start(), 'end': match.end(),
            'replacement': '【邮箱-已脱敏】'
        })
    
    # 5. 姓名+称谓
    for match in re.finditer(r'[\u4e00-\u9fa5]{2,4}(?:先生|女士|小姐|老板|经理|总监|总)', text):
        replacements.append({
            'type': '姓名', 'value': match.group(),
            'start': match.start(), 'end': match.end(),
            'replacement': '【姓名-已脱敏】'
        })
    
    # 6. 地址（省/市/区 + 路/街/号等，排除特定词）
    excluded = {'身份证号', '手机号', '电话', '邮箱'}
    address_pattern = r'[\u4e00-\u9fa5]{1,6}(?:省|市|区|县)(?:[\u4e00-\u9fa5]{0,10})?(?:街|路|道|巷|弄|号|栋|单元|室|楼|村|小区|大道|大厦)'
    for match in re.finditer(address_pattern, text):
        if match.group() not in excluded:
            if not any(not (match.end() <= r['start'] or match.start() >= r['end'])
                       for r in replacements):
                replacements.append({
                    'type': '地址', 'value': match.group(),
                    'start': match.start(), 'end': match.end(),
                    'replacement': '【地址-已脱敏】'
                })
    
    # 按位置逆序替换
    replacements.sort(key=lambda x: x['start'], reverse=True)
    
    sanitized = text
    for r in replacements:
        sanitized = sanitized[:r['start']] + r['replacement'] + sanitized[r['end']:]
    
    replacements.reverse()
    
    # 统计
    summary = {}
    for r in replacements:
        t = r['type']
        summary[t] = summary.get(t, 0) + 1
    
    return sanitized, replacements, summary


def generate_report(original_text: str, sanitized_text: str, 
                    replacements: List[Dict], summary: Dict) -> Dict:
    """生成检测报告"""
    has_high = any(r['type'] in ['身份证号', '银行卡号'] for r in replacements)
    has_medium = any(r['type'] in ['手机号', '姓名', '邮箱'] for r in replacements)
    
    if has_high:
        risk_level = '高'
        recommendation = '检测到高敏感PII，必须脱敏后再输入AI'
    elif has_medium:
        risk_level = '中'
        recommendation = '检测到中等敏感PII，建议根据业务场景决定是否脱敏'
    else:
        risk_level = '低'
        recommendation = '未检测到明显PII，但建议人工复核'
    
    return {
        'check_timestamp': '自动生成',
        'total_pii_count': len(replacements),
        'risk_level': risk_level,
        'pii_summary': summary,
        'replacements': replacements,
        'recommendation': recommendation,
        'sanitized_text': sanitized_text
    }


def print_report(report: Dict):
    """格式化打印"""
    print("\n" + "="*50)
    print("PII 检测与脱敏报告")
    print("="*50)
    print(f"\n检测时间: {report['check_timestamp']}")
    print(f"PII总数: {report['total_pii_count']}")
    print(f"风险等级: {report['risk_level']}")
    
    print("\n【PII类型统计】")
    if report['pii_summary']:
        for pii_type, count in report['pii_summary'].items():
            print(f"  - {pii_type}: {count}处")
    else:
        print("  (无)")
    
    print(f"\n【脱敏建议】")
    print(f"  {report['recommendation']}")
    
    if report['replacements']:
        print("\n【替换记录】")
        for r in report['replacements']:
            print(f"  [{r['type']}] \"{r['value']}\" → \"{r['replacement']}\"")
    
    print("\n【脱敏后文本】")
    print("-"*50)
    print(report['sanitized_text'])
    print("-"*50)
    print()


def main():
    parser = argparse.ArgumentParser(description="PII检测与脱敏工具")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--text", help="待检测文本")
    group.add_argument("--file", help="待检测文件路径")
    parser.add_argument("--output", help="输出JSON报告路径")
    
    args = parser.parse_args()
    
    if args.text:
        original = args.text
    else:
        with open(args.file, 'r', encoding='utf-8') as f:
            original = f.read()
    
    sanitized, replacements, summary = detect_and_sanitize(original)
    report = generate_report(original, sanitized, replacements, summary)
    
    print_report(report)
    
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(f"报告已保存: {args.output}")


if __name__ == "__main__":
    main()
