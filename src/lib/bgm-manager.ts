// ===== BGM 管理器 v5.0 =====
// 风格专属合成引擎 — 每种风格使用完全不同的合成算法，确保试听一听即辨

import { BGM_TYPES_V2 } from '@/constants/bgm-types';

// 预置 BGM 音乐 URL 映射（SoundHelix 降级备用）
export const PRESET_BGM_MAP: Record<string, { name: string; description: string; urls: string[] }> = {
  'relaxed': {
    name: '轻松舒缓',
    description: '轻柔舒缓的旋律，温暖治愈',
    urls: [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3',
    ]
  },
  'upbeat': {
    name: '活力动感',
    description: '欢快节奏，充满活力的氛围',
    urls: [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3',
    ]
  },
  'romantic': {
    name: '浪漫温馨',
    description: '温柔浪漫的旋律',
    urls: [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    ]
  },
  'epic': {
    name: '史诗大气',
    description: '震撼人心的史诗级配乐',
    urls: [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
    ]
  },
  'nature': {
    name: '自然环境',
    description: '自然环境氛围音',
    urls: [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3',
    ]
  },
  'cinematic': {
    name: '电影配乐',
    description: '电影感强烈的配乐',
    urls: [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
    ]
  },
  'electronic': {
    name: '电子律动',
    description: '电子合成音效与节拍',
    urls: [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3',
    ]
  },
  'jazz': {
    name: '爵士即兴',
    description: '爵士风格的即兴演奏',
    urls: [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
    ]
  },
  'classical': {
    name: '古典优雅',
    description: '古典音乐风格',
    urls: [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
    ]
  },
  'rock': {
    name: '摇滚热血',
    description: '热血摇滚风格',
    urls: [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3',
    ]
  },
  'acoustic': {
    name: '原声民谣',
    description: '温暖的原声吉他旋律',
    urls: [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
    ]
  },
  'ambient': {
    name: '氛围冥想',
    description: '冥想与氛围音景',
    urls: [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3',
    ]
  },
  'suspense': {
    name: '悬疑紧张',
    description: '紧张悬疑的配乐',
    urls: [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3',
    ]
  },
  'comedy': {
    name: '轻松幽默',
    description: '幽默轻松的配乐',
    urls: [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3',
    ]
  },
  'corporate': {
    name: '商务专业',
    description: '专业商务风格',
    urls: [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3',
    ]
  },
  'lofi': {
    name: 'Lo-Fi低保真',
    description: '低保真风格',
    urls: [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    ]
  },
  'world': {
    name: '世界音乐',
    description: '融合世界各地音乐风格',
    urls: [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    ]
  },
  'holiday': {
    name: '节日欢庆',
    description: '欢快喜庆的节日音乐',
    urls: [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3',
    ]
  },
  'chinese': {
    name: '国风古韵',
    description: '中国传统音乐风格',
    urls: [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    ]
  },
  'trap': {
    name: '陷阱说唱',
    description: '陷阱说唱风格',
    urls: [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3',
    ]
  },
  'rnb': {
    name: 'R&B灵魂',
    description: 'R&B灵魂风格',
    urls: [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
    ]
  },
  'reggae': {
    name: '雷鬼阳光',
    description: '雷鬼风格',
    urls: [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3',
    ]
  },
  'motivational': {
    name: '励志激励',
    description: '励志风格',
    urls: [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
    ]
  },
  'retro': {
    name: '复古怀旧',
    description: '复古怀旧风格',
    urls: [
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3',
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    ]
  },
};

// ========== 风格专属合成引擎 v5.0 ==========
// 核心思路：不再用通用振荡器+不同参数，而是为每种风格写专属合成函数
// 确保试听时一听就能辨认出对应风格

// --- 基础工具函数 ---

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// 白噪声生成器（带种子）
function noise(t: number, seed: number = 0): number {
  const x = Math.sin(t * 127.1 + seed * 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

// 低通滤波（1极点）
function lp1(input: number, prev: number, cutoff: number, sr: number): number {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / sr;
  const alpha = dt / (rc + dt);
  return prev + alpha * (input - prev);
}

// 高通滤波（1极点）
function hp1(input: number, prev: number, cutoff: number, sr: number): number {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / sr;
  const alpha = rc / (rc + dt);
  return alpha * (prev + input - /* 需要上一输入，简化处理 */0);
}

// 4极点低通（温暖滤波）
function lp4(input: number, state: number[], cutoff: number, q: number, sr: number): { out: number; state: number[] } {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / sr;
  const alpha = dt / (rc + dt) * (1 + q * 0.3);
  const s = [...state];
  let out = input;
  for (let p = 0; p < 4; p++) {
    s[p] = s[p] + alpha * (out - s[p]);
    out = s[p];
  }
  return { out, state: s };
}

// ADSR包络
function adsr(pos: number, len: number, a: number, d: number, s: number, r: number): number {
  if (pos < a) return pos / a;
  if (pos < a + d) return 1 - (1 - s) * (pos - a) / d;
  if (pos < len - r) return s;
  if (pos < len) return s * (len - pos) / r;
  return 0;
}

// 波形生成
function sine(freq: number, t: number): number { return Math.sin(2 * Math.PI * freq * t); }
function tri(freq: number, t: number): number { return 2 * Math.abs(2 * (freq * t - Math.floor(freq * t + 0.5))) - 1; }
function saw(freq: number, t: number): number { return 2 * (freq * t - Math.floor(freq * t)) - 1; }
function sqr(freq: number, t: number, pw: number = 0.5): number { return (freq * t - Math.floor(freq * t)) < pw ? 1 : -1; }

// ========== 风格专属合成函数 ==========

// --- 1. 轻松舒缓: 温暖钢琴和弦 + 长延音，极慢节奏 ---
function synthRelaxed(sr: number, dur: number): Float32Array[] {
  const n = sr * dur;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  // C大调温暖和弦进行: Cmaj7 → Fmaj7 → Am7 → G
  const chords = [
    [261.63, 329.63, 392.00, 493.88], // Cmaj7
    [349.23, 440.00, 523.25, 659.25], // Fmaj7
    [220.00, 261.63, 329.63, 392.00], // Am7
    [196.00, 246.94, 293.66, 392.00], // G
  ];
  const chordDur = 3.5; // 每和弦3.5秒
  let fState = [0, 0, 0, 0];

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const chordIdx = Math.floor(t / chordDur) % chords.length;
    const chord = chords[chordIdx];
    const posInChord = t - chordIdx * chordDur;
    let sample = 0;

    // 每个和弦音用正弦波+慢attack+长release，模拟钢琴延音踏板
    for (let c = 0; c < chord.length; c++) {
      const freq = chord[c];
      // 每个音有微小的随机延迟模拟手指触键
      const noteDelay = c * 0.08;
      const noteT = posInChord - noteDelay;
      if (noteT > 0) {
        const env = Math.exp(-noteT * 0.4) * Math.min(1, noteT / 0.15); // 慢起慢衰
        // 正弦+微量三角波增加温暖感
        sample += (sine(freq, t) * 0.85 + tri(freq * 2, t) * 0.15) * 0.04 * env;
      }
    }

    // 4极点低通暖化
    const f = lp4(sample, fState, 900, 0.2, sr);
    fState = f.state;
    sample = f.out;

    // 全局淡入淡出
    let gEnv = 1;
    if (i < sr * 1.0) gEnv = i / (sr * 1.0);
    if (i > n - sr * 2.0) gEnv = (n - i) / (sr * 2.0);
    sample *= gEnv;
    sample = Math.max(-0.9, Math.min(0.9, sample));

    L[i] = sample;
    R[i] = sample * 0.95 + (i > 5 ? L[i - 5] * 0.05 : 0); // 微立体声
  }
  return [L, R];
}

// --- 2. 活力动感: 四拍鼓点+合成bass+明快旋律 ---
function synthUpbeat(sr: number, dur: number): Float32Array[] {
  const n = sr * dur;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const bpm = 126;
  const beatDur = 60 / bpm;
  const scale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50]; // C5起
  let fState = [0, 0, 0, 0];

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const beat = t / beatDur;
    const beatInBar = beat % 4;
    const bar = Math.floor(beat / 4);
    let sample = 0;

    // Kick: 四拍底鼓
    const kickPhase = beatInBar % 1;
    if (kickPhase < 0.15) {
      const kickEnv = Math.exp(-kickPhase * 30);
      const kickFreq = 150 * Math.exp(-kickPhase * 20) + 45;
      sample += sine(kickFreq, kickPhase) * kickEnv * 0.35;
    }

    // Hi-hat: 八分音符
    const hhPhase = (beat * 2) % 1;
    if (hhPhase < 0.03) {
      sample += noise(t, 42) * Math.exp(-hhPhase * 200) * 0.08;
    }

    // Snare: 2拍、4拍
    if ((Math.floor(beat) % 4 === 1 || Math.floor(beat) % 4 === 3) && beatInBar % 1 < 0.08) {
      sample += noise(t, 77) * Math.exp(-(beatInBar % 1) * 60) * 0.1;
    }

    // Bass: 每小节一个低音
    const bassNote = scale[(bar * 2) % scale.length] / 4; // 低两个八度
    const bassEnv = adsr(beatInBar, beatDur * 4, 0.01, 0.1, 0.5, 0.15);
    sample += sine(bassNote, t) * 0.12 * bassEnv;

    // 旋律: 每拍一个短音符
    const melodyNote = scale[(bar * 4 + Math.floor(beatInBar)) % scale.length];
    const melPhase = beatInBar % 1;
    if (melPhase < 0.4) {
      const melEnv = Math.exp(-melPhase * 5) * Math.min(1, melPhase / 0.005);
      sample += tri(melodyNote, t) * 0.06 * melEnv;
    }

    // 低通
    const f = lp4(sample, fState, 3000, 0.3, sr);
    fState = f.state;
    sample = f.out;

    let gEnv = 1;
    if (i < sr * 0.5) gEnv = i / (sr * 0.5);
    if (i > n - sr * 1.0) gEnv = (n - i) / (sr * 1.0);
    sample *= gEnv;
    sample = Math.max(-0.9, Math.min(0.9, sample));
    L[i] = sample;
    R[i] = sample;
  }
  return [L, R];
}

