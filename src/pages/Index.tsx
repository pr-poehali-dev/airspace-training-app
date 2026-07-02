import { useState, useCallback } from 'react';
import Icon from '@/components/ui/icon';

// ── Нумерация «по улитке» 3×3 ──────────────────────────────────────────────
const SNAIL_3x3: Record<number, { r: number; c: number }> = {
  1: { r: 0, c: 0 }, 2: { r: 0, c: 1 }, 3: { r: 0, c: 2 },
  4: { r: 1, c: 2 }, 5: { r: 2, c: 2 }, 6: { r: 2, c: 1 },
  7: { r: 2, c: 0 }, 8: { r: 1, c: 0 }, 9: { r: 1, c: 1 },
};
const SNAIL_NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const snailPos = (n: number) => SNAIL_3x3[n];

const SECTOR_COLS = 5;
const SECTOR_ROWS = 2;
const sectorNum = (r: number, c: number) => {
  const n = r * SECTOR_COLS + c + 1;
  return n === 10 ? 0 : n;
};

type MarkType = 'friend' | 'enemy' | 'unknown';
type IconName = 'Plane' | 'Rocket' | 'CircleHelp';

const TYPE_META: Record<MarkType, { label: string; short: string; color: string; icon: IconName }> = {
  friend:  { label: 'Свой',         short: 'СВ', color: '145 63% 49%', icon: 'Plane' },
  enemy:   { label: 'Противник',    short: 'ПР', color: '0 78% 55%',   icon: 'Rocket' },
  unknown: { label: 'Неопознанный', short: '??', color: '38 92% 55%',  icon: 'CircleHelp' },
};

interface Coord { zone: string; sector: number; bq: number; sq: number }
interface Mark extends Coord { type: MarkType }

const keyOf = (c: Coord) => `${c.zone}.${c.sector}.${c.bq}.${c.sq}`;
const coordLabel = (c: Coord) => `з${c.zone} с${c.sector} бк${c.bq} ск${c.sq}`;

// ── Формат донесения ──────────────────────────────────────────────────────
// "Время. Номер РЛС, ЗонаСектор БКвСКв, высота, скорость, пеленг"
// Координата кодируется: зона (2 цифры) + сектор (1 цифра) → "216" = зона 21, сектор 6
// Большой/средний квадрат: "49" = БК 4, СК 9
interface Report {
  time: string;          // "00 00"
  post: string;          // "Двенадцатая"
  zoneRaw: string;       // "216"   → zone=21, sector=6
  bqsqRaw: string;       // "49"    → bq=4, sq=9
  altText: string;       // "в девяносто девятом"
  speed: string;         // "900"
  bearing: string;       // "15 15"
  type: MarkType;
  // parsed
  zone: string;
  sector: number;
  bq: number;
  sq: number;
}

const REPORTS: Report[] = [
  {
    time: '00 00', post: 'Двенадцатая',
    zoneRaw: '216', bqsqRaw: '49',
    altText: 'в девяносто девятом', speed: '900', bearing: '15 15',
    type: 'enemy',
    zone: '21', sector: 6, bq: 4, sq: 9,
  },
  {
    time: '00 15', post: 'Восьмая',
    zoneRaw: '213', bqsqRaw: '71',
    altText: 'в семьдесят первом', speed: '750', bearing: '22 30',
    type: 'unknown',
    zone: '21', sector: 3, bq: 7, sq: 1,
  },
  {
    time: '00 30', post: 'Первая',
    zoneRaw: '219', bqsqRaw: '25',
    altText: 'в восемьдесят пятом', speed: '1100', bearing: '08 45',
    type: 'enemy',
    zone: '21', sector: 9, bq: 2, sq: 5,
  },
  {
    time: '00 45', post: 'Пятая',
    zoneRaw: '211', bqsqRaw: '83',
    altText: 'в шестьдесят четвёртом', speed: '600', bearing: '31 15',
    type: 'friend',
    zone: '21', sector: 1, bq: 8, sq: 3,
  },
];

