import { useState, useCallback } from 'react';
import Icon from '@/components/ui/icon';

// ── Нумерация «по улитке» 3×3 ──────────────────────────────────────────────
// 1 2 3
// 8 9 4
// 7 6 5
const SNAIL_3x3: Record<number, { r: number; c: number }> = {
  1: { r: 0, c: 0 }, 2: { r: 0, c: 1 }, 3: { r: 0, c: 2 },
  4: { r: 1, c: 2 }, 5: { r: 2, c: 2 }, 6: { r: 2, c: 1 },
  7: { r: 2, c: 0 }, 8: { r: 1, c: 0 }, 9: { r: 1, c: 1 },
};
const SNAIL_NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const snailPos = (n: number) => SNAIL_3x3[n];

// Сектор типа А: 5 колонок × 2 строки, нумерация 1-9,0
const SECTOR_COLS = 5;
const SECTOR_ROWS = 2;
const sectorNum = (r: number, c: number) => {
  const n = r * SECTOR_COLS + c + 1;
  return n === 10 ? 0 : n;
};

type MarkType = 'friend' | 'enemy' | 'unknown';
type IconName = 'Plane' | 'Rocket' | 'CircleHelp';

const TYPE_META: Record<MarkType, { label: string; color: string; icon: IconName }> = {
  friend:  { label: 'Свой',         color: '145 63% 49%', icon: 'Plane' },
  enemy:   { label: 'Противник',    color: '0 78% 55%',   icon: 'Rocket' },
  unknown: { label: 'Неопознанный', color: '38 92% 55%',  icon: 'CircleHelp' },
};

interface Coord { zone: string; sector: number; bq: number; sq: number }
interface Mark extends Coord { type: MarkType }

const keyOf = (c: Coord) => `${c.zone}.${c.sector}.${c.bq}.${c.sq}`;
const coordLabel = (c: Coord) => `з${c.zone} с${c.sector} бк${c.bq} ск${c.sq}`;

interface Task { id: number; title: string; brief: string; targets: Mark[] }

const TASKS: Task[] = [
  {
    id: 1,
    title: 'Задание №1 — Одиночная цель',
    brief: 'Зона 21, сектор 6, большой квадрат 2, средний квадрат 5 — ПРОТИВНИК.',
    targets: [{ zone: '21', sector: 6, bq: 2, sq: 5, type: 'enemy' }],
  },
  {
    id: 2,
    title: 'Задание №2 — Пара целей',
    brief: 'Свой: з21 с1 бк3 ск1. Противник: з21 с9 бк7 ск4.',
    targets: [
      { zone: '21', sector: 1, bq: 3, sq: 1, type: 'friend' },
      { zone: '21', sector: 9, bq: 7, sq: 4, type: 'enemy' },
    ],
  },
  {
    id: 3,
    title: 'Задание №3 — Смешанная обстановка',
    brief: 'Свой: з21 с2 бк1 ск9. Неопознанный: з21 с5 бк5 ск2. Противник: з21 с8 бк9 ск6.',
    targets: [
      { zone: '21', sector: 2, bq: 1, sq: 9, type: 'friend' },
      { zone: '21', sector: 5, bq: 5, sq: 2, type: 'unknown' },
      { zone: '21', sector: 8, bq: 9, sq: 6, type: 'enemy' },
    ],
  },
];

interface CheckResult {
  correct: Mark[]; wrongType: Mark[]; extra: Mark[]; missed: Mark[]; accuracy: number;
}

type Tab = 'trainer' | 'reference';

const REF_IMAGES = [
  { url: 'https://cdn.poehali.dev/projects/4876679e-812b-492a-ac4d-15f2b0c8e66b/bucket/f3f7f2f1-4f81-4ed2-bd4c-9797d5af3768.jpg', caption: 'Нумерация зон (01–46 / 51–96)' },
  { url: 'https://cdn.poehali.dev/projects/4876679e-812b-492a-ac4d-15f2b0c8e66b/bucket/aa92d9f4-8241-49c6-bb92-c550cbe65478.jpg', caption: 'Секторы в зонах (типы А, Б, В, Г)' },
  { url: 'https://cdn.poehali.dev/projects/4876679e-812b-492a-ac4d-15f2b0c8e66b/bucket/20043d74-d43c-4038-8da9-e25f63deaf91.jpg', caption: 'Секторы → большие квадраты (нумерация 0–9)' },
  { url: 'https://cdn.poehali.dev/projects/4876679e-812b-492a-ac4d-15f2b0c8e66b/bucket/dbe465ea-4487-4bdb-9bfd-3ca6da80f1a1.jpg', caption: 'Большой квадрат → 9 средних → 9 малых («по улитке»)' },
  { url: 'https://cdn.poehali.dev/projects/4876679e-812b-492a-ac4d-15f2b0c8e66b/bucket/ed4816d4-f342-4cb3-8ce1-3f2a563793f5.jpg', caption: 'Пример планшета воздушной обстановки' },
];