// --- 3. 浪漫温馨: 弦乐长音 + 和弦垫音 + 揉弦 ---
function synthRomantic(sr: number, dur: number): Float32Array[] {
  const n = sr * dur;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  // 浪漫和弦: Dm7 → G7 → Cmaj7 → Fmaj7
  const chords = [
    [293.66, 349.23, 440.00, 523.25],
    [196.00, 246.94, 293.66, 349.23],
    [261.63, 329.63, 392.00, 493.88],
    [349.23, 440.00, 523.25, 659.25],
  ];
  const chordDur = 4.0;
  let fState = [0, 0, 0, 0];

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const ci = Math.floor(t / chordDur) % chords.length;
    const chord = chords[ci];
    const posInC = t - ci * chordDur;
    let sample = 0;

    for (let c = 0; c < chord.length; c++) {
      const freq = chord[c];
      // 弦乐揉弦: 缓慢频率调制
      const vibrato = Math.sin(2 * Math.PI * 5.2 * t) * 3; // 5.2Hz揉弦
      const f = freq * Math.pow(2, vibrato / 1200);
      // 弦乐音色: 正弦+少量三角模拟泛音
      const env = Math.min(1, posInC / 0.8) * Math.exp(-posInC * 0.15);
      sample += (sine(f, t) * 0.75 + tri(f * 2, t) * 0.2 + sine(f * 3, t) * 0.05) * 0.04 * env;
    }

    const fl = lp4(sample, fState, 1200, 0.3, sr);
    fState = fl.state;
    sample = fl.out;

    // 混响
    const d1 = Math.floor(sr * 0.1);
    const d2 = Math.floor(sr * 0.17);
    let rev = 0;
    if (i > d1) rev += L[i - d1] * 0.25;
    if (i > d2) rev += L[i - d2] * 0.12;
    sample += rev;

    let gEnv = 1;
    if (i < sr * 1.5) gEnv = i / (sr * 1.5);
    if (i > n - sr * 2.5) gEnv = (n - i) / (sr * 2.5);
    sample *= gEnv;
    sample = Math.max(-0.9, Math.min(0.9, sample));
    L[i] = sample;
    R[i] = sample * 0.92 + (i > 8 ? L[i - 8] * 0.08 : 0);
  }
  return [L, R];
}

// --- 4. 史诗大气: 低音铜管 + 定音鼓 + 上行和弦 ---
function synthEpic(sr: number, dur: number): Float32Array[] {
  const n = sr * dur;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const bpm = 85;
  const beatDur = 60 / bpm;
  // 上行音阶和弦: Cm → Eb → F → G
  const chords = [
    [130.81, 155.56, 196.00], // Cm
    [155.56, 196.00, 233.08], // Eb
    [174.61, 220.00, 261.63], // F
    [196.00, 246.94, 293.66], // G
  ];
  const chordDur = beatDur * 4;
  let fState = [0, 0, 0, 0];

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const ci = Math.floor(t / chordDur) % chords.length;
    const chord = chords[ci];
    const posInC = t - ci * chordDur;
    const beat = t / beatDur;
    let sample = 0;

    // 铜管: 低频正弦+三角，浑厚有力
    for (const freq of chord) {
      const env = Math.min(1, posInC / 0.3) * (posInC < chordDur * 0.8 ? 1 : (chordDur - posInC) / (chordDur * 0.2));
      sample += (sine(freq, t) * 0.6 + tri(freq * 2, t) * 0.3 + sine(freq * 3, t) * 0.1) * 0.06 * env;
    }

    // 定音鼓: 每两拍一次
    const timpaniBeat = beat % 2;
    if (timpaniBeat < 0.3) {
      const tEnv = Math.exp(-timpaniBeat * 12);
      const tFreq = 100 * Math.exp(-timpaniBeat * 8) + 60;
      sample += sine(tFreq, timpaniBeat) * tEnv * 0.2;
    }

    // 军鼓滚奏: 每小节最后一拍
    const barBeat = beat % 4;
    if (barBeat > 3.5) {
      sample += noise(t, 99) * 0.05 * Math.sin(2 * Math.PI * 20 * t);
    }

    const f = lp4(sample, fState, 1800, 0.5, sr);
    fState = f.state;
    sample = f.out;

    let gEnv = 1;
    if (i < sr * 0.8) gEnv = i / (sr * 0.8);
    if (i > n - sr * 2.0) gEnv = (n - i) / (sr * 2.0);
    sample *= gEnv;
    sample = Math.max(-0.9, Math.min(0.9, sample));
    L[i] = sample;
    R[i] = sample;
  }
  return [L, R];
}

// --- 5. 自然环境: 雨声+鸟鸣+溪流+微风 ---
function synthNature(sr: number, dur: number): Float32Array[] {
  const n = sr * dur;
  const L = new Float32Array(n);
  const R = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let sample = 0;

    // 雨声: 带通滤波噪声
    let rain = noise(t, 0) * 0.08;
    rain = lp1(rain, i > 0 ? L[i - 1] * 0.3 : 0, 3000, sr);
    rain = lp1(rain, i > 0 ? rain : 0, 3000, sr); // 二次低通
    sample += rain * 0.5;

    // 溪流: 缓慢调制的中频噪声
    const streamMod = Math.sin(2 * Math.PI * 0.3 * t) * 0.5 + 0.5;
    let stream = noise(t, 77) * 0.04 * streamMod;
    stream = lp1(stream, 0, 1500, sr);
    sample += stream;

    // 鸟鸣: 周期性短促高频正弦脉冲
    const birdCycle = t % 3.7;
    if (birdCycle > 1.0 && birdCycle < 1.4) {
      const birdT = birdCycle - 1.0;
      const birdEnv = Math.exp(-birdT * 8) * Math.min(1, birdT / 0.01);
      const birdFreq = 2800 + Math.sin(2 * Math.PI * 12 * birdT) * 400; // 颤音
      sample += sine(birdFreq, t) * 0.03 * birdEnv;
    }
    if (birdCycle > 2.2 && birdCycle < 2.5) {
      const birdT = birdCycle - 2.2;
      const birdEnv = Math.exp(-birdT * 10) * Math.min(1, birdT / 0.008);
      const birdFreq = 3200 + Math.sin(2 * Math.PI * 15 * birdT) * 300;
      sample += sine(birdFreq, t) * 0.025 * birdEnv;
    }

    // 微风: 极低频调制噪声
    const windMod = Math.sin(2 * Math.PI * 0.1 * t) * 0.5 + 0.5;
    let wind = noise(t, 123) * 0.03 * windMod;
    wind = lp1(wind, 0, 400, sr);
    sample += wind;

    let gEnv = 1;
    if (i < sr * 1.0) gEnv = i / (sr * 1.0);
    if (i > n - sr * 2.0) gEnv = (n - i) / (sr * 2.0);
    sample *= gEnv;
    sample = Math.max(-0.9, Math.min(0.9, sample));
    L[i] = sample;
    R[i] = sample * 0.9 + noise(t, 456) * 0.02; // 右声道略不同
  }
  return [L, R];
}