function buildReportText(r: Report) {
  return `${r.time.split(' ').join(' ноля, ')} ноля.\n${r.post}, ${r.zoneRaw} ${r.bqsqRaw} ${r.altText}, ${r.speed}, за ${r.bearing}.`;
}

interface CheckResult {
  correct: Mark[]; wrongType: Mark[]; extra: Mark[]; missed: Mark[]; accuracy: number;
}

type Tab = 'trainer' | 'dictation' | 'reference';

const REF_IMAGES = [
  { url: 'https://cdn.poehali.dev/projects/4876679e-812b-492a-ac4d-15f2b0c8e66b/bucket/4311d903-fced-46d1-a3ff-5cd5ccb2d869.jpg', caption: 'Пример речевого донесения на планшете ВО' },
  { url: 'https://cdn.poehali.dev/projects/4876679e-812b-492a-ac4d-15f2b0c8e66b/bucket/f3f7f2f1-4f81-4ed2-bd4c-9797d5af3768.jpg', caption: 'Нумерация зон (01–46 / 51–96)' },
  { url: 'https://cdn.poehali.dev/projects/4876679e-812b-492a-ac4d-15f2b0c8e66b/bucket/aa92d9f4-8241-49c6-bb92-c550cbe65478.jpg', caption: 'Секторы в зонах (типы А, Б, В, Г)' },
  { url: 'https://cdn.poehali.dev/projects/4876679e-812b-492a-ac4d-15f2b0c8e66b/bucket/20043d74-d43c-4038-8da9-e25f63deaf91.jpg', caption: 'Секторы → большие квадраты (нумерация 0–9)' },
  { url: 'https://cdn.poehali.dev/projects/4876679e-812b-492a-ac4d-15f2b0c8e66b/bucket/dbe465ea-4487-4bdb-9bfd-3ca6da80f1a1.jpg', caption: 'Большой квадрат → 9 средних → 9 малых («по улитке»)' },
  { url: 'https://cdn.poehali.dev/projects/4876679e-812b-492a-ac4d-15f2b0c8e66b/bucket/ed4816d4-f342-4cb3-8ce1-3f2a563793f5.jpg', caption: 'Пример планшета воздушной обстановки' },
];

// ──────────────────────────────────────────────────────────────────────────
// DICTATION MODE — shared grid logic
// ──────────────────────────────────────────────────────────────────────────

interface GridProps {
  marks: Mark[];
  result: CheckResult | null;
  showAnswer: boolean;
  tool: MarkType;
  onMark: (sq: number) => void;
  selSector: number | null;
  selBq: number | null;
  setSelSector: (s: number | null) => void;
  setSelBq: (b: number | null) => void;
  task?: { targets: Mark[] };
  zone: string;
}

