import { useState, useMemo, useCallback, Fragment } from 'react';
import Icon from '@/components/ui/icon';

const REF_IMG =
  'https://cdn.poehali.dev/projects/4876679e-812b-492a-ac4d-15f2b0c8e66b/bucket/ed4816d4-f342-4cb3-8ce1-3f2a563793f5.jpg';

const ZONE_COLS = 4;
const ZONE_ROWS = 3;
const ZONES = ZONE_COLS * ZONE_ROWS;

const BQ_COLS = 5;
const BQ_ROWS = 4;
const BQ_PER_ZONE = BQ_COLS * BQ_ROWS;

const SUB = 2;

const zoneNumber = (zi: number) => zi + 1;
const bqNumber = (bi: number) => (bi + 1) % 10;
const subNumber = (sr: number, sc: number) => sr * SUB + sc + 1;

type MarkType = 'friend' | 'enemy' | 'unknown';
type IconName = 'Plane' | 'Rocket' | 'CircleHelp';

interface Cell {
  zone: number;
  bq: number;
  sr: number;
  sc: number;
}

interface Mark extends Cell {
  type: MarkType;
}

interface Task {
  id: number;
  title: string;
  brief: string;
  targets: Mark[];
}

const TYPE_META: Record<
  MarkType,
  { label: string; short: string; color: string; icon: IconName }
> = {
  friend: { label: 'Свой', short: 'СВ', color: '145 63% 49%', icon: 'Plane' },
  enemy: { label: 'Противник', short: 'ПР', color: '0 78% 55%', icon: 'Rocket' },
  unknown: { label: 'Неопознанный', short: '??', color: '38 92% 55%', icon: 'CircleHelp' },
};

const coordLabel = (c: Cell) =>
  `${zoneNumber(c.zone)}-${bqNumber(c.bq)}-${subNumber(c.sr, c.sc)}`;

const TASKS: Task[] = [
  {
    id: 1,
    title: 'Задание №1 — Одиночная цель',
    brief: 'Противник: зона 1, большой квадрат 5, средний квадрат 3.',
    targets: [{ zone: 0, bq: 4, sr: 1, sc: 0, type: 'enemy' }],
  },
  {
    id: 2,
    title: 'Задание №2 — Пара целей',
    brief: 'Свой: зона 2, БК 3, СК 1. Противник: зона 6, БК 8, СК 4.',
    targets: [
      { zone: 1, bq: 2, sr: 0, sc: 0, type: 'friend' },
      { zone: 5, bq: 7, sr: 1, sc: 1, type: 'enemy' },
    ],
  },
  {
    id: 3,
    title: 'Задание №3 — Смешанная обстановка',
    brief: 'Свой: з3 БК2 СК2. Неопознанный: з5 БК6 СК1. Противник: з8 БК9 СК3.',
    targets: [
      { zone: 2, bq: 1, sr: 0, sc: 1, type: 'friend' },
      { zone: 4, bq: 5, sr: 0, sc: 0, type: 'unknown' },
      { zone: 7, bq: 8, sr: 1, sc: 0, type: 'enemy' },
    ],
  },
];

interface CheckResult {
  correct: Mark[];
  wrongType: Mark[];
  extra: Mark[];
  missed: Mark[];
  accuracy: number;
}

const keyOf = (c: Cell) => `${c.zone}.${c.bq}.${c.sr}.${c.sc}`;