// --- 6. 电影配乐: 弦乐垫音+钢琴点缀+缓慢节奏 ---
function synthCinematic(sr: number, dur: number): Float32Array[] {
  const n = sr * dur;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const chords = [
    [130.81, 164.81, 196.00, 261.63], // Cm
    [116.54, 146.83, 174.61, 233.08], // Bb
    [103.83, 130.81, 155.56, 207.65], // Ab
    [116.54, 146.83, 196.00, 233.08], // Bb Variation
  ];
  const chordDur = 4.5;
  let fState = [0, 0, 0, 0];

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const ci = Math.floor(t / chordDur) % chords.length;
    const chord = chords[ci];
    const posInC = t - ci * chordDur;
    let sample = 0;

    // 弦乐垫音
    for (const freq of chord) {
      const vibrato = Math.sin(2 * Math.PI * 4.5 * t) * 2;
      const f = freq * Math.pow(2, vibrato / 1200);
      const env = Math.min(1, posInC / 1.2) * Math.max(0, 1 - posInC * 0.12);
      sample += (sine(f, t) * 0.7 + tri(f, t) * 0.3) * 0.04 * env;
    }

    // 钢琴点缀: 每和弦周期第2秒一个高音
    if (posInC > 1.8 && posInC < 2.8) {
      const pianoT = posInC - 1.8;
      const pianoEnv = Math.exp(-pianoT * 3) * Math.min(1, pianoT / 0.005);
      const pianoFreq = chord[3] * 2; // 高八度
      sample += (sine(pianoFreq, t) * 0.8 + tri(pianoFreq * 2, t) * 0.2) * 0.05 * pianoEnv;
    }

    const f = lp4(sample, fState, 1500, 0.3, sr);
    fState = f.state;
    sample = f.out;

    // 混响
    const d1 = Math.floor(sr * 0.12);
    const d2 = Math.floor(sr * 0.2);
    if (i > d1) sample += L[i - d1] * 0.2;
    if (i > d2) sample += L[i - d2] * 0.08;

    let gEnv = 1;
    if (i < sr * 1.5) gEnv = i / (sr * 1.5);
    if (i > n - sr * 2.5) gEnv = (n - i) / (sr * 2.5);
    sample *= gEnv;
    sample = Math.max(-0.9, Math.min(0.9, sample));
    L[i] = sample;
    R[i] = sample * 0.93 + (i > 6 ? L[i - 6] * 0.07 : 0);
  }
  return [L, R];
}

// --- 7. 电子律动: 四四拍底鼓+合成bass+琶音 ---
function synthElectronic(sr: number, dur: number): Float32Array[] {
  const n = sr * dur;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const bpm = 128;
  const beatDur = 60 / bpm;
  const bassLine = [65.41, 73.42, 82.41, 65.41]; // C2 D2 E2 C2
  const arpNotes = [523.25, 659.25, 783.99, 659.25]; // C5 E5 G5 E5 琶音
  let fState = [0, 0, 0, 0];

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const beat = t / beatDur;
    const bar = Math.floor(beat / 4);
    const beatInBar = beat % 4;
    let sample = 0;

    // 四四拍底鼓
    const kickPhase = beatInBar % 1;
    if (kickPhase < 0.12) {
      const kickEnv = Math.exp(-kickPhase * 35);
      const kickFreq = 180 * Math.exp(-kickPhase * 25) + 40;
      sample += sine(kickFreq, kickPhase) * kickEnv * 0.3;
    }

    // 离拍hi-hat
    const hhBeat = (beat + 0.5) % 1;
    if (hhBeat < 0.025) {
      sample += noise(t, 42) * Math.exp(-hhBeat * 250) * 0.06;
    }

    // Bass: 每拍一个低音
    const bassFreq = bassLine[bar % bassLine.length];
    const bassEnv = Math.exp(-(beatInBar % 1) * 4) * Math.min(1, (beatInBar % 1) / 0.005);
    sample += sine(bassFreq, t) * 0.1 * bassEnv;

    // 琶音: 十六分音符
    const arpIdx = Math.floor(beat * 4) % arpNotes.length;
    const arpPhase = (beat * 4) % 1;
    const arpEnv = Math.exp(-arpPhase * 8) * Math.min(1, arpPhase / 0.003);
    sample += (sine(arpNotes[arpIdx], t) * 0.6 + tri(arpNotes[arpIdx], t) * 0.4) * 0.04 * arpEnv;

    const f = lp4(sample, fState, 3500, 0.5, sr);
    fState = f.state;
    sample = f.out;

    let gEnv = 1;
    if (i < sr * 0.3) gEnv = i / (sr * 0.3);
    if (i > n - sr * 1.0) gEnv = (n - i) / (sr * 1.0);
    sample *= gEnv;
    sample = Math.max(-0.9, Math.min(0.9, sample));
    L[i] = sample;
    R[i] = sample;
  }
  return [L, R];
}

// --- 8. 爵士即兴: 七和弦+swing节奏+walking bass ---
function synthJazz(sr: number, dur: number): Float32Array[] {
  const n = sr * dur;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const bpm = 95;
  const beatDur = 60 / bpm;
  // 爵士七和弦
  const chords = [
    [261.63, 329.63, 392.00, 466.16], // Cmaj7
    [293.66, 349.23, 440.00, 523.25], // Dm7
    [261.63, 329.63, 392.00, 466.16], // Cmaj7
    [196.00, 246.94, 293.66, 349.23], // G7
  ];
  const walkingBass = [130.81, 146.83, 164.81, 174.61, 130.81, 164.81, 146.83, 123.47];
  const chordDur = beatDur * 4;
  let fState = [0, 0, 0, 0];

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const beat = t / beatDur;
    const bar = Math.floor(beat / 4);
    const beatInBar = beat % 4;
    let sample = 0;

    // Walking bass: 每拍一个音
    const bassFreq = walkingBass[Math.floor(beat) % walkingBass.length];
    const bassPhase = beatInBar % 1;
    const bassEnv = Math.exp(-bassPhase * 3) * Math.min(1, bassPhase / 0.008);
    sample += sine(bassFreq, t) * 0.08 * bassEnv;

    // 和弦: swing节奏(长-短)
    const ci = Math.floor(t / chordDur) % chords.length;
    const chord = chords[ci];
    // Swing: 前半拍长，后半拍短
    const swingBeat = beatInBar % 1;
    if (swingBeat < 0.33 || (swingBeat > 0.66 && swingBeat < 0.85)) {
      for (const freq of chord) {
        const env = Math.exp(-(swingBeat < 0.33 ? swingBeat : swingBeat - 0.66) * 4) * 0.02;
        sample += (sine(freq, t) * 0.7 + tri(freq, t) * 0.3) * env;
      }
    }

    // Hi-hat: swing模式
    const hhBeat = beat * 1.5; // 三连音
    const hhPhase = hhBeat % 1;
    if (hhPhase < 0.02) {
      sample += noise(t, 33) * Math.exp(-hhPhase * 300) * 0.03;
    }

    const f = lp4(sample, fState, 2800, 0.3, sr);
    fState = f.state;
    sample = f.out;

    let gEnv = 1;
    if (i < sr * 0.5) gEnv = i / (sr * 0.5);
    if (i > n - sr * 1.5) gEnv = (n - i) / (sr * 1.5);
    sample *= gEnv;
    sample = Math.max(-0.9, Math.min(0.9, sample));
    L[i] = sample;
    R[i] = sample * 0.95 + (i > 4 ? L[i - 4] * 0.05 : 0);
  }
  return [L, R];
}

