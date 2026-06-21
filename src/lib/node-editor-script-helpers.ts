// 从剧本中提取人物名称
export const extractCharacterNames = (script: string): string[] => {
    const characters: string[] = [];
    
    // 常见中文名字
    const commonNames = ['小明', '小红', '小华', '小丽', '主角', '男主角', '女主角', '配角'];
    commonNames.forEach(name => {
      if (script.includes(name) && !characters.includes(name)) {
        characters.push(name);
      }
    });
    
    // 找"叫"、"是"、"有个"后面的名字
    const patterns = [
      /叫["“']?([\u4e00-\u9fa5]{2,4})["”']?/g,
      /是["“']?([\u4e00-\u9fa5]{2,4})["”']?/g,
      /有个["“']?([\u4e00-\u9fa5]{2,4})["”']?/g,
    ];
    
    patterns.forEach(pattern => {
      const matches = script.matchAll(pattern);
      for (const match of matches) {
        const name = match[1];
        if (name && name.length >= 2 && !characters.includes(name)) {
          characters.push(name);
        }
      }
    });
    
    // 如果没有找到，使用默认人物
    if (characters.length === 0) {
      characters.push('主角');
    }
    
    return characters.slice(0, 3);
};

  // 从剧本中提取场景名称
export const extractSceneNames = (script: string): string[] => {
    const scenes: string[] = [];
    
    // 场景关键词匹配
    const sceneKeywords = [
      { keyword: '客厅', name: '现代客厅' },
      { keyword: '家', name: '现代客厅' },
      { keyword: '房间', name: '现代客厅' },
      { keyword: '卧室', name: '温馨卧室' },
      { keyword: '厨房', name: '现代厨房' },
      { keyword: '办公室', name: '现代办公室' },
      { keyword: '公司', name: '现代办公室' },
      { keyword: '咖啡馆', name: '温馨咖啡馆' },
      { keyword: '咖啡厅', name: '温馨咖啡馆' },
      { keyword: '公园', name: '城市公园' },
      { keyword: '花园', name: '美丽花园' },
      { keyword: '街道', name: '繁华街道' },
      { keyword: '马路', name: '繁华街道' },
      { keyword: '海边', name: '美丽海边' },
      { keyword: '海滩', name: '美丽海边' },
      { keyword: '森林', name: '神秘森林' },
      { keyword: '树林', name: '神秘森林' },
      { keyword: '山顶', name: '开阔山顶' },
      { keyword: '山峰', name: '开阔山顶' },
      { keyword: '室内', name: '温馨室内' },
      { keyword: '室外', name: '开阔室外' },
      { keyword: '城市', name: '现代城市' },
      { keyword: '乡村', name: '宁静乡村' },
      { keyword: '酒吧', name: '时尚酒吧' },
      { keyword: '餐厅', name: '优雅餐厅' },
      { keyword: '饭店', name: '优雅餐厅' },
      { keyword: '商场', name: '大型商场' },
      { keyword: '超市', name: '大型超市' },
      { keyword: '医院', name: '现代医院' },
      { keyword: '学校', name: '校园场景' },
      { keyword: '图书馆', name: '安静图书馆' },
    ];
    
    sceneKeywords.forEach(({ keyword, name }) => {
      if (script.includes(keyword) && !scenes.includes(name)) {
        scenes.push(name);
      }
    });
    
    // 如果没有识别到场景，根据剧本内容推测
    if (scenes.length === 0) {
      if (script.includes('家') || script.includes('房间') || script.includes('住')) {
        scenes.push('现代客厅');
      } else if (script.includes('工作') || script.includes('上班')) {
        scenes.push('现代办公室');
      } else if (script.includes('吃') || script.includes('饭')) {
        scenes.push('温馨咖啡馆');
      } else if (script.includes('玩') || script.includes('散步')) {
        scenes.push('城市公园');
      } else {
        scenes.push('现代客厅');
      }
    }
    
    return scenes.slice(0, 3);
  };

  // 生成简单的人物描述
export const generateCharacterDescription = (name: string): string => {
    const descriptions: Record<string, string> = {
      '小明': '年轻男性，阳光开朗，穿着休闲装',
      '小红': '年轻女性，温柔美丽，穿着连衣裙',
      '小华': '年轻男性，成熟稳重，穿着西装',
      '小丽': '年轻女性，甜美可爱，穿着粉色衣服',
      '主角': '主角形象，气质出众',
      '女主角': '美丽女性，气质高雅',
      '男主角': '英俊男性，稳重帅气',
    };
    
    if (descriptions[name]) {
      return descriptions[name];
    }
    
    return `${name}的形象`;
  };

  // 生成简单的场景描述
export const generateSceneDescription = (sceneName: string): string => {
    const descriptions: Record<string, string> = {
      '现代客厅': '温馨舒适的现代客厅',
      '舒适卧室': '温馨舒适的卧室',
      '现代办公室': '繁忙的现代办公室',
      '温馨咖啡馆': '舒适的咖啡馆',
      '城市公园': '宁静的城市公园',
      '美丽花园': '五彩缤纷的花园',
      '繁华街道': '繁华的城市街道',
      '美丽海边': '美丽的海边',
      '神秘森林': '神秘的森林',
      '开阔山顶': '开阔的山顶',
      '温馨室内': '温馨的室内场景',
      '开阔室外': '开阔的室外场景',
      '现代城市': '现代化的城市',
      '优雅餐厅': '优雅的餐厅',
      '校园场景': '学校校园',
    };
    
    if (descriptions[sceneName]) {
      return descriptions[sceneName];
    }
    
    return sceneName;
  };