const Index = () => {
  const [tab, setTab] = useState<Tab>('trainer');
  const [taskIndex, setTaskIndex] = useState(0);
  const [tool, setTool] = useState<MarkType>('enemy');
  const [marks, setMarks] = useState<Mark[]>([]);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selSector, setSelSector] = useState<number | null>(null);
  const [selBq, setSelBq] = useState<number | null>(null);

  const task = TASKS[taskIndex];
  const zone = '21';

  const marksByCell = new Map<string, Mark>();
  marks.forEach((m) => marksByCell.set(keyOf(m), m));

  const errorCells = new Map<string, 'wrongType' | 'extra' | 'missed'>();
  if (result) {
    result.wrongType.forEach((m) => errorCells.set(keyOf(m), 'wrongType'));
    result.extra.forEach((m) => errorCells.set(keyOf(m), 'extra'));
    result.missed.forEach((m) => errorCells.set(keyOf(m), 'missed'));
  }

  const placeMark = useCallback(
    (sq: number) => {
      if (selSector === null || selBq === null) return;
      const coord: Coord = { zone, sector: selSector, bq: selBq, sq };
      const k = keyOf(coord);
      setResult(null);
      setMarks((prev) => {
        const existing = prev.find((m) => keyOf(m) === k);
        if (existing) {
          if (existing.type === tool) return prev.filter((m) => keyOf(m) !== k);
          return prev.map((m) => (keyOf(m) === k ? { ...m, type: tool } : m));
        }
        return [...prev, { ...coord, type: tool }];
      });
    },
    [selSector, selBq, tool, zone],
  );

  const check = () => {
    const targetMap = new Map(task.targets.map((t) => [keyOf(t), t]));
    const correct: Mark[] = [], wrongType: Mark[] = [], extra: Mark[] = [];
    marks.forEach((m) => {
      const t = targetMap.get(keyOf(m));
      if (!t) extra.push(m);
      else if (t.type === m.type) correct.push(m);
      else wrongType.push(m);
    });
    const missed = task.targets.filter((t) => !marks.some((m) => keyOf(m) === keyOf(t)));
    const accuracy = task.targets.length ? Math.round((correct.length / task.targets.length) * 100) : 0;
    setResult({ correct, wrongType, extra, missed, accuracy });
    setShowAnswer(false);
  };

  const reset = () => {
    setMarks([]); setResult(null); setShowAnswer(false); setSelSector(null); setSelBq(null);
  };

  const selectTask = (i: number) => { setTaskIndex(i); reset(); };

  const breadcrumb = [`Зона ${zone}`, selSector !== null ? `Сектор ${selSector}` : null, selBq !== null ? `БК ${selBq}` : null].filter(Boolean).join(' → ');

  const marksInSector = (s: number) => marks.filter((m) => m.sector === s).length;
  const marksInBq = (b: number) => marks.filter((m) => m.sector === selSector && m.bq === b).length;
  const targetInSector = (s: number) => showAnswer && task.targets.some((t) => t.sector === s);
  const targetInBq = (b: number) => showAnswer && task.targets.some((t) => t.sector === selSector && t.bq === b);

  const sqState = (sq: number) => {
    if (selSector === null || selBq === null) return null;
    const k = keyOf({ zone, sector: selSector, bq: selBq, sq });
    const mark = marksByCell.get(k);
    const err = errorCells.get(k);
    const isTarget = task.targets.some((t) => keyOf(t) === k);
    const targetMeta = showAnswer && isTarget ? TYPE_META[task.targets.find((t) => keyOf(t) === k)!.type] : null;
    return { mark, err, targetMeta };
  };

  return (
    <div className="min-h-screen tablet-bg text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        {/* Header */}
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Icon name="Radar" size={20} />
              <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Тренажёр планшета ВО</span>
            </div>
            <h1 className="font-display text-2xl font-600 uppercase tracking-wide sm:text-3xl">
              Воздушная обстановка · Зона {zone}
            </h1>
          </div>
          <div className="flex gap-2">
            {(['trainer', 'reference'] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`rounded-md border px-4 py-2 text-xs uppercase tracking-wide transition-colors ${tab === t ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card/40 text-muted-foreground hover:text-foreground'}`}>
                {t === 'trainer' ? 'Тренажёр' : 'Справочник'}
              </button>
            ))}
          </div>
        </header>

        {/* REFERENCE TAB */}
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

        {/* TRAINER TAB */}
        {tab === 'trainer' && (
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <section className="space-y-4">
              {/* Task card */}
              <div className="rounded-md border border-border bg-card/60 px-4 py-3">
                <div className="text-xs uppercase tracking-widest text-accent">{task.title}</div>
                <div className="mt-1 text-sm text-foreground/80">{task.brief}</div>
              </div>

              {/* Breadcrumb */}
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

              {/* LEVEL 1 — Секторы 5×2 */}
              {selSector === null && (
                <div className="animate-fade-in rounded-lg border border-border bg-card/40 p-4">
                  <div className="mb-3 text-[10px] uppercase tracking-widest text-muted-foreground">Выберите сектор зоны {zone}</div>
                  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${SECTOR_COLS}, minmax(0, 1fr))` }}>
                    {Array.from({ length: SECTOR_ROWS }).map((_, sr) =>
                      Array.from({ length: SECTOR_COLS }).map((__, sc) => {
                        const s = sectorNum(sr, sc);
                        const mCount = marksInSector(s);
                        const isHint = targetInSector(s);
                        return (
                          <button key={`s-${sr}-${sc}`} onClick={() => { setSelSector(s); setSelBq(null); }}
                            className={`relative flex aspect-square items-center justify-center rounded-md border-2 font-display text-xl font-700 transition-all hover:bg-primary/10 ${isHint ? 'border-accent/60 bg-accent/5' : 'border-[hsl(var(--grid-line-major))]'}`}>
                            {s}
                            {mCount > 0 && (
                              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground">{mCount}</span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* LEVEL 2 — Большие квадраты 3×3 по улитке */}
              {selSector !== null && selBq === null && (
                <div className="animate-fade-in rounded-lg border border-border bg-card/40 p-4">
                  <div className="mb-3 text-[10px] uppercase tracking-widest text-muted-foreground">Сектор {selSector} — выберите большой квадрат</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {SNAIL_NUMS.map((bq) => {
                      const mCount = marksInBq(bq);
                      const isHint = targetInBq(bq);
                      return (
                        <button key={`bq-${bq}`} onClick={() => setSelBq(bq)}
                          className={`relative flex aspect-square items-center justify-center rounded border-2 font-display text-2xl font-700 transition-all hover:bg-primary/10 ${isHint ? 'border-accent/60 bg-accent/5' : 'border-[hsl(var(--grid-line-major))]'}`}
                          style={{ gridColumn: snailPos(bq).c + 1, gridRow: snailPos(bq).r + 1 }}>
                          {bq}
                          {mCount > 0 && (
                            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground">{mCount}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* LEVEL 3 — Средние квадраты 3×3 по улитке */}
              {selSector !== null && selBq !== null && (
                <div className="animate-fade-in rounded-lg border border-border bg-card/40 p-4">
                  <div className="mb-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                    Сектор {selSector} · БК {selBq} — нанесите отметку
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {SNAIL_NUMS.map((sq) => {
                      const state = sqState(sq);
                      const meta = state?.mark ? TYPE_META[state.mark.type] : null;
                      const err = state?.err;
                      const targetMeta = state?.targetMeta ?? null;
                      return (
                        <button key={`sq-${sq}`} onClick={() => placeMark(sq)}
                          className="relative flex aspect-square flex-col items-center justify-center gap-1 rounded border-2 transition-all hover:bg-primary/10"
                          style={{
                            gridColumn: snailPos(sq).c + 1,
                            gridRow: snailPos(sq).r + 1,
                            borderColor: meta ? `hsl(${meta.color})` : err ? (err === 'missed' ? 'hsl(38 92% 55%)' : 'hsl(0 78% 55%)') : 'hsl(var(--grid-line-major))',
                            background: meta ? `hsl(${meta.color} / 0.1)` : undefined,
                          }}>
                          <span className="text-[10px] font-mono text-muted-foreground/50">{sq}</span>
                          {meta && (
                            <span style={{ color: `hsl(${meta.color})` }}>
                              <Icon name={meta.icon} size={22} fallback="Circle" />
                            </span>
                          )}
                          {!meta && targetMeta && (
                            <span className="opacity-40" style={{ color: `hsl(${targetMeta.color})` }}>
                              <Icon name={targetMeta.icon} size={22} fallback="Circle" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[10px] text-muted-foreground">Повторный клик снимает метку.</p>
                </div>
              )}

              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                {(Object.keys(TYPE_META) as MarkType[]).map((t) => {
                  const meta = TYPE_META[t];
                  const active = tool === t;
                  return (
                    <button key={t} onClick={() => setTool(t)}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs uppercase tracking-wide transition-all ${active ? 'border-transparent' : 'border-border bg-card/40 text-muted-foreground hover:text-foreground'}`}
                      style={active ? { background: `hsl(${meta.color})`, color: 'hsl(200 40% 6%)' } : undefined}>
                      <Icon name={meta.icon} size={14} fallback="Circle" />
                      {meta.label}
                    </button>
                  );
                })}
                <div className="ml-auto flex gap-2">
                  <button onClick={reset} className="flex items-center gap-2 rounded-md border border-border bg-card/40 px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground">
                    <Icon name="Eraser" size={14} /> Сброс
                  </button>
                  <button onClick={check} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs uppercase tracking-wide text-primary-foreground hover:opacity-90">
                    <Icon name="ScanSearch" size={14} /> Проверить
                  </button>
                </div>
              </div>
            </section>

            {/* Sidebar */}
            <aside className="space-y-4">
              {/* Tasks */}
              <div className="rounded-lg border border-border bg-card/40 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-accent">
                  <Icon name="ListChecks" size={14} /> Задания
                </div>
                <div className="space-y-2">
                  {TASKS.map((t, i) => (
                    <button key={t.id} onClick={() => selectTask(i)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-xs transition-colors ${i === taskIndex ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                      {t.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Snail hint */}
              <div className="rounded-lg border border-border bg-card/40 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-accent">
                  <Icon name="IterationCw" size={14} fallback="Grid3x3" /> По улитке
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {SNAIL_NUMS.map((n) => (
                    <div key={n} className="flex aspect-square items-center justify-center rounded border border-border font-display text-lg font-700 text-muted-foreground"
                      style={{ gridColumn: snailPos(n).c + 1, gridRow: snailPos(n).r + 1 }}>
                      {n}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                  Так нумеруются большие и средние квадраты.
                </p>
              </div>

              {/* Result */}
              <div className="rounded-lg border border-border bg-card/40 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-accent">
                  <Icon name="Crosshair" size={14} /> Оценка
                </div>
                {!result ? (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Нанесите все цели по маршруту: сектор → большой квадрат → средний квадрат, затем нажмите «Проверить».
                  </p>
                ) : (
                  <div className="animate-fade-in space-y-3">
                    <div className="text-center">
                      <div className="font-display text-5xl font-700"
                        style={{ color: result.accuracy === 100 ? 'hsl(145 63% 49%)' : result.accuracy >= 50 ? 'hsl(38 92% 55%)' : 'hsl(0 78% 55%)' }}>
                        {result.accuracy}%
                      </div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">точность</div>
                    </div>
                    <ul className="space-y-1.5 text-xs">
                      <li className="flex items-center gap-2 text-primary"><Icon name="Check" size={14} /> Верно: {result.correct.length}</li>
                      {result.wrongType.length > 0 && <li className="flex items-center gap-2 text-destructive"><Icon name="TriangleAlert" size={14} /> Неверный тип: {result.wrongType.length}</li>}
                      {result.missed.length > 0 && <li className="flex items-center gap-2 text-accent"><Icon name="EyeOff" size={14} /> Пропущено: {result.missed.length}</li>}
                      {result.extra.length > 0 && <li className="flex items-center gap-2 text-destructive"><Icon name="X" size={14} /> Лишние: {result.extra.length}</li>}
                    </ul>
                    {(result.missed.length > 0 || result.wrongType.length > 0) && (
                      <div className="rounded-md border border-accent/30 bg-accent/5 p-2 text-[11px] leading-relaxed text-accent/90">
                        {result.missed.map((m) => <div key={keyOf(m)}>⚠ Пропущена ({TYPE_META[m.type].label}): {coordLabel(m)}</div>)}
                        {result.wrongType.map((m) => <div key={keyOf(m)}>✗ Неверный тип: {coordLabel(m)}</div>)}
                      </div>
                    )}
                    {result.accuracy < 100 && (
                      <button onClick={() => setShowAnswer((s) => !s)}
                        className="flex w-full items-center justify-center gap-2 rounded-md border border-accent/50 px-3 py-2 text-xs uppercase tracking-wide text-accent hover:bg-accent/10">
                        <Icon name={showAnswer ? 'EyeOff' : 'Eye'} size={14} />
                        {showAnswer ? 'Скрыть' : 'Показать'} эталон
                      </button>
                    )}
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