// --- 9. 古典优雅: 对位旋律+正弦长音+优雅律动 ---
function synthClassical(sr: number, dur: number): Float32Array[] {
  const n = sr * dur;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  // 巴赫式对位: 两条旋律线交织
  const melody1 = [523.25, 587.33, 659.25, 587.33, 523.25, 493.88, 440.00, 493.88]; // 上声部
  const melody2 = [261.63, 293.66, 329.63, 349.23, 329.63, 293.66, 261.63, 246.94]; // 下声部
  const noteDur = 0.6;
  let fState = [0, 0, 0, 0];

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let sample = 0;

    // 上声部: 小提琴般音色
    const m1Idx = Math.floor(t / noteDur) % melody1.length;
    const m1Phase = (t / noteDur) % 1;
    const m1Env = adsr(m1Phase * noteDur, noteDur, 0.05, 0.1, 0.6, 0.15);
    const m1Freq = melody1[m1Idx];
    // 揉弦
    const vib1 = Math.sin(2 * Math.PI * 5.5 * t) * 4;
    sample += (sine(m1Freq * Math.pow(2, vib1 / 1200), t) * 0.7 + tri(m1Freq, t) * 0.3) * 0.05 * m1Env;

    // 下声部: 大提琴般音色
    const m2Idx = Math.floor(t / noteDur + 0.5) % melody2.length; // 错开半拍
    const m2Phase = ((t / noteDur) + 0.5) % 1;
    const m2Env = adsr(m2Phase * noteDur, noteDur, 0.08, 0.15, 0.55, 0.2);
    const m2Freq = melody2[m2Idx];
    sample += sine(m2Freq, t) * 0.06 * m2Env;

    const f = lp4(sample, fState, 2200, 0.3, sr);
    fState = f.state;
    sample = f.out;

    // 教堂混响
    const d1 = Math.floor(sr * 0.15);
    const d2 = Math.floor(sr * 0.25);
    if (i > d1) sample += L[i - d1] * 0.15;
    if (i > d2) sample += L[i - d2] * 0.06;

    let gEnv = 1;
    if (i < sr * 1.0) gEnv = i / (sr * 1.0);
    if (i > n - sr * 2.0) gEnv = (n - i) / (sr * 2.0);
    sample *= gEnv;
    sample = Math.max(-0.9, Math.min(0.9, sample));
    L[i] = sample;
    R[i] = sample;
  }
  return [L, R];
}

// --- 10. 摇滚热血: Power chord + 驱动鼓点 + 失真bass ---
function synthRock(sr: number, dur: number): Float32Array[] {
  const n = sr * dur;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const bpm = 130;
  const beatDur = 60 / bpm;
  const powerChords = [
    [130.81, 196.00], // C5
    [110.00, 164.81], // A5
    [116.54, 174.61], // Bb5
    [98.00, 146.83],  // G5
  ];
  let fState = [0, 0, 0, 0];

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const beat = t / beatDur;
    const bar = Math.floor(beat / 4);
    const beatInBar = beat % 4;
    let sample = 0;

    // 底鼓: 每拍
    const kickPhase = beatInBar % 1;
    if (kickPhase < 0.1) {
      sample += sine(150 * Math.exp(-kickPhase * 25) + 50, kickPhase) * Math.exp(-kickPhase * 30) * 0.25;
    }

    // 军鼓: 2、4拍
    if ((Math.floor(beat) % 4 === 1 || Math.floor(beat) % 4 === 3) && kickPhase < 0.08) {
      sample += noise(t, 88) * Math.exp(-kickPhase * 50) * 0.12;
    }

    // Hi-hat: 八分音符
    const hhPhase = (beat * 2) % 1;
    if (hhPhase < 0.02) {
      sample += noise(t, 42) * Math.exp(-hhPhase * 300) * 0.05;
    }

    // Power chord: 三角波模拟失真吉他
    const chord = powerChords[bar % powerChords.length];
    const chordEnv = adsr(beatInBar, beatDur * 4, 0.01, 0.05, 0.7, 0.1);
    for (const freq of chord) {
      // 轻微失真: clip三角波
      let guitar = tri(freq, t) * 1.5;
      guitar = Math.max(-0.8, Math.min(0.8, guitar)); // soft clip
      sample += guitar * 0.06 * chordEnv;
    }

    const f = lp4(sample, fState, 2500, 0.8, sr);
    fState = f.state;
    sample = f.out;

    let gEnv = 1;
    if (i < sr * 0.3) gEnv = i / (sr * 0.3);
    if (i > n - sr * 1.0) gEnv = (n - i) / (sr * 1.0);
    sample *= gEnv;
    sample = Math.max(-0.9, Math.min(0.9, sample));
    L[i] = sample;
    R[i] = sample;
  }
  return [L, R];
}

// --- 11. 原声民谣: 拨弦音色+分解和弦+轻柔 ---
function synthAcoustic(sr: number, dur: number): Float32Array[] {
  const n = sr * dur;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  // G-Em-C-D 经典民谣进行
  const fingerpick = [
    [196.00, 246.94, 293.66, 392.00], // G
    [164.81, 196.00, 246.94, 329.63], // Em
    [261.63, 329.63, 392.00, 523.25], // C
    [293.66, 370.00, 440.00, 587.33], // D
  ];
  const chordDur = 3.2;
  let fState = [0, 0, 0, 0];

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const ci = Math.floor(t / chordDur) % fingerpick.length;
    const chord = fingerpick[ci];
    const posInC = t - ci * chordDur;
    let sample = 0;

    // 指弹: 每个音依次拨响（0.25秒间隔）
    for (let c = 0; c < chord.length; c++) {
      const pickTime = c * 0.25;
      const noteT = posInC - pickTime;
      if (noteT > 0 && noteT < 2.0) {
        // 拨弦音色: 快起慢衰 + 少量泛音
        const env = Math.exp(-noteT * 2.0) * Math.min(1, noteT / 0.003);
        const freq = chord[c];
        sample += (sine(freq, t) * 0.65 + tri(freq * 2, t) * 0.25 + sine(freq * 3, t) * 0.1) * 0.06 * env;
      }
    }

    // 低音: 每小节第一拍
    const bassFreq = chord[0] / 2;
    if (posInC < 1.5) {
      const bassEnv = Math.exp(-posInC * 1.5) * Math.min(1, posInC / 0.005);
      sample += sine(bassFreq, t) * 0.05 * bassEnv;
    }

    const f = lp4(sample, fState, 2800, 0.3, sr);
    fState = f.state;
    sample = f.out;

    let gEnv = 1;
    if (i < sr * 0.8) gEnv = i / (sr * 0.8);
    if (i > n - sr * 1.5) gEnv = (n - i) / (sr * 1.5);
    sample *= gEnv;
    sample = Math.max(-0.9, Math.min(0.9, sample));
    L[i] = sample;
    R[i] = sample * 0.93 + (i > 7 ? L[i - 7] * 0.07 : 0);
  }
  return [L, R];
}

// --- 12. 氛围冥想: 极慢drone+泛音+深混响 ---
function synthAmbient(sr: number, dur: number): Float32Array[] {
  const n = sr * dur;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const droneFreqs = [65.41, 98.00, 130.81]; // C2 G2 C3 drone
  let fState = [0, 0, 0, 0];

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let sample = 0;

    // 基础drone
    for (const freq of droneFreqs) {
      const env = Math.min(1, t / 3.0); // 极慢起
      const vibrato = Math.sin(2 * Math.PI * 0.3 * t) * 5; // 极慢颤音
      const f = freq * Math.pow(2, vibrato / 1200);
      sample += sine(f, t) * 0.04 * env;
    }

    // 泛音层: 缓慢浮现的高频
    const overtonePhase = Math.sin(2 * Math.PI * 0.05 * t) * 0.5 + 0.5; // 20秒周期
    sample += sine(523.25, t) * 0.015 * overtonePhase;
    sample += sine(783.99, t) * 0.008 * overtonePhase * 0.5;

    const f = lp4(sample, fState, 1000, 0.15, sr);
    fState = f.state;
    sample = f.out;

    // 深混响
    const d1 = Math.floor(sr * 0.2);
    const d2 = Math.floor(sr * 0.35);
    const d3 = Math.floor(sr * 0.5);
    if (i > d1) sample += L[i - d1] * 0.2;
    if (i > d2) sample += L[i - d2] * 0.1;
    if (i > d3) sample += L[i - d3] * 0.05;

    let gEnv = 1;
    if (i < sr * 3.0) gEnv = i / (sr * 3.0);
    if (i > n - sr * 3.0) gEnv = (n - i) / (sr * 3.0);
    sample *= gEnv;
    sample = Math.max(-0.9, Math.min(0.9, sample));
    L[i] = sample;
    R[i] = sample * 0.85 + (i > 12 ? L[i - 12] * 0.15 : 0);
  }
  return [L, R];
}