const PlanshGrid = ({
  marks, result, showAnswer, tool, onMark,
  selSector, selBq, setSelSector, setSelBq, task, zone,
}: GridProps) => {
  const marksByCell = new Map<string, Mark>();
  marks.forEach((m) => marksByCell.set(keyOf(m), m));
  const errorCells = new Map<string, 'wrongType' | 'extra' | 'missed'>();
  if (result) {
    result.wrongType.forEach((m) => errorCells.set(keyOf(m), 'wrongType'));
    result.extra.forEach((m) => errorCells.set(keyOf(m), 'extra'));
    result.missed.forEach((m) => errorCells.set(keyOf(m), 'missed'));
  }

  const marksInSector = (s: number) => marks.filter((m) => m.sector === s).length;
  const marksInBq = (b: number) => marks.filter((m) => m.sector === selSector && m.bq === b).length;
  const targetInSector = (s: number) => showAnswer && !!task?.targets.some((t) => t.sector === s);
  const targetInBq = (b: number) => showAnswer && !!task?.targets.some((t) => t.sector === selSector && t.bq === b);

  const sqState = (sq: number) => {
    if (selSector === null || selBq === null) return null;
    const k = keyOf({ zone, sector: selSector, bq: selBq, sq });
    const mark = marksByCell.get(k);
    const err = errorCells.get(k);
    const isTarget = task?.targets.some((t) => keyOf(t) === k);
    const targetMeta = showAnswer && isTarget
      ? TYPE_META[task!.targets.find((t) => keyOf(t) === k)!.type]
      : null;
    return { mark, err, targetMeta };
  };

  const breadcrumb = [`Зона ${zone}`, selSector !== null ? `Сектор ${selSector}` : null, selBq !== null ? `БК ${selBq}` : null].filter(Boolean).join(' → ');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon name="Navigation" size={12} />
        <span className="flex-1">{breadcrumb}</span>
        {selBq !== null && (
          <button onClick={() => setSelBq(null)} className="rounded border border-border px-2 py-1 text-[10px] uppercase hover:text-foreground">← БК</button>
        )}
        {selSector !== null && selBq === null && (
          <button onClick={() => { setSelSector(null); setSelBq(null); }} className="rounded border border-border px-2 py-1 text-[10px] uppercase hover:text-foreground">← Секторы</button>
        )}
      </div>

      {selSector === null && (
        <div className="animate-fade-in rounded-lg border border-border bg-card/40 p-3">
          <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Сектор зоны {zone}</div>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${SECTOR_COLS}, minmax(0, 1fr))` }}>
            {Array.from({ length: SECTOR_ROWS }).map((_, sr) =>
              Array.from({ length: SECTOR_COLS }).map((__, sc) => {
                const s = sectorNum(sr, sc);
                const mCount = marksInSector(s);
                const hint = targetInSector(s);
                return (
                  <button key={`s-${sr}-${sc}`} onClick={() => { setSelSector(s); setSelBq(null); }}
                    className={`relative flex aspect-square items-center justify-center rounded border-2 font-display text-xl font-700 transition-all hover:bg-primary/10 ${hint ? 'border-accent/60 bg-accent/5' : 'border-[hsl(var(--grid-line-major))]'}`}>
                    {s}
                    {mCount > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground">{mCount}</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {selSector !== null && selBq === null && (
        <div className="animate-fade-in rounded-lg border border-border bg-card/40 p-3">
          <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Сектор {selSector} — большой квадрат</div>
          <div className="grid grid-cols-3 gap-1.5">
            {SNAIL_NUMS.map((bq) => {
              const mCount = marksInBq(bq);
              const hint = targetInBq(bq);
              return (
                <button key={`bq-${bq}`} onClick={() => setSelBq(bq)}
                  className={`relative flex aspect-square items-center justify-center rounded border-2 font-display text-2xl font-700 transition-all hover:bg-primary/10 ${hint ? 'border-accent/60 bg-accent/5' : 'border-[hsl(var(--grid-line-major))]'}`}
                  style={{ gridColumn: snailPos(bq).c + 1, gridRow: snailPos(bq).r + 1 }}>
                  {bq}
                  {mCount > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground">{mCount}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selSector !== null && selBq !== null && (
        <div className="animate-fade-in rounded-lg border border-border bg-card/40 p-3">
          <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">С{selSector} · БК{selBq} — средний квадрат</div>
          <div className="grid grid-cols-3 gap-2">
            {SNAIL_NUMS.map((sq) => {
              const state = sqState(sq);
              const meta = state?.mark ? TYPE_META[state.mark.type] : null;
              const err = state?.err;
              const targetMeta = state?.targetMeta ?? null;
              return (
                <button key={`sq-${sq}`} onClick={() => onMark(sq)}
                  className="relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded border-2 transition-all hover:bg-primary/10"
                  style={{
                    gridColumn: snailPos(sq).c + 1,
                    gridRow: snailPos(sq).r + 1,
                    borderColor: meta ? `hsl(${meta.color})` : err ? (err === 'missed' ? 'hsl(38 92% 55%)' : 'hsl(0 78% 55%)') : 'hsl(var(--grid-line-major))',
                    background: meta ? `hsl(${meta.color} / 0.1)` : undefined,
                  }}>
                  <span className="text-[9px] font-mono text-muted-foreground/50">{sq}</span>
                  {meta && <span style={{ color: `hsl(${meta.color})` }}><Icon name={meta.icon} size={20} fallback="Circle" /></span>}
                  {!meta && targetMeta && <span className="opacity-40" style={{ color: `hsl(${targetMeta.color})` }}><Icon name={targetMeta.icon} size={20} fallback="Circle" /></span>}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">Клик по заполненной ячейке снимает метку.</p>
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────────────

const TASKS_TRAINER = [
  {
    id: 1, title: 'Задание №1 — Одиночная цель',
    brief: 'Зона 21, сектор 6, большой квадрат 2, средний квадрат 5 — ПРОТИВНИК.',
    targets: [{ zone: '21', sector: 6, bq: 2, sq: 5, type: 'enemy' as MarkType }],
  },
  {
    id: 2, title: 'Задание №2 — Пара целей',
    brief: 'Свой: з21 с1 бк3 ск1. Противник: з21 с9 бк7 ск4.',
    targets: [
      { zone: '21', sector: 1, bq: 3, sq: 1, type: 'friend' as MarkType },
      { zone: '21', sector: 9, bq: 7, sq: 4, type: 'enemy' as MarkType },
    ],
  },
  {
    id: 3, title: 'Задание №3 — Смешанная обстановка',
    brief: 'Свой: з21 с2 бк1 ск9. Неопознанный: з21 с5 бк5 ск2. Противник: з21 с8 бк9 ск6.',
    targets: [
      { zone: '21', sector: 2, bq: 1, sq: 9, type: 'friend' as MarkType },
      { zone: '21', sector: 5, bq: 5, sq: 2, type: 'unknown' as MarkType },
      { zone: '21', sector: 8, bq: 9, sq: 6, type: 'enemy' as MarkType },
    ],
  },
];

const Index = () => {
  const [tab, setTab] = useState<Tab>('dictation');
  const zone = '21';

  // ── Trainer state ──
  const [taskIndex, setTaskIndex] = useState(0);
  const [tMarks, setTMarks] = useState<Mark[]>([]);
  const [tResult, setTResult] = useState<CheckResult | null>(null);
  const [tShowAnswer, setTShowAnswer] = useState(false);
  const [tSector, setTSector] = useState<number | null>(null);
  const [tBq, setTBq] = useState<number | null>(null);
  const [tTool, setTTool] = useState<MarkType>('enemy');

  // ── Dictation state ──
  const [dReportIdx, setDReportIdx] = useState(0);
  const [dPhase, setDPhase] = useState<'mark' | 'done'>('mark');
  const [dMarks, setDMarks] = useState<Mark[]>([]);
  const [dResult, setDResult] = useState<CheckResult | null>(null);
  const [dShowAnswer, setDShowAnswer] = useState(false);
  const [dSector, setDSector] = useState<number | null>(null);
  const [dBq, setDBq] = useState<number | null>(null);
  const [dTool, setDTool] = useState<MarkType>('enemy');

  const report = REPORTS[dReportIdx];
  const task = TASKS_TRAINER[taskIndex];

  const dResetTo = (i: number) => {
    setDReportIdx(i); setDPhase('mark'); setDMarks([]);
    setDResult(null); setDShowAnswer(false); setDSector(null); setDBq(null);
  };





  const dPlaceMark = useCallback((sq: number) => {
    if (dSector === null || dBq === null) return;
    const coord: Coord = { zone, sector: dSector, bq: dBq, sq };
    const k = keyOf(coord);
    setDResult(null);
    setDMarks((prev) => {
      const existing = prev.find((m) => keyOf(m) === k);
      if (existing) {
        if (existing.type === dTool) return prev.filter((m) => keyOf(m) !== k);
        return prev.map((m) => (keyOf(m) === k ? { ...m, type: dTool } : m));
      }
      return [...prev, { ...coord, type: dTool }];
    });
  }, [dSector, dBq, dTool, zone]);

  const dCheck = () => {
    const target: Mark = { ...report, type: report.type };
    const targetMap = new Map([[keyOf(target), target]]);
    const correct: Mark[] = [], wrongType: Mark[] = [], extra: Mark[] = [];
    dMarks.forEach((m) => {
      const t = targetMap.get(keyOf(m));
      if (!t) extra.push(m);
      else if (t.type === m.type) correct.push(m);
      else wrongType.push(m);
    });
    const missed = [target].filter((t) => !dMarks.some((m) => keyOf(m) === keyOf(t)));
    const accuracy = Math.round((correct.length / 1) * 100);
    setDResult({ correct, wrongType, extra, missed, accuracy });
    setDPhase('done');
  };

  const dNext = () => {
    setDReportIdx((i) => (i + 1) % REPORTS.length);
    setDPhase('mark');
    setDMarks([]);
    setDResult(null);
    setDShowAnswer(false);
    setDSector(null);
    setDBq(null);
  };

  // Trainer
  const tPlaceMark = useCallback((sq: number) => {
    if (tSector === null || tBq === null) return;
    const coord: Coord = { zone, sector: tSector, bq: tBq, sq };
    const k = keyOf(coord);
    setTResult(null);
    setTMarks((prev) => {
      const existing = prev.find((m) => keyOf(m) === k);
      if (existing) {
        if (existing.type === tTool) return prev.filter((m) => keyOf(m) !== k);
        return prev.map((m) => (keyOf(m) === k ? { ...m, type: tTool } : m));
      }
      return [...prev, { ...coord, type: tTool }];
    });
  }, [tSector, tBq, tTool, zone]);

  const tCheck = () => {
    const targetMap = new Map(task.targets.map((t) => [keyOf(t), t]));
    const correct: Mark[] = [], wrongType: Mark[] = [], extra: Mark[] = [];
    tMarks.forEach((m) => {
      const t = targetMap.get(keyOf(m));
      if (!t) extra.push(m);
      else if (t.type === m.type) correct.push(m);
      else wrongType.push(m);
    });
    const missed = task.targets.filter((t) => !tMarks.some((m) => keyOf(m) === keyOf(t)));
    const accuracy = task.targets.length ? Math.round((correct.length / task.targets.length) * 100) : 0;
    setTResult({ correct, wrongType, extra, missed, accuracy });
    setTShowAnswer(false);
  };

  const tReset = () => { setTMarks([]); setTResult(null); setTShowAnswer(false); setTSector(null); setTBq(null); };
  const tSelectTask = (i: number) => { setTaskIndex(i); tReset(); };

  const AccuracyBlock = ({ r, onShowAnswer, showAns }: { r: CheckResult; onShowAnswer: () => void; showAns: boolean }) => (
    <div className="animate-fade-in space-y-3">
      <div className="text-center">
        <div className="font-display text-5xl font-700"
          style={{ color: r.accuracy === 100 ? 'hsl(145 63% 49%)' : r.accuracy >= 50 ? 'hsl(38 92% 55%)' : 'hsl(0 78% 55%)' }}>
          {r.accuracy}%
        </div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">точность</div>
      </div>
      <ul className="space-y-1 text-xs">
        <li className="flex items-center gap-2 text-primary"><Icon name="Check" size={13} /> Верно: {r.correct.length}</li>
        {r.wrongType.length > 0 && <li className="flex items-center gap-2 text-destructive"><Icon name="TriangleAlert" size={13} /> Неверный тип: {r.wrongType.length}</li>}
        {r.missed.length > 0 && <li className="flex items-center gap-2 text-accent"><Icon name="EyeOff" size={13} /> Пропущено: {r.missed.length}</li>}
        {r.extra.length > 0 && <li className="flex items-center gap-2 text-destructive"><Icon name="X" size={13} /> Лишние: {r.extra.length}</li>}
      </ul>
      {(r.missed.length > 0 || r.wrongType.length > 0) && (
        <div className="rounded-md border border-accent/30 bg-accent/5 p-2 text-[11px] leading-relaxed text-accent/90">
          {r.missed.map((m) => <div key={keyOf(m)}>⚠ Пропущена ({TYPE_META[m.type].label}): {coordLabel(m)}</div>)}
          {r.wrongType.map((m) => <div key={keyOf(m)}>✗ Неверный тип: {coordLabel(m)}</div>)}
        </div>
      )}
      {r.accuracy < 100 && (
        <button onClick={onShowAnswer}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-accent/50 px-3 py-2 text-xs uppercase tracking-wide text-accent hover:bg-accent/10">
          <Icon name={showAns ? 'EyeOff' : 'Eye'} size={13} />
          {showAns ? 'Скрыть' : 'Показать'} эталон
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen tablet-bg text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-5 lg:px-8">
        {/* Header */}
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Icon name="Radar" size={18} />
              <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Тренажёр планшета ВО</span>
            </div>
            <h1 className="font-display text-2xl font-600 uppercase tracking-wide sm:text-3xl">Воздушная обстановка · Зона {zone}</h1>
          </div>
          <div className="flex gap-2">
            {([['dictation', 'Диктант'], ['trainer', 'Задания'], ['reference', 'Справочник']] as [Tab, string][]).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)}
                className={`rounded-md border px-3 py-2 text-xs uppercase tracking-wide transition-colors ${tab === t ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card/40 text-muted-foreground hover:text-foreground'}`}>
                {label}
              </button>
            ))}
          </div>
        </header>

        {/* ════ DICTATION TAB ════ */}
        {tab === 'dictation' && (
          <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
            {/* ЛЕВАЯ КОЛОНКА: донесение + планшет */}
            <div className="space-y-4">
              {/* Донесение */}
              <div className="relative overflow-hidden rounded-lg border-2 border-accent bg-card/60 p-5">
                <div className="absolute inset-x-0 top-0 h-0.5 bg-accent opacity-60" />
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-accent">
                    <Icon name="Radio" size={13} /> Донесение #{dReportIdx + 1} / {REPORTS.length}
                  </div>
                  <div className="flex gap-2">
                    {REPORTS.map((_, i) => (
                      <button key={i} onClick={() => dResetTo(i)}
                        className={`h-2 w-6 rounded-full transition-colors ${i === dReportIdx ? 'bg-accent' : 'bg-border hover:bg-muted-foreground'}`} />
                    ))}
                  </div>
                </div>
                <pre className="whitespace-pre-wrap font-display text-xl font-500 leading-loose tracking-wide text-foreground sm:text-2xl">
                  {buildReportText(report)}
                </pre>
                <div className="mt-4 border-t border-border pt-3">
                  <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">ПОВТОРЯЮ:</div>
                  <pre className="whitespace-pre-wrap font-display text-lg font-400 leading-loose tracking-wide text-muted-foreground/80">
                    {buildReportText(report)}
                  </pre>
                </div>
              </div>

              {/* Планшет */}
              <div className="rounded-lg border border-border bg-card/40 p-4">
                <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-widest text-accent">
                  <Icon name="MapPin" size={13} /> Нанесение на планшет
                </div>
                <PlanshGrid
                  marks={dMarks} result={dResult} showAnswer={dShowAnswer}
                  tool={dTool} onMark={dPlaceMark}
                  selSector={dSector} selBq={dBq}
                  setSelSector={setDSector} setSelBq={(b) => { setDBq(b); }}
                  task={{ targets: [{ zone: report.zone, sector: report.sector, bq: report.bq, sq: report.sq, type: report.type }] }}
                  zone={zone}
                />
              </div>
            </div>

            {/* ПРАВАЯ КОЛОНКА */}
            <div className="space-y-3">
              {/* Расшифровка координат */}
              <div className="rounded-lg border border-accent/40 bg-accent/5 p-4">
                <div className="mb-2 text-[10px] uppercase tracking-widest text-accent">Расшифровка</div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Зона · Сектор</span>
                    <span><span className="font-display text-base font-700 text-accent">{report.zoneRaw}</span><span className="ml-2 text-xs text-muted-foreground">→ з{report.zone} с{report.sector}</span></span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">БК · СК</span>
                    <span><span className="font-display text-base font-700 text-accent">{report.bqsqRaw}</span><span className="ml-2 text-xs text-muted-foreground">→ бк{report.bq} ск{report.sq}</span></span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Тип цели</span>
                    <span className="font-700 text-sm" style={{ color: `hsl(${TYPE_META[report.type].color})` }}>{TYPE_META[report.type].label}</span>
                  </div>
                </div>
              </div>

              {/* Тип отметки */}
              <div className="rounded-lg border border-border bg-card/40 p-3">
                <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Тип отметки</div>
                <div className="space-y-1.5">
                  {(Object.keys(TYPE_META) as MarkType[]).map((t) => {
                    const meta = TYPE_META[t];
                    const active = dTool === t;
                    return (
                      <button key={t} onClick={() => setDTool(t)}
                        className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-xs uppercase tracking-wide transition-all ${active ? 'border-transparent' : 'border-border bg-card/40 text-muted-foreground hover:text-foreground'}`}
                        style={active ? { background: `hsl(${meta.color})`, color: 'hsl(200 40% 6%)' } : undefined}>
                        <Icon name={meta.icon} size={14} fallback="Circle" />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* По улитке */}
              <div className="rounded-lg border border-border bg-card/40 p-3">
                <div className="mb-2 text-[10px] uppercase tracking-widest text-accent">По улитке</div>
                <div className="grid grid-cols-3 gap-1">
                  {SNAIL_NUMS.map((n) => (
                    <div key={n} className="flex aspect-square items-center justify-center rounded border border-border font-display text-sm font-700 text-muted-foreground"
                      style={{ gridColumn: snailPos(n).c + 1, gridRow: snailPos(n).r + 1 }}>{n}</div>
                  ))}
                </div>
              </div>

              {/* Проверить / Оценка / Следующее */}
              {dResult ? (
                <div className="rounded-lg border border-border bg-card/40 p-3">
                  <div className="mb-2 text-[10px] uppercase tracking-widest text-accent">Оценка</div>
                  <AccuracyBlock r={dResult} onShowAnswer={() => setDShowAnswer((s) => !s)} showAns={dShowAnswer} />
                </div>
              ) : (
                <button onClick={dCheck}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 text-xs uppercase tracking-wide text-primary-foreground hover:opacity-90">
                  <Icon name="ScanSearch" size={14} /> Проверить
                </button>
              )}

              {dPhase === 'done' && (
                <button onClick={dNext}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-accent/50 py-2 text-xs uppercase tracking-wide text-accent hover:bg-accent/10">
                  <Icon name="ChevronRight" size={14} /> Следующее донесение
                </button>
              )}

              {/* Формат */}
              <div className="rounded-lg border border-border bg-card/40 p-3">
                <div className="mb-2 text-[10px] uppercase tracking-widest text-accent">Формат донесения</div>
                <div className="space-y-1 text-[10px] leading-relaxed">
                  {[
                    ['Время', 'ЧЧ ММ'],
                    ['Пост', 'Номер РЛС'],
                    ['Зона+Сектор', '«216» = з21 с6'],
                    ['БК+СК', '«49» = бк4 ск9'],
                    ['Высота', 'в ...ом (×100 м)'],
                    ['Скорость', 'км/ч'],
                    ['Пеленг', 'за ЧЧ ЧЧ'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="w-22 shrink-0 text-accent/70">{k}:</span>
                      <span className="text-muted-foreground">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ TRAINER TAB ════ */}
        {tab === 'trainer' && (
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <section className="space-y-4">
              <div className="rounded-md border border-border bg-card/60 px-4 py-3">
                <div className="text-xs uppercase tracking-widest text-accent">{task.title}</div>
                <div className="mt-1 text-sm text-foreground/80">{task.brief}</div>
              </div>
              <PlanshGrid
                marks={tMarks} result={tResult} showAnswer={tShowAnswer}
                tool={tTool} onMark={tPlaceMark}
                selSector={tSector} selBq={tBq}
                setSelSector={setTSector} setSelBq={setTBq}
                task={task}
                zone={zone}
              />
              <div className="flex flex-wrap items-center gap-2">
                {(Object.keys(TYPE_META) as MarkType[]).map((t) => {
                  const meta = TYPE_META[t];
                  const active = tTool === t;
                  return (
                    <button key={t} onClick={() => setTTool(t)}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs uppercase tracking-wide transition-all ${active ? 'border-transparent' : 'border-border bg-card/40 text-muted-foreground hover:text-foreground'}`}
                      style={active ? { background: `hsl(${meta.color})`, color: 'hsl(200 40% 6%)' } : undefined}>
                      <Icon name={meta.icon} size={14} fallback="Circle" />
                      {meta.label}
                    </button>
                  );
                })}
                <div className="ml-auto flex gap-2">
                  <button onClick={tReset} className="flex items-center gap-2 rounded-md border border-border bg-card/40 px-3 py-2 text-xs uppercase text-muted-foreground hover:text-foreground">
                    <Icon name="Eraser" size={14} /> Сброс
                  </button>
                  <button onClick={tCheck} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs uppercase text-primary-foreground hover:opacity-90">
                    <Icon name="ScanSearch" size={14} /> Проверить
                  </button>
                </div>
              </div>
            </section>
            <aside className="space-y-4">
              <div className="rounded-lg border border-border bg-card/40 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-accent"><Icon name="ListChecks" size={14} /> Задания</div>
                <div className="space-y-2">
                  {TASKS_TRAINER.map((t, i) => (
                    <button key={t.id} onClick={() => tSelectTask(i)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-xs transition-colors ${i === taskIndex ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                      {t.title}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card/40 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-accent"><Icon name="IterationCw" size={14} fallback="Grid3x3" /> По улитке</div>
                <div className="grid grid-cols-3 gap-1">
                  {SNAIL_NUMS.map((n) => (
                    <div key={n} className="flex aspect-square items-center justify-center rounded border border-border font-display text-base font-700 text-muted-foreground"
                      style={{ gridColumn: snailPos(n).c + 1, gridRow: snailPos(n).r + 1 }}>{n}</div>
                  ))}
                </div>
              </div>
              {tResult && (
                <div className="rounded-lg border border-border bg-card/40 p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-accent"><Icon name="Crosshair" size={14} /> Оценка</div>
                  <AccuracyBlock r={tResult} onShowAnswer={() => setTShowAnswer((s) => !s)} showAns={tShowAnswer} />
                </div>
              )}
            </aside>
          </div>
        )}

        {/* ════ REFERENCE TAB ════ */}
        {tab === 'reference' && (
          <div className="animate-fade-in space-y-6">
            {REF_IMAGES.map((img) => (
              <div key={img.url} className="overflow-hidden rounded-lg border border-border">
                <img src={img.url} alt={img.caption} className="w-full" />
                <div className="border-t border-border bg-card/60 px-4 py-2 text-xs text-muted-foreground">{img.caption}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;