const Index = () => {
  const [taskIndex, setTaskIndex] = useState(0);
  const [tool, setTool] = useState<MarkType>('enemy');
  const [marks, setMarks] = useState<Mark[]>([]);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showRef, setShowRef] = useState(false);

  const task = TASKS[taskIndex];

  const marksByCell = useMemo(() => {
    const map = new Map<string, Mark>();
    marks.forEach((m) => map.set(keyOf(m), m));
    return map;
  }, [marks]);

  const errorCells = useMemo(() => {
    const map = new Map<string, 'wrongType' | 'extra' | 'missed'>();
    if (!result) return map;
    result.wrongType.forEach((m) => map.set(keyOf(m), 'wrongType'));
    result.extra.forEach((m) => map.set(keyOf(m), 'extra'));
    result.missed.forEach((m) => map.set(keyOf(m), 'missed'));
    return map;
  }, [result]);

  const placeMark = useCallback(
    (cell: Cell) => {
      setResult(null);
      setMarks((prev) => {
        const existing = prev.find((m) => keyOf(m) === keyOf(cell));
        if (existing) {
          if (existing.type === tool) return prev.filter((m) => m !== existing);
          return prev.map((m) => (m === existing ? { ...m, type: tool } : m));
        }
        return [...prev, { ...cell, type: tool }];
      });
    },
    [tool],
  );

  const check = () => {
    const targetMap = new Map(task.targets.map((t) => [keyOf(t), t]));
    const correct: Mark[] = [];
    const wrongType: Mark[] = [];
    const extra: Mark[] = [];
    marks.forEach((m) => {
      const t = targetMap.get(keyOf(m));
      if (!t) extra.push(m);
      else if (t.type === m.type) correct.push(m);
      else wrongType.push(m);
    });
    const missed = task.targets.filter((t) => !marks.some((m) => keyOf(m) === keyOf(t)));
    const accuracy = Math.round((correct.length / task.targets.length) * 100);
    setResult({ correct, wrongType, extra, missed, accuracy });
    setShowAnswer(false);
  };

  const reset = () => {
    setMarks([]);
    setResult(null);
    setShowAnswer(false);
  };

  const selectTask = (i: number) => {
    setTaskIndex(i);
    reset();
  };

  return (
    <div className="min-h-screen tablet-bg text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2 text-accent">
              <Icon name="Radar" size={22} />
              <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Тренажёр
              </span>
            </div>
            <h1 className="font-display text-3xl font-600 uppercase tracking-wide sm:text-4xl">
              Планшет воздушной обстановки
            </h1>
          </div>
          <button
            onClick={() => setShowRef((s) => !s)}
            className="flex items-center gap-2 rounded-md border border-border bg-card/40 px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
          >
            <Icon name="Image" size={15} /> Схема-эталон
          </button>
        </header>

        {showRef && (
          <div className="mb-6 animate-fade-in overflow-hidden rounded-lg border border-border">
            <img src={REF_IMG} alt="Схема планшета ВО" className="w-full" />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* Grid area */}
          <section>
            <div className="mb-3 rounded-md border border-border bg-card/60 px-4 py-3">
              <div className="text-xs uppercase tracking-widest text-accent">{task.title}</div>
              <div className="mt-1 text-sm text-foreground/80">{task.brief}</div>
              <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                координата: зона · большой квадрат · средний квадрат
              </div>
            </div>

            <div className="relative overflow-x-auto rounded-lg border border-border bg-card/40 p-3">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-8 scan-line bg-gradient-to-b from-primary/20 to-transparent" />
              {/* Zones */}
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: `repeat(${ZONE_COLS}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: ZONES }).map((_, zone) => (
                  <div
                    key={`zone-${zone}`}
                    className="relative rounded-sm border-2 border-[hsl(var(--grid-line-major))] bg-background/30 p-1"
                  >
                    <span className="pointer-events-none absolute -top-0.5 left-1 z-10 font-display text-xs font-700 text-accent/90">
                      {zoneNumber(zone)}
                    </span>
                    {/* Big squares */}
                    <div
                      className="grid gap-px"
                      style={{ gridTemplateColumns: `repeat(${BQ_COLS}, minmax(0, 1fr))` }}
                    >
                      {Array.from({ length: BQ_PER_ZONE }).map((_, bq) => (
                        <div
                          key={`bq-${zone}-${bq}`}
                          className="relative border border-[hsl(var(--grid-line))]"
                        >
                          <span className="pointer-events-none absolute left-[1px] top-[-1px] z-10 text-[7px] leading-none text-muted-foreground/70">
                            {bqNumber(bq)}
                          </span>
                          {/* Middle squares 2x2 */}
                          <div className="grid grid-cols-2">
                            {Array.from({ length: SUB * SUB }).map((__, si) => {
                              const sr = Math.floor(si / SUB);
                              const sc = si % SUB;
                              const cell: Cell = { zone, bq, sr, sc };
                              const k = keyOf(cell);
                              const mark = marksByCell.get(k);
                              const err = errorCells.get(k);
                              const meta = mark ? TYPE_META[mark.type] : null;
                              const isTarget = task.targets.some((t) => keyOf(t) === k);
                              const targetMeta =
                                showAnswer && isTarget
                                  ? TYPE_META[task.targets.find((t) => keyOf(t) === k)!.type]
                                  : null;
                              return (
                                <button
                                  key={k}
                                  onClick={() => placeMark(cell)}
                                  className="relative flex aspect-square items-center justify-center text-[7px] text-muted-foreground/40 transition-colors hover:bg-primary/15"
                                  style={{
                                    outline: err
                                      ? `1px solid ${
                                          err === 'missed'
                                            ? 'hsl(38 92% 55%)'
                                            : 'hsl(0 78% 55%)'
                                        }`
                                      : undefined,
                                    outlineOffset: '-1px',
                                  }}
                                >
                                  {!meta && !targetMeta && '+'}
                                  {meta && (
                                    <span
                                      className="absolute inset-0 flex items-center justify-center animate-fade-in"
                                      style={{ color: `hsl(${meta.color})` }}
                                    >
                                      <Icon name={meta.icon} size={9} fallback="Circle" />
                                    </span>
                                  )}
                                  {!meta && targetMeta && (
                                    <span
                                      className="absolute inset-0 flex items-center justify-center opacity-50"
                                      style={{ color: `hsl(${targetMeta.color})` }}
                                    >
                                      <Icon name={targetMeta.icon} size={9} fallback="Circle" />
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Toolbar */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {(Object.keys(TYPE_META) as MarkType[]).map((t) => {
                const meta = TYPE_META[t];
                const active = tool === t;
                return (
                  <button
                    key={t}
                    onClick={() => setTool(t)}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs uppercase tracking-wide transition-all ${
                      active
                        ? 'border-transparent'
                        : 'border-border bg-card/40 text-muted-foreground hover:text-foreground'
                    }`}
                    style={
                      active
                        ? { background: `hsl(${meta.color})`, color: 'hsl(200 40% 6%)' }
                        : undefined
                    }
                  >
                    <Icon name={meta.icon} size={15} fallback="Circle" />
                    {meta.label}
                  </button>
                );
              })}
              <div className="ml-auto flex gap-2">
                <button
                  onClick={reset}
                  className="flex items-center gap-2 rounded-md border border-border bg-card/40 px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Icon name="Eraser" size={15} /> Сброс
                </button>
                <button
                  onClick={check}
                  className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-500 uppercase tracking-wide text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Icon name="ScanSearch" size={15} /> Проверить
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
                  <button
                    key={t.id}
                    onClick={() => selectTask(i)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                      i === taskIndex
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div className="uppercase tracking-wide">{t.title}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Result */}
            <div className="rounded-lg border border-border bg-card/40 p-4">
              <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-accent">
                <Icon name="Crosshair" size={14} /> Оценка
              </div>
              {!result ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Выберите тип отметки, кликайте по средним квадратам сетки и нажмите «Проверить»
                  для оценки точности нанесения.
                </p>
              ) : (
                <div className="animate-fade-in space-y-3">
                  <div className="text-center">
                    <div
                      className="font-display text-5xl font-700"
                      style={{
                        color:
                          result.accuracy === 100
                            ? 'hsl(145 63% 49%)'
                            : result.accuracy >= 50
                              ? 'hsl(38 92% 55%)'
                              : 'hsl(0 78% 55%)',
                      }}
                    >
                      {result.accuracy}%
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      точность
                    </div>
                  </div>
                  <ul className="space-y-1.5 text-xs">
                    <li className="flex items-center gap-2 text-primary">
                      <Icon name="Check" size={14} /> Верно: {result.correct.length}
                    </li>
                    {result.wrongType.length > 0 && (
                      <li className="flex items-center gap-2 text-destructive">
                        <Icon name="TriangleAlert" size={14} /> Неверный тип:{' '}
                        {result.wrongType.length}
                      </li>
                    )}
                    {result.missed.length > 0 && (
                      <li className="flex items-center gap-2 text-accent">
                        <Icon name="EyeOff" size={14} /> Пропущено: {result.missed.length}
                      </li>
                    )}
                    {result.extra.length > 0 && (
                      <li className="flex items-center gap-2 text-destructive">
                        <Icon name="X" size={14} /> Лишние: {result.extra.length}
                      </li>
                    )}
                  </ul>
                  {(result.missed.length > 0 || result.wrongType.length > 0) && (
                    <div className="rounded-md border border-accent/30 bg-accent/5 p-2 text-[11px] leading-relaxed text-accent/90">
                      {result.missed.slice(0, 3).map((m) => (
                        <div key={keyOf(m)}>
                          Пропущена цель ({TYPE_META[m.type].label}): {coordLabel(m)}
                        </div>
                      ))}
                      {result.wrongType.slice(0, 3).map((m) => (
                        <div key={keyOf(m)}>Неверный тип в квадрате {coordLabel(m)}</div>
                      ))}
                    </div>
                  )}
                  {result.accuracy < 100 && (
                    <button
                      onClick={() => setShowAnswer((s) => !s)}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-accent/50 px-3 py-2 text-xs uppercase tracking-wide text-accent transition-colors hover:bg-accent/10"
                    >
                      <Icon name={showAnswer ? 'EyeOff' : 'Eye'} size={14} />
                      {showAnswer ? 'Скрыть' : 'Показать'} эталон
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="rounded-lg border border-border bg-card/40 p-4">
              <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-accent">
                <Icon name="BookMarked" size={14} /> Легенда
              </div>
              <ul className="space-y-2 text-xs">
                {(Object.keys(TYPE_META) as MarkType[]).map((t) => {
                  const meta = TYPE_META[t];
                  return (
                    <li key={t} className="flex items-center gap-2">
                      <span style={{ color: `hsl(${meta.color})` }}>
                        <Icon name={meta.icon} size={14} fallback="Circle" />
                      </span>
                      <span className="text-muted-foreground">{meta.label}</span>
                    </li>
                  );
                })}
                <li className="flex items-center gap-2 pt-1 text-muted-foreground">
                  <span className="inline-block h-3 w-3 rounded-sm border-2 border-[hsl(var(--grid-line-major))]" />
                  зона (номер по углу)
                </li>
                <li className="flex items-center gap-2 text-muted-foreground">
                  <span className="inline-block h-3 w-3 rounded-sm border border-[hsl(var(--grid-line))]" />
                  большой квадрат 0-9
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Index;