// --- 13. 悬疑紧张: 不协和音+心跳节奏+渐强 ---
function synthSuspense(sr: number, dur: number): Float32Array[] {
  const n = sr * dur;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const bpm = 65;
  const beatDur = 60 / bpm;
  let fState = [0, 0, 0, 0];

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const beat = t / beatDur;
    let sample = 0;

    // 不协和双音: 三全音(增四度) — 恐怖感核心
    const tritone1 = 130.81; // C3
    const tritone2 = 185.00; // #F3 (增四度)
    const env = Math.min(1, t / 2.0) * 0.04;
    sample += sine(tritone1, t) * env;
    sample += sine(tritone2, t) * env * 0.8;

    // 缓慢渐强的泛音
    const crescendo = Math.min(1, t / (dur * 0.8));
    sample += sine(261.63 * 2.02, t) * 0.02 * crescendo; // 微失谐制造不安
    sample += sine(261.63 * 1.498, t) * 0.015 * crescendo; // 近似三全音

    // 心跳低频脉冲
    const heartBeat = t % 1.1;
    if (heartBeat < 0.12) {
      sample += sine(40 + 30 * Math.exp(-heartBeat * 20), heartBeat) * Math.exp(-heartBeat * 15) * 0.15 * crescendo;
    }
    // 双重搏动
    if (heartBeat > 0.25 && heartBeat < 0.35) {
      const hb2 = heartBeat - 0.25;
      sample += sine(35 + 20 * Math.exp(-hb2 * 20), hb2) * Math.exp(-hb2 * 15) * 0.1 * crescendo;
    }

    const f = lp4(sample, fState, 700, 1.0, sr);
    fState = f.state;
    sample = f.out;

    let gEnv = 1;
    if (i < sr * 2.0) gEnv = i / (sr * 2.0);
    if (i > n - sr * 1.5) gEnv = (n - i) / (sr * 1.5);
    sample *= gEnv;
    sample = Math.max(-0.9, Math.min(0.9, sample));
    L[i] = sample;
    R[i] = sample * 0.95 + noise(t, 333) * 0.01 * crescendo;
  }
  return [L, R];
}

// --- 14. 轻松幽默: 弹跳节奏+滑音+pizzicato ---
function synthComedy(sr: number, dur: number): Float32Array[] {
  const n = sr * dur;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const bpm = 120;
  const beatDur = 60 / bpm;
  const melody = [392.00, 440.00, 523.25, 440.00, 392.00, 329.63, 392.00, 523.25]; // 弹跳旋律
  let fState = [0, 0, 0, 0];

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const beat = t / beatDur;
    const noteIdx = Math.floor(beat) % melody.length;
    const beatInNote = beat % 1;
    let sample = 0;

    // Pizzicato弹跳音: 快起快衰
    const freq = melody[noteIdx];
    const env = Math.exp(-beatInNote * 8) * Math.min(1, beatInNote / 0.003);
    sample += (sine(freq, t) * 0.6 + tri(freq * 2, t) * 0.4) * 0.08 * env;

    // 滑音效果: 每个音开头快速上滑
    if (beatInNote < 0.05) {
      const slideFreq = freq * 0.7 + (freq - freq * 0.7) * (beatInNote / 0.05);
      sample += sine(slideFreq, t) * 0.03 * (1 - beatInNote / 0.05);
    }

    // 轻快bass
    const bassFreq = freq / 4;
    const bassEnv = Math.exp(-beatInNote * 5) * Math.min(1, beatInNote / 0.005);
    sample += sine(bassFreq, t) * 0.04 * bassEnv;

    // 俏皮hi-hat
    const hhPhase = (beat * 2) % 1;
    if (hhPhase < 0.015) {
      sample += noise(t, 42) * Math.exp(-hhPhase * 400) * 0.03;
    }

    const f = lp4(sample, fState, 3500, 0.3, sr);
    fState = f.state;
    sample = f.out;

    let gEnv = 1;
    if (i < sr * 0.3) gEnv = i / (sr * 0.3);
    if (i > n - sr * 0.8) gEnv = (n - i) / (sr * 0.8);
    sample *= gEnv;
    sample = Math.max(-0.9, Math.min(0.9, sample));
    L[i] = sample;
    R[i] = sample;
  }
  return [L, R];
}

// --- 15. 商务专业: 平稳钢琴+轻柔鼓点+上行旋律 ---
function synthCorporate(sr: number, dur: number): Float32Array[] {
  const n = sr * dur;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const bpm = 100;
  const beatDur = 60 / bpm;
  const melody = [261.63, 329.63, 392.00, 523.25, 659.25, 523.25, 392.00, 329.63]; // 上行再下行
  const chords = [
    [261.63, 329.63, 392.00], // C
    [220.00, 277.18, 329.63], // Am
    [349.23, 440.00, 523.25], // F
    [392.00, 493.88, 587.33], // G
  ];
  const chordDur = beatDur * 4;
  let fState = [0, 0, 0, 0];

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const beat = t / beatDur;
    const bar = Math.floor(beat / 4);
    let sample = 0;

    // 和弦垫音
    const ci = Math.floor(t / chordDur) % chords.length;
    const chord = chords[ci];
    for (const freq of chord) {
      sample += sine(freq, t) * 0.025;
    }

    // 钢琴旋律: 每拍一个音
    const mIdx = Math.floor(beat) % melody.length;
    const mPhase = beat % 1;
    const mEnv = Math.exp(-mPhase * 3) * Math.min(1, mPhase / 0.008);
    sample += (sine(melody[mIdx], t) * 0.8 + tri(melody[mIdx] * 2, t) * 0.2) * 0.05 * mEnv;

    // 轻kick: 每两拍
    if (Math.floor(beat) % 2 === 0) {
      const kickPhase = beat % 1;
      if (kickPhase < 0.08) {
        sample += sine(120 * Math.exp(-kickPhase * 30) + 50, kickPhase) * Math.exp(-kickPhase * 25) * 0.08;
      }
    }

    const f = lp4(sample, fState, 2800, 0.3, sr);
    fState = f.state;
    sample = f.out;

    let gEnv = 1;
    if (i < sr * 0.5) gEnv = i / (sr * 0.5);
    if (i > n - sr * 1.0) gEnv = (n - i) / (sr * 1.0);
    sample *= gEnv;
    sample = Math.max(-0.9, Math.min(0.9, sample));
    L[i] = sample;
    R[i] = sample;
  }
  return [L, R];
}

// --- 16. Lo-Fi低保真: 黑胶噪点+爵士和弦+磁带抖动 ---
function synthLofi(sr: number, dur: number): Float32Array[] {
  const n = sr * dur;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const bpm = 78;
  const beatDur = 60 / bpm;
  const chords = [
    [261.63, 329.63, 392.00, 466.16], // Cmaj7
    [220.00, 277.18, 329.63, 415.30], // Am7
    [349.23, 440.00, 523.25, 587.33], // Fmaj7
    [293.66, 349.23, 440.00, 523.25], // Dm7
  ];
  const chordDur = beatDur * 4;
  let fState = [0, 0, 0, 0];

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let sample = 0;

    // 黑胶噪点: 持续低音量噪声 + 周期性爆音
    const crackle = noise(t, 0) * 0.012;
    // 爆音: 随机间隔
    const popCycle = t % 0.73;
    const pop = popCycle < 0.001 ? (noise(t, 123) * 0.08) : 0;
    sample += crackle + pop;

    // 爵士和弦: 温暖三角波
    const ci = Math.floor(t / chordDur) % chords.length;
    const chord = chords[ci];
    for (const freq of chord) {
      // 磁带抖动: 缓慢随机频率偏移
      const wow = Math.sin(2 * Math.PI * 0.5 * t) * 3 + Math.sin(2 * Math.PI * 1.3 * t) * 1.5;
      const f = freq * Math.pow(2, wow / 1200);
      sample += tri(f, t) * 0.025;
    }

    // 简单kick: 每拍
    const beat = t / beatDur;
    const kickPhase = beat % 1;
    if (kickPhase < 0.08) {
      sample += sine(80 * Math.exp(-kickPhase * 25) + 40, kickPhase) * Math.exp(-kickPhase * 20) * 0.06;
    }

    // Hi-hat: 离拍
    const hhPhase = (beat + 0.5) % 1;
    if (hhPhase < 0.015) {
      sample += noise(t, 42) * Math.exp(-hhPhase * 350) * 0.025;
    }

    const f = lp4(sample, fState, 1200, 0.5, sr); // 低通截止1200Hz — lo-fi核心
    fState = f.state;
    sample = f.out;

    let gEnv = 1;
    if (i < sr * 0.5) gEnv = i / (sr * 0.5);
    if (i > n - sr * 1.5) gEnv = (n - i) / (sr * 1.5);
    sample *= gEnv;
    sample = Math.max(-0.9, Math.min(0.9, sample));
    L[i] = sample;
    R[i] = sample * 0.92 + noise(t, 789) * 0.005; // 右声道额外噪点
  }
  return [L, R];
}

