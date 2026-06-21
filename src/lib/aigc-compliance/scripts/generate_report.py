#!/usr/bin/env python3
"""
AIGC合规自查清单生成工具

注意：本工具生成的是系统化合规自查清单，帮助用户不遗漏地完成检查。
最终合规判断仍需人工完成。
"""

import argparse
import json
from datetime import datetime
from typing import Dict, List, Any

def generate_self_checklist(project_name: str, review_data: Dict[str, Any], output_path: str = None) -> Dict[str, Any]:
    """
    生成AIGC合规自查清单
    """
    
    checklist = {
        "project_name": project_name,
        "self_check_timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "self_check_status": "已完成系统化自查",
        "ai_assisted_findings": [],
        "human_review_required": [],
        "checklist_summary": {
            "total_modules": 5,
            "modules_passed": 0,
            "modules_need_human_review": 0
        },
        "next_steps": [],
        "final_disclaimer": (
            "本清单为系统化合规自查工具，仅供参考，不构成合规认证。 "
            "不具备法律资质，无法替代专业法务判断。 "
            "最终合规责任由使用者自行承担。"
        )
    }
    
    modules = [
        ("data_sanitization", "数据脱敏", review_data.get("data_sanitization", {})),
        ("personality_rights", "人格权授权", review_data.get("personality_rights", {})),
        ("ai_identifier", "AI标识合规", review_data.get("ai_identifier", {})),
        ("content_safety", "内容安全", review_data.get("content_safety", {})),
        ("copyright", "版权风险", review_data.get("copyright", {}))
    ]
    
    for module_key, module_name, module_data in modules:
        risk_level = module_data.get("risk_level", "中")
        ai_findings = module_data.get("ai_findings", [])
        human_items = module_data.get("human_review_items", [])
        suggestions = module_data.get("suggestions", [])
        
        # AI辅助发现
        ai_entry = {
            "module": module_name,
            "risk_level": risk_level,
            "ai_findings": ai_findings if ai_findings else ["未检测到明显风险"],
            "suggestions": suggestions
        }
        checklist["ai_assisted_findings"].append(ai_entry)
        
        # 需人工复核项
        if human_items:
            checklist["human_review_required"].append({
                "module": module_name,
                "items": human_items,
                "responsible_party": "用户/法务"
            })
            checklist["checklist_summary"]["modules_need_human_review"] += 1
        else:
            checklist["checklist_summary"]["modules_passed"] += 1
        
        # 下一步建议
        if risk_level == "高":
            checklist["next_steps"].append(f"[{module_name}] 发现高风险项，需整改后重新自查")
        elif risk_level == "中" and human_items:
            checklist["next_steps"].append(f"[{module_name}] 需完成人工复核后继续")
    
    if not checklist["next_steps"]:
        checklist["next_steps"].append("高风险项已处理，请在完成人工复核后自行判断是否可以发布")
    
    # 输出到文件
    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(checklist, f, ensure_ascii=False, indent=2)
        print(f"自查清单已生成: {output_path}")
    
    return checklist


def print_checklist(checklist: Dict):
    """格式化打印自查清单"""
    print("\n" + "="*60)
    print("AIGC 合规自查清单")
    print("="*60)
    print(f"\n项目名称: {checklist['project_name']}")
    print(f"自查时间: {checklist['self_check_timestamp']}")
    print(f"自查状态: {checklist['self_check_status']}")
    
    print("\n" + "-"*60)
    print("【AI辅助发现】")
    print("-"*60)
    
    for finding in checklist["ai_assisted_findings"]:
        risk_icon = {"高": "[!]", "中": "[~]", "低": "[OK]"}
        icon = risk_icon.get(finding["risk_level"], "[?]")
        print(f"\n{icon} {finding['module']} (风险: {finding['risk_level']})")
        for item in finding["ai_findings"]:
            print(f"  - {item}")
        if finding["suggestions"]:
            print("  建议:", "; ".join(finding["suggestions"]))
    
    if checklist["human_review_required"]:
        print("\n" + "-"*60)
        print("【必须人工复核】")
        print("-"*60)
        for hr in checklist["human_review_required"]:
            print(f"\n>>> {hr['module']}")
            for item in hr["items"]:
                print(f"  [ ] {item}")
            print(f"  负责人: {hr['responsible_party']}")
    
    if checklist["next_steps"]:
        print("\n" + "-"*60)
        print("【下一步】")
        print("-"*60)
        for step in checklist["next_steps"]:
            print(f"  - {step}")
    
    print("\n" + "="*60)
    print("免责声明")
    print("="*60)
    print(checklist["final_disclaimer"])
    print()


def main():
    parser = argparse.ArgumentParser(
        description="AIGC合规自查清单生成工具",
        epilog="注意：本工具仅供参考，最终合规责任由使用者自行承担。"
    )
    parser.add_argument("--project_name", required=True, help="项目名称")
    parser.add_argument("--sanitization_risk", choices=["高", "中", "低"], default="低", help="数据脱敏风险")
    parser.add_argument("--personality_risk", choices=["高", "中", "低"], default="低", help="人格权风险")
    parser.add_argument("--identifier_risk", choices=["高", "中", "低"], default="低", help="AI标识风险")
    parser.add_argument("--safety_risk", choices=["高", "中", "低"], default="低", help="内容安全风险")
    parser.add_argument("--copyright_risk", choices=["高", "中", "低"], default="低", help="版权风险")
    parser.add_argument("--output", help="输出文件路径（JSON）")
    
    args = parser.parse_args()
    
    review_data = {
        "data_sanitization": {
            "risk_level": args.sanitization_risk,
            "ai_findings": ["PII检测建议: 使用pii_detector.py进行自动检测"],
            "human_review_items": ["人工确认: 已完成PII脱敏处理"] if args.sanitization_risk != "低" else [],
            "suggestions": ["建议使用脚本自动检测PII"] if args.sanitization_risk != "低" else []
        },
        "personality_rights": {
            "risk_level": args.personality_risk,
            "ai_findings": ["授权文件核查: 请确认已取得相关授权"],
            "human_review_items": ["人工确认: 授权书真实性与完整性"] if args.personality_risk != "低" else [],
            "suggestions": []
        },
        "ai_identifier": {
            "risk_level": args.identifier_risk,
            "ai_findings": ["标识检查: 请确认视频/图片已添加AI标识"],
            "human_review_items": ["人工确认: 标识位置与显著性是否符合要求"] if args.identifier_risk != "低" else [],
            "suggestions": ["平台政策参考: 见references/platform-policies.md"]
        },
        "content_safety": {
            "risk_level": args.safety_risk,
            "ai_findings": ["内容安全: 需人工查看画面确认无敏感元素"],
            "human_review_items": ["人工确认: 画面是否含国徽/公章/伪造证件等"],
            "suggestions": ["敏感元素清单参考: 见SKILL.md第四步"]
        },
        "copyright": {
            "risk_level": args.copyright_risk,
            "ai_findings": ["版权排查: 请自查是否存在侵权风险"],
            "human_review_items": ["人工确认: 素材与在先作品是否构成实质性相似"],
            "suggestions": ["版权判断建议咨询专业律师"]
        }
    }
    
    checklist = generate_self_checklist(args.project_name, review_data, args.output)
    print_checklist(checklist)


if __name__ == "__main__":
    main()
