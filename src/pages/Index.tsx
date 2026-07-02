import { useState, useMemo, useCallback, Fragment } from 'react';
import Icon from '@/components/ui/icon';

const COLS = 12;
const ROWS = 8;
const COL_LABELS = Array.from({ length: COLS }, (_, i) => String(i + 1).padStart(2, '0'));
const ROW_LABELS = Array.from({ length: ROWS }, (_, i) => String.fromCharCode(65 + i));

type MarkType = 'friend' | 'enemy' | 'unknown';

interface Mark {
  col: number;
  row: number;
  type: MarkType;
}

interface Task {
  id: number;
  title: string;
  brief: string;
  targets: Mark[];
}

type IconName = 'Plane' | 'Rocket' | 'HelpCircle';

const TYPE_META: Record<
  MarkType,
  { label: string; short: string; color: string; icon: IconName }
> = {
  friend: { label: 'Свой', short: 'СВ', color: '145 63% 49%', icon: 'Plane' },
  enemy: { label: 'Противник', short: 'ПР', color: '0 78% 55%', icon: 'Rocket' },
  unknown: { label: 'Неопознанный', short: '??', color: '38 92% 55%', icon: 'HelpCircle' },
};

const TASKS: Task[] = [
  {
    id: 1,
    title: 'Задание №1 — Одиночная цель',
    brief: 'Противник, квадрат D-05. Нанесите отметку.',
    targets: [{ col: 5, row: 3, type: 'enemy' }],
  },
  {
    id: 2,
    title: 'Задание №2 — Пара целей',
    brief: 'Свой борт B-02, противник F-09.',
    targets: [
      { col: 2, row: 1, type: 'friend' },
      { col: 9, row: 5, type: 'enemy' },
    ],
  },
  {
    id: 3,
    title: 'Задание №3 — Смешанная обстановка',
    brief: 'Свой A-01, неопознанный C-06, противник G-11.',
    targets: [
      { col: 1, row: 0, type: 'friend' },
      { col: 6, row: 2, type: 'unknown' },
      { col: 11, row: 6, type: 'enemy' },
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

const keyOf = (m: { col: number; row: number }) => `${m.col}-${m.row}`;

const Index = () => {
  const [taskIndex, setTaskIndex] = useState(0);
  const [tool, setTool] = useState<MarkType>('enemy');
  const [marks, setMarks] = useState<Mark[]>([]);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

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
    (col: number, row: number) => {
      setResult(null);
      setMarks((prev) => {
        const existing = prev.find((m) => m.col === col && m.row === row);
        if (existing) {
          if (existing.type === tool) {
            return prev.filter((m) => m !== existing);
          }
          return prev.map((m) => (m === existing ? { ...m, type: tool } : m));
        }
        return [...prev, { col, row, type: tool }];
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
          <div className="text-right font-mono text-xs text-muted-foreground">
            <div>СЕТКА {COLS}×{ROWS}</div>
            <div className="text-primary">СИСТЕМА · ГОТОВА</div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* Grid area */}
          <section>
            <div className="mb-3 rounded-md border border-border bg-card/60 px-4 py-3">
              <div className="text-xs uppercase tracking-widest text-accent">{task.title}</div>
              <div className="mt-1 text-sm text-foreground/80">{task.brief}</div>
            </div>

            <div className="relative overflow-x-auto rounded-lg border border-border bg-card/40 p-3">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-8 scan-line bg-gradient-to-b from-primary/20 to-transparent" />
              <div
                className="grid select-none"
                style={{ gridTemplateColumns: `28px repeat(${COLS}, minmax(0, 1fr))` }}
              >
                {/* corner */}
                <div />
                {COL_LABELS.map((c) => (
                  <div key={c} className="pb-1 text-center text-[10px] text-muted-foreground">
                    {c}
                  </div>
                ))}

                {ROW_LABELS.map((rLabel, row) => (
                  <Fragment key={`row-${rLabel}`}>
                    <div
                      className="flex items-center justify-center pr-1 text-[10px] text-muted-foreground"
                    >
                      {rLabel}
                    </div>
                    {COL_LABELS.map((_, col) => {
                      const k = `${col + 1}-${row}`;
                      const mark = marksByCell.get(k);
                      const err = errorCells.get(k);
                      const meta = mark ? TYPE_META[mark.type] : null;
                      const showTarget = showAnswer && task.targets.some((t) => keyOf(t) === k);
                      const targetMeta = showTarget
                        ? TYPE_META[task.targets.find((t) => keyOf(t) === k)!.type]
                        : null;
                      return (
                        <button
                          key={k}
                          onClick={() => placeMark(col + 1, row)}
                          className="group relative aspect-square border-[0.5px] border-[hsl(var(--grid-line))] transition-colors hover:bg-primary/10"
                          style={{
                            outline: err
                              ? `1.5px solid ${
                                  err === 'missed'
                                    ? 'hsl(38 92% 55%)'
                                    : err === 'extra'
                                      ? 'hsl(0 78% 55%)'
                                      : 'hsl(0 78% 55%)'
                                }`
                              : undefined,
                            outlineOffset: '-1.5px',
                          }}
                        >
                          {meta && (
                            <span
                              className="absolute inset-0 flex items-center justify-center animate-fade-in"
                              style={{ color: `hsl(${meta.color})` }}
                            >
                              <span
                                className="absolute h-3/4 w-3/4 rounded-full opacity-20 animate-ping-slow"
                                style={{ background: `hsl(${meta.color})` }}
                              />
                              <Icon name={meta.icon} size={13} fallback="Circle" />
                            </span>
                          )}
                          {!meta && targetMeta && (
                            <span
                              className="absolute inset-0 flex items-center justify-center opacity-50"
                              style={{ color: `hsl(${targetMeta.color})` }}
                            >
                              <Icon name={targetMeta.icon} size={13} fallback="Circle" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </Fragment>
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
                  Выберите тип отметки, кликайте по клеткам сетки и нажмите «Проверить» для оценки
                  точности.
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
                        <Icon name="AlertTriangle" size={14} /> Неверный тип:{' '}
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
                  <span className="inline-block h-3 w-3 rounded-sm outline outline-1 outline-accent" />
                  контур — пропуск/ошибка
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