// --- 17. 世界音乐: 手鼓+异域音阶+呼麦泛音 ---
function synthWorld(sr: number, dur: number): Float32Array[] {
  const n = sr * dur;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const bpm = 95;
  const beatDur = 60 / bpm;
  // 中东音阶: Phrygian dominant
  const scale = [261.63, 277.18, 329.63, 349.23, 392.00, 415.30, 493.88];
  let fState = [0, 0, 0, 0];

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const beat = t / beatDur;
    const beatInBar = beat % 4;
    let sample = 0;

    // 手鼓: 非对称节奏
    const drumPattern = [1, 0, 1, 1, 0, 1, 0, 0];
    const drumIdx = Math.floor(beat * 2) % drumPattern.length;
    if (drumPattern[drumIdx] === 1) {
      const drumPhase = (beat * 2) % 1;
      if (drumPhase < 0.05) {
        // 手鼓: 中频打击
        sample += noise(t, 55) * Math.exp(-drumPhase * 80) * 0.08;
        sample += sine(200, drumPhase) * Math.exp(-drumPhase * 40) * 0.05;
      }
    }

    // 异域旋律: 正弦+微泛音
    const noteIdx = Math.floor(beat) % scale.length;
    const freq = scale[noteIdx];
    const notePhase = beat % 1;
    const noteEnv = Math.exp(-notePhase * 2.5) * Math.min(1, notePhase / 0.01);
    // 颤音装饰
    const vibrato = Math.sin(2 * Math.PI * 6 * t) * 5;
    sample += (sine(freq * Math.pow(2, vibrato / 1200), t) * 0.6 + tri(freq, t) * 0.3 + sine(freq * 3, t) * 0.1) * 0.04 * noteEnv;

    // Drone底音
    sample += sine(130.81, t) * 0.02; // C3 drone

    const f = lp4(sample, fState, 2500, 0.4, sr);
    fState = f.state;
    sample = f.out;

    let gEnv = 1;
    if (i < sr * 0.5) gEnv = i / (sr * 0.5);
    if (i > n - sr * 1.0) gEnv = (n - i) / (sr * 1.0);
    sample *= gEnv;
    sample = Math.max(-0.9, Math.min(0.9, sample));
    L[i] = sample;
    R[i] = sample * 0.9 + (i > 10 ? L[i - 10] * 0.1 : 0);
  }
  return [L, R];
}

// --- 18. 节日欢庆: 欢快鼓点+明亮旋律+铃音 ---
function synthHoliday(sr: number, dur: number): Float32Array[] {
  const n = sr * dur;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const bpm = 115;
  const beatDur = 60 / bpm;
  const melody = [523.25, 587.33, 659.25, 783.99, 880.00, 783.99, 659.25, 523.25];
  let fState = [0, 0, 0, 0];

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const beat = t / beatDur;
    const beatInBar = beat % 4;
    let sample = 0;

    // 底鼓
    const kickPhase = beatInBar % 1;
    if (kickPhase < 0.1) {
      sample += sine(150 * Math.exp(-kickPhase * 25) + 50, kickPhase) * Math.exp(-kickPhase * 25) * 0.2;
    }

    // 军鼓
    if ((Math.floor(beat) % 4 === 1 || Math.floor(beat) % 4 === 3) && kickPhase < 0.06) {
      sample += noise(t, 88) * Math.exp(-kickPhase * 60) * 0.08;
    }

    // 铃音: 高频短促
    const bellPhase = (beat * 2) % 1;
    if (bellPhase < 0.1) {
      sample += sine(2500, t) * Math.exp(-bellPhase * 30) * 0.02;
      sample += sine(4000, t) * Math.exp(-bellPhase * 50) * 0.01;
    }

    // 明亮旋律
    const mIdx = Math.floor(beat) % melody.length;
    const mPhase = beat % 1;
    const mEnv = Math.exp(-mPhase * 4) * Math.min(1, mPhase / 0.005);
    sample += (sine(melody[mIdx], t) * 0.6 + tri(melody[mIdx], t) * 0.4) * 0.05 * mEnv;

    const f = lp4(sample, fState, 4000, 0.3, sr);
    fState = f.state;
    sample = f.out;

    let gEnv = 1;
    if (i < sr * 0.3) gEnv = i / (sr * 0.3);
    if (i > n - sr * 0.8) gEnv = (n - i) / (sr * 0.8);
    sample *= gEnv;
    sample = Math.max(-0.9, Math.min(0.9, sample));
    L[i] = sample;
    R[i] = sample;
  }
  return [L, R];
}

// --- 19. 国风古韵: 五声音阶+古筝拨弦+笛子颤音 ---
function synthChinese(sr: number, dur: number): Float32Array[] {
  const n = sr * dur;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  // 中国五声音阶: 宫商角徵羽 C D E G A
  const guzhengScale = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66];
  const diziScale = [1046.50, 1174.66, 1318.51, 1567.98, 1760.00]; // 笛子高八度
  const bpm = 58;
  const beatDur = 60 / bpm;
  let fState = [0, 0, 0, 0];

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const beat = t / beatDur;
    let sample = 0;

    // 古筝: 拨弦音色（快起慢衰+丰富泛音）
    const guzhengPattern = [1, 0, 0, 1, 0, 1, 0, 0]; // 非均匀节奏
    const gIdx = Math.floor(beat * 2) % guzhengPattern.length;
    if (guzhengPattern[gIdx] === 1) {
      const gPhase = (beat * 2) % 1;
      if (gPhase < 0.8) {
        const gNote = guzhengScale[Math.floor(beat) % guzhengScale.length];
        // 古筝音色: 正弦+2次3次5次泛音 + 快起慢衰
        const env = Math.exp(-gPhase * 3) * Math.min(1, gPhase / 0.002);
        sample += sine(gNote, t) * 0.5 * env * 0.05;
        sample += sine(gNote * 2, t) * 0.25 * env * 0.05; // 二次泛音
        sample += sine(gNote * 3, t) * 0.12 * env * 0.05; // 三次泛音
        sample += sine(gNote * 5, t) * 0.05 * env * 0.05; // 五次泛音
        // 拨弦瞬间"咔"声
        if (gPhase < 0.01) {
          sample += noise(t, 77) * 0.02;
        }
      }
    }

    // 竹笛: 长音+颤音+滑音
    const diziPhase = t % 5.0;
    if (diziPhase > 1.5) { // 1.5秒后进入
      const diziT = diziPhase - 1.5;
      const diziNote = diziScale[Math.floor(beat / 2) % diziScale.length];
      // 颤音: 6Hz频率调制
      const vibrato = Math.sin(2 * Math.PI * 6 * t) * 4;
      // 气息音: 噪声叠加
      const breath = noise(t, 256) * 0.005;
      const diziEnv = Math.min(1, diziT / 0.3) * Math.max(0, 1 - (diziT - 3.0) * 0.5);
      const freq = diziNote * Math.pow(2, vibrato / 1200);
      sample += (sine(freq, t) * 0.7 + tri(freq, t) * 0.2 + breath) * 0.035 * diziEnv;
    }

    // 低音drone: 古琴低音
    sample += sine(130.81, t) * 0.012; // C3
    sample += sine(196.00, t) * 0.008; // G3

    const f = lp4(sample, fState, 3500, 0.2, sr);
    fState = f.state;
    sample = f.out;

    // 中国式混响: 明亮偏长
    const d1 = Math.floor(sr * 0.1);
    const d2 = Math.floor(sr * 0.18);
    if (i > d1) sample += L[i - d1] * 0.12;
    if (i > d2) sample += L[i - d2] * 0.06;

    let gEnv = 1;
    if (i < sr * 1.0) gEnv = i / (sr * 1.0);
    if (i > n - sr * 2.0) gEnv = (n - i) / (sr * 2.0);
    sample *= gEnv;
    sample = Math.max(-0.9, Math.min(0.9, sample));
    L[i] = sample;
    R[i] = sample * 0.92 + (i > 8 ? L[i - 8] * 0.08 : 0);
  }
  return [L, R];
}

// --- 20. 陷阱说唱: 808低频bass+hi-hat三连音+无旋律 ---
function synthTrap(sr: number, dur: number): Float32Array[] {
  const n = sr * dur;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const bpm = 140;
  const beatDur = 60 / bpm;
  const bassNotes = [65.41, 73.42, 55.00, 65.41]; // 极低bass
  let fState = [0, 0, 0, 0];

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const beat = t / beatDur;
    const bar = Math.floor(beat / 4);
    const beatInBar = beat % 4;
    let sample = 0;

    // 808 bass: 长sustain + pitch drop
    const bassFreq = bassNotes[bar % bassNotes.length];
    const bassPhase = beatInBar % 1;
    // 808特征: 快速起音+长sustain+初始音高下滑
    const pitchDrop = bassFreq * (1 + 0.3 * Math.exp(-bassPhase * 15)); // 初始高30%然后滑落
    const bass808Env = Math.exp(-bassPhase * 0.8) * Math.min(1, bassPhase / 0.005); // 极长sustain
    sample += sine(pitchDrop, t) * 0.15 * bass808Env;

    // Hi-hat三连音: Trap标志性节奏
    const tripletBeat = beat * 3; // 三连音
    const hhPhase = tripletBeat % 1;
    // 模式: 快-快-慢
    const hhPattern = [1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1];
    const hhIdx = Math.floor(tripletBeat) % hhPattern.length;
    if (hhPattern[hhIdx] === 1 && hhPhase < 0.015) {
      sample += noise(t, 42) * Math.exp(-hhPhase * 400) * 0.04;
    }

    // 间隙性军鼓/rimshot
    if ((Math.floor(beat) % 4 === 2 || Math.floor(beat) % 4 === 3) && bassPhase < 0.03) {
      sample += noise(t, 88) * Math.exp(-bassPhase * 80) * 0.06;
    }

    const f = lp4(sample, fState, 600, 2.0, sr); // 极低截止 — 只有低频通过
    fState = f.state;
    sample = f.out;

    let gEnv = 1;
    if (i < sr * 0.3) gEnv = i / (sr * 0.3);
    if (i > n - sr * 1.0) gEnv = (n - i) / (sr * 1.0);
    sample *= gEnv;
    sample = Math.max(-0.9, Math.min(0.9, sample));
    L[i] = sample;
    R[i] = sample;
  }
  return [L, R];
}

// --- 21. R&B灵魂: 顺滑bass+柔和鼓点+福音和弦 ---
function synthRnb(sr: number, dur: number): Float32Array[] {
  const n = sr * dur;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const bpm = 85;
  const beatDur = 60 / bpm;
  const chords = [
    [261.63, 329.63, 392.00, 493.88], // Cmaj7
    [220.00, 277.18, 329.63, 415.30], // Am9
    [349.23, 440.00, 523.25, 659.25], // Fmaj7
    [293.66, 369.99, 440.00, 554.37], // Dm9
  ];
  const bassLine = [130.81, 110.00, 174.61, 146.83];
  const chordDur = beatDur * 4;
  let fState = [0, 0, 0, 0];

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const beat = t / beatDur;
    const bar = Math.floor(beat / 4);
    const beatInBar = beat % 4;
    let sample = 0;

    // 顺滑bass: 正弦+微揉弦
    const bassFreq = bassLine[bar % bassLine.length];
    const bassEnv = Math.exp(-(beatInBar % 1) * 1.5) * Math.min(1, (beatInBar % 1) / 0.01);
    const bassVib = Math.sin(2 * Math.PI * 4 * t) * 2;
    sample += sine(bassFreq * Math.pow(2, bassVib / 1200), t) * 0.08 * bassEnv;

    // 柔和和弦: 正弦波
    const ci = Math.floor(t / chordDur) % chords.length;
    const chord = chords[ci];
    for (const freq of chord) {
      sample += sine(freq, t) * 0.02;
    }

    // 轻鼓点
    const kickPhase = beatInBar % 1;
    if (kickPhase < 0.08) {
      sample += sine(100 * Math.exp(-kickPhase * 30) + 40, kickPhase) * Math.exp(-kickPhase * 20) * 0.08;
    }

    // 离拍clap
    const clapBeat = (beat + 0.5) % 1;
    if (clapBeat < 0.03 && Math.floor(beat) % 2 === 1) {
      sample += noise(t, 88) * Math.exp(-clapBeat * 100) * 0.04;
    }

    const f = lp4(sample, fState, 2200, 0.3, sr);
    fState = f.state;
    sample = f.out;

    let gEnv = 1;
    if (i < sr * 0.5) gEnv = i / (sr * 0.5);
    if (i > n - sr * 1.0) gEnv = (n - i) / (sr * 1.0);
    sample *= gEnv;
    sample = Math.max(-0.9, Math.min(0.9, sample));
    L[i] = sample;
    R[i] = sample * 0.93 + (i > 6 ? L[i - 6] * 0.07 : 0);
  }
  return [L, R];
}

// --- 22. 雷鬼阳光: Off-beat节奏+沉重bass+温暖和弦 ---
function synthReggae(sr: number, dur: number): Float32Array[] {
  const n = sr * dur;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const bpm = 78;
  const beatDur = 60 / bpm;
  const chords = [
    [261.63, 329.63, 392.00], // C
    [220.00, 277.18, 329.63], // Am
    [349.23, 440.00, 523.25], // F
    [392.00, 493.88, 587.33], // G
  ];
  const bassLine = [130.81, 110.00, 174.61, 98.00];
  const chordDur = beatDur * 4;
  let fState = [0, 0, 0, 0];

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const beat = t / beatDur;
    const bar = Math.floor(beat / 4);
    const beatInBar = beat % 4;
    let sample = 0;

    // Off-beat和弦(雷鬼标志): 在每拍的&处弹奏
    const offBeat = (beat + 0.5) % 1;
    const ci = Math.floor(t / chordDur) % chords.length;
    const chord = chords[ci];
    if (offBeat < 0.15) {
      const skankEnv = Math.exp(-offBeat * 20) * Math.min(1, offBeat / 0.003);
      for (const freq of chord) {
        sample += tri(freq, t) * 0.03 * skankEnv;
      }
    }

    // 沉重bass: 正弦波低音
    const bassFreq = bassLine[bar % bassLine.length];
    const bassPhase = beatInBar % 1;
    const bassEnv = Math.exp(-bassPhase * 1.5) * Math.min(1, bassPhase / 0.008);
    sample += sine(bassFreq, t) * 0.1 * bassEnv;

    // One-drop鼓: 只在第3拍打鼓
    if (Math.floor(beat) % 4 === 2) {
      const kickPhase = bassPhase;
      if (kickPhase < 0.1) {
        sample += sine(120 * Math.exp(-kickPhase * 25) + 45, kickPhase) * Math.exp(-kickPhase * 20) * 0.12;
        sample += noise(t, 88) * Math.exp(-kickPhase * 40) * 0.05;
      }
    }

    const f = lp4(sample, fState, 2500, 0.4, sr);
    fState = f.state;
    sample = f.out;

    let gEnv = 1;
    if (i < sr * 0.5) gEnv = i / (sr * 0.5);
    if (i > n - sr * 1.0) gEnv = (n - i) / (sr * 1.0);
    sample *= gEnv;
    sample = Math.max(-0.9, Math.min(0.9, sample));
    L[i] = sample;
    R[i] = sample;
  }
  return [L, R];
}

// --- 23. 励志激励: 上行和弦+渐强+鼓点递增 ---
function synthMotivational(sr: number, dur: number): Float32Array[] {
  const n = sr * dur;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const bpm = 88;
  const beatDur = 60 / bpm;
  // 上行和弦: C → F → Am → G → C(高)
  const chords = [
    [261.63, 329.63, 392.00],
    [349.23, 440.00, 523.25],
    [220.00, 261.63, 329.63],
    [196.00, 246.94, 293.66],
    [523.25, 659.25, 783.99], // 高八度C
  ];
  const chordDur = beatDur * 4;
  let fState = [0, 0, 0, 0];

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const beat = t / beatDur;
    const bar = Math.floor(beat / 4);
    const beatInBar = beat % 4;
    const ci = Math.floor(t / chordDur) % chords.length;
    const chord = chords[ci];
    const crescendo = Math.min(1, t / (dur * 0.6)); // 渐强
    let sample = 0;

    // 和弦: 正弦+三角
    for (const freq of chord) {
      sample += (sine(freq, t) * 0.6 + tri(freq * 2, t) * 0.4) * 0.03 * (0.5 + crescendo * 0.5);
    }

    // 上行旋律
    const melodyNotes = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66, 1318.51];
    const mIdx = Math.floor(beat) % melodyNotes.length;
    const mPhase = beat % 1;
    const mEnv = Math.exp(-mPhase * 3) * Math.min(1, mPhase / 0.008);
    sample += sine(melodyNotes[mIdx], t) * 0.04 * mEnv * crescendo;

    // 鼓点递增: 前半少后半多
    if (crescendo > 0.3) {
      const kickPhase = beatInBar % 1;
      if (kickPhase < 0.08 && Math.floor(beat) % 2 === 0) {
        sample += sine(120 * Math.exp(-kickPhase * 30) + 50, kickPhase) * Math.exp(-kickPhase * 25) * 0.08 * crescendo;
      }
      if (Math.floor(beat) % 4 === 2 && kickPhase < 0.06) {
        sample += noise(t, 88) * Math.exp(-kickPhase * 60) * 0.05 * crescendo;
      }
    }

    const f = lp4(sample, fState, 3000, 0.3, sr);
    fState = f.state;
    sample = f.out;

    let gEnv = 1;
    if (i < sr * 1.0) gEnv = i / (sr * 1.0);
    if (i > n - sr * 1.5) gEnv = (n - i) / (sr * 1.5);
    sample *= gEnv;
    sample = Math.max(-0.9, Math.min(0.9, sample));
    L[i] = sample;
    R[i] = sample;
  }
  return [L, R];
}

// --- 24. 复古怀旧: 8-bit方波+简单旋律+芯片鼓点 ---
function synthRetro(sr: number, dur: number): Float32Array[] {
  const n = sr * dur;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const bpm = 120;
  const beatDur = 60 / bpm;
  const melody = [523.25, 587.33, 659.25, 523.25, 659.25, 783.99, 659.25, 523.25]; // 8-bit经典旋律
  const bassLine = [130.81, 130.81, 174.61, 174.61, 146.83, 146.83, 196.00, 196.00];
  let fState = [0, 0, 0, 0];

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const beat = t / beatDur;
    const beatInBar = beat % 4;
    let sample = 0;

    // 方波旋律 (8-bit标志音色)
    const mIdx = Math.floor(beat) % melody.length;
    const mPhase = beat % 1;
    const mEnv = Math.min(1, mPhase / 0.005) * (mPhase < 0.8 ? 1 : (1 - mPhase) / 0.2);
    sample += sqr(melody[mIdx], t, 0.5) * 0.04 * mEnv;

    // 方波bass
    const bIdx = Math.floor(beat) % bassLine.length;
    const bEnv = Math.exp(-(beatInBar % 1) * 3) * Math.min(1, (beatInBar % 1) / 0.003);
    sample += sqr(bassLine[bIdx], t, 0.25) * 0.04 * bEnv; // 25% duty cycle — 更薄的bass

    // 芯片鼓点: 纯噪声极短
    if (Math.floor(beat) % 4 === 0 || Math.floor(beat) % 4 === 2) {
      const dPhase = beatInBar % 1;
      if (dPhase < 0.03) {
        sample += noise(t, 42) * Math.exp(-dPhase * 200) * 0.06;
      }
    }

    // Hi-hat: 高频噪声
    const hhPhase = (beat * 4) % 1;
    if (hhPhase < 0.008) {
      sample += noise(t, 77) * Math.exp(-hhPhase * 600) * 0.02;
    }

    // 低通保留方波特征但不过于刺耳
    const f = lp4(sample, fState, 5000, 0.3, sr);
    fState = f.state;
    sample = f.out;

    let gEnv = 1;
    if (i < sr * 0.2) gEnv = i / (sr * 0.2);
    if (i > n - sr * 0.5) gEnv = (n - i) / (sr * 0.5);
    sample *= gEnv;
    sample = Math.max(-0.9, Math.min(0.9, sample));
    L[i] = sample;
    R[i] = sample;
  }
  return [L, R];
}

// ========== 合成函数映射 ==========
const SYNTH_MAP: Record<string, (sr: number, dur: number) => Float32Array[]> = {
  relaxed: synthRelaxed,
  upbeat: synthUpbeat,
  romantic: synthRomantic,
  epic: synthEpic,
  nature: synthNature,
  cinematic: synthCinematic,
  electronic: synthElectronic,
  jazz: synthJazz,
  classical: synthClassical,
  rock: synthRock,
  acoustic: synthAcoustic,
  ambient: synthAmbient,
  suspense: synthSuspense,
  comedy: synthComedy,
  corporate: synthCorporate,
  lofi: synthLofi,
  world: synthWorld,
  holiday: synthHoliday,
  chinese: synthChinese,
  trap: synthTrap,
  rnb: synthRnb,
  reggae: synthReggae,
  motivational: synthMotivational,
  retro: synthRetro,
};

// Web Audio API 浏览器端生成风格匹配音效 v5.0
export class WebAudioBgmGenerator {
  private audioContext: AudioContext | null = null;

  async generateBgm(type: string, durationSeconds: number = 12): Promise<Blob | null> {
    try {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const sampleRate = this.audioContext.sampleRate;
      const totalSamples = sampleRate * durationSeconds;

      // 查找风格专属合成函数
      const synthFn = SYNTH_MAP[type] || SYNTH_MAP.relaxed;
      const [leftChannel, rightChannel] = synthFn(sampleRate, durationSeconds);

      const buffer = this.audioContext.createBuffer(2, totalSamples, sampleRate);
      buffer.copyToChannel(leftChannel.slice(0, totalSamples), 0);
      buffer.copyToChannel(rightChannel.slice(0, totalSamples), 1);

      return this.bufferToWav(buffer);
    } catch (error) {
      console.error('Web Audio BGM生成失败:', error);
      return null;
    } finally {
      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }
    }
  }

  private bufferToWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1;
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = buffer.length * blockAlign;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;
    const arrayBuffer = new ArrayBuffer(totalSize);
    const view = new DataView(arrayBuffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeString(0, 'RIFF');
    view.setUint32(4, totalSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    const channels: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
      channels.push(buffer.getChannelData(ch));
    }

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, channels[ch][i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
}

// 多级 BGM 提供者（Web Audio 合成 → SoundHelix 预设 降级链）
export class MultiLevelBgmProvider {
  static async getPreviewUrl(type: string): Promise<{ url: string; source: 'webaudio' | 'preset' } | null> {
    // 优先: Web Audio 合成
    try {
      const generator = new WebAudioBgmGenerator();
      const blob = await generator.generateBgm(type, 12);
      if (blob) {
        const url = URL.createObjectURL(blob);
        return { url, source: 'webaudio' };
      }
    } catch {
      // Web Audio 失败，降级
    }

    // 降级: SoundHelix 预设
    const preset = PRESET_BGM_MAP[type];
    if (preset && preset.urls.length > 0) {
      const url = preset.urls[Math.floor(Math.random() * preset.urls.length)];
      return { url, source: 'preset' };
    }

    return null;
  }
}

// 获取 BGM 类型列表
export function getBgmTypes() {
  return Object.values(BGM_TYPES_V2).filter(t => t.id !== 'none');
}
