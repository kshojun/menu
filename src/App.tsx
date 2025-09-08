import React, { useEffect, useState } from 'react';
import './App.css';

const WEEKDAYS: readonly string[] = ['月', '火', '水', '木', '金', '土', '日'] as const;

const MsIcon = ({ name }: { name: string }) => (
  <span className="material-symbols-outlined NavIcon" aria-hidden="true">{name}</span>
);

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const CUSTOM_HOLIDAYS: string[] = [];

function formatDateId(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isHoliday(date: Date): boolean {
  const id = formatDateId(date);
  return CUSTOM_HOLIDAYS.includes(id);
}

function buildMonthGrid(baseDate: Date): Array<{ day: number | null; isToday: boolean }>{
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth(); // 0-11
  const firstOfMonth = new Date(year, month, 1);
  const firstDay = firstOfMonth.getDay(); // 0=Sun..6=Sat
  const mondayStartOffset = (firstDay + 6) % 7; // Monday=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<{ day: number | null; isToday: boolean }> = [];
  for (let i = 0; i < mondayStartOffset; i += 1) {
    cells.push({ day: null, isToday: false });
  }
  const today = new Date();
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push({ day: d, isToday: isSameDay(new Date(year, month, d), today) });
  }
  const trailing = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < trailing; i += 1) {
    cells.push({ day: null, isToday: false });
  }
  return cells;
}

function App() {
  const [active, setActive] = useState<'home' | 'calendar' | 'shopping' | 'settings'>('home');
  const labels = { home: '献立', calendar: 'カレンダー', shopping: '買い物リスト', settings: '設定' } as const;
  const today = new Date();
  const [viewDate, setViewDate] = useState<Date>(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [weekOffset, setWeekOffset] = useState<number>(0);
  type MealType = 'breakfast' | 'lunch' | 'dinner';
  type MealCategory = 'staple' | 'main' | 'side' | 'other';
  type MealEntry = Partial<Record<MealCategory, string>>;
  type MealPlans = Record<string, Partial<Record<MealType, MealEntry>>>;
  type Suggestions = Record<MealCategory, string[]>;

  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [form, setForm] = useState<MealEntry>({});
  const [plans, setPlans] = useState<MealPlans>({});
  const [suggestions, setSuggestions] = useState<Suggestions>({
    staple: [],
    main: [],
    side: [],
    other: [],
  });
  type ShoppingItem = { id: string; text: string; done: boolean };
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [isShoppingModalOpen, setIsShoppingModalOpen] = useState(false);
  const [shoppingInput, setShoppingInput] = useState('');

  const MEAL_PLANS_KEY = 'mealPlans.v1';
  const SUGGESTIONS_KEY = 'mealSuggestions.v1';
  const SHOPPING_KEY = 'shoppingList.v1';

  useEffect(() => {
    try {
      const p = localStorage.getItem(MEAL_PLANS_KEY);
      if (p) setPlans(JSON.parse(p));
    } catch {}
    try {
      const s = localStorage.getItem(SUGGESTIONS_KEY);
      if (s) setSuggestions(JSON.parse(s));
    } catch {}
    try {
      const sh = localStorage.getItem(SHOPPING_KEY);
      if (sh) setShopping(JSON.parse(sh));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(MEAL_PLANS_KEY, JSON.stringify(plans));
  }, [plans]);

  useEffect(() => {
    localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(suggestions));
  }, [suggestions]);

  useEffect(() => {
    localStorage.setItem(SHOPPING_KEY, JSON.stringify(shopping));
  }, [shopping]);

  function addShoppingItem(text: string) {
    const t = text.trim();
    if (!t) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setShopping((prev) => [{ id, text: t, done: false }, ...prev]);
  }

  function toggleShoppingItem(id: string) {
    setShopping((prev) => prev.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
  }

  function clearDoneShoppingItems() {
    setShopping((prev) => prev.filter((it) => !it.done));
  }

  function openMealModal(date: Date, mt?: MealType) {
    const typeToUse: MealType = mt ?? mealType;
    setMealType(typeToUse);
    setSelectedDate(date);
    // 既存の値をロード
    const id = formatDateId(date);
    const existing = plans[id]?.[typeToUse] || {};
    setForm(existing);
    setIsModalOpen(true);
  }

  function closeMealModal() {
    setIsModalOpen(false);
  }

  function handleChange(category: MealCategory, value: string) {
    setForm((prev) => ({ ...prev, [category]: value }));
  }

  function saveMeal() {
    if (!selectedDate) return;
    const id = formatDateId(selectedDate);
    setPlans((prev) => {
      const next: MealPlans = { ...prev };
      const byDate = { ...(next[id] || {}) };
      const cleaned: MealEntry = {};
      (['staple', 'main', 'side', 'other'] as MealCategory[]).forEach((k) => {
        const v = (form[k] || '').trim();
        if (v) cleaned[k] = v;
      });
      byDate[mealType] = cleaned;
      next[id] = byDate;
      return next;
    });

    // 候補の更新
    setSuggestions((prev) => {
      const next: Suggestions = { ...prev };
      (['staple', 'main', 'side', 'other'] as MealCategory[]).forEach((k) => {
        const v = (form[k] || '').trim();
        if (!v) return;
        const set = new Set(next[k] || []);
        set.add(v);
        next[k] = Array.from(set).slice(0, 200);
      });
      return next;
    });

    setIsModalOpen(false);
  }

  const categoryLabels: Record<MealCategory, string> = {
    staple: '主食',
    main: '主菜',
    side: '副菜',
    other: 'その他',
  };
  const mealLabels: Record<MealType, string> = {
    breakfast: '朝食',
    lunch: '昼食',
    dinner: '夕食',
  };
  function getWeekMonday(date: Date): Date {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const offset = (d.getDay() + 6) % 7; // Monday=0
    d.setDate(d.getDate() - offset);
    return d;
  }
  function buildThisWeek(base: Date): Date[] {
    const monday = getWeekMonday(base);
    return Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
  }
  function summarize(entry: MealEntry | undefined): string {
    if (!entry) return '';
    const parts: string[] = [];
    (['staple', 'main', 'side', 'other'] as MealCategory[]).forEach((k) => {
      const v = (entry[k] || '').trim();
      if (v) parts.push(v);
    });
    return parts.join('、');
  }
  const addMonths = (date: Date, delta: number) => new Date(date.getFullYear(), date.getMonth() + delta, 1);
  return (
    <div className="App layoutColumn">
      <main className="Content">
        <header className="Content-header">
          {active === 'calendar' ? (
            <>
              {(() => {
                const title = `${viewDate.getFullYear()}年 ${viewDate.getMonth() + 1}月`;
                const cells = buildMonthGrid(viewDate);
                return (
                  <div className="Calendar">
                    <div className="Calendar-header">
                      <button
                        type="button"
                        className="Calendar-arrow"
                        aria-label="前月へ"
                        onClick={() => setViewDate(addMonths(viewDate, -1))}
                      >
                        {'<'}
                      </button>
                      <h2 className="Calendar-title">{title}</h2>
                      <button
                        type="button"
                        className="Calendar-arrow"
                        aria-label="翌月へ"
                        onClick={() => setViewDate(addMonths(viewDate, 1))}
                      >
                        {'>'}
                      </button>
                    </div>
                    <div className="Calendar-grid Calendar-weekdays">
                      {WEEKDAYS.map((w) => (
                        <div key={w} className="Calendar-weekday">{w}</div>
                      ))}
                    </div>
                    <div className="Calendar-grid">
                      {cells.map((c, idx) => {
                        const col = idx % 7; // 0=Mon .. 6=Sun
                        let extra = '';
                        const dateObj = c.day != null ? new Date(viewDate.getFullYear(), viewDate.getMonth(), c.day) : null;
                        let hasB = false, hasL = false, hasD = false;
                        if (dateObj) {
                          const sat = col === 5;
                          const sun = col === 6;
                          if (sat) extra += ' saturday';
                          if (sun) extra += ' sunday';
                          if (isHoliday(dateObj)) extra += ' holiday';
                          if (selectedDate && isSameDay(dateObj, selectedDate)) extra += ' selected';
                          const id = formatDateId(dateObj);
                          const p = plans[id] || {};
                          hasB = !!summarize(p['breakfast']);
                          hasL = !!summarize(p['lunch']);
                          hasD = !!summarize(p['dinner']);
                        }
                        return (
                          <div
                            key={idx}
                            className={`Calendar-cell${c.day == null ? ' muted' : ''}${c.isToday ? ' today' : ''}${extra}`}
                            aria-current={c.isToday ? 'date' : undefined}
                            onClick={dateObj ? () => openMealModal(dateObj) : undefined}
                          >
                            {c.day ?? ''}
                            {(hasB || hasL || hasD) && (
                              <div className="MealBadges">
                                {hasB && <span className="MealBadge">朝</span>}
                                {hasL && <span className="MealBadge">昼</span>}
                                {hasD && <span className="MealBadge">夕</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </>
          ) : active === 'home' ? (
            (() => {
              const base = new Date();
              const days = buildThisWeek(new Date(base.getFullYear(), base.getMonth(), base.getDate() + weekOffset * 7));
              const start = days[0];
              const end = days[6];
              const rangeLabel = `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`;
              return (
                <div className="WeekSingle">
                  <div className="WeekNav top">
                    <button className="WeekArrow" aria-label="先週へ" onClick={() => setWeekOffset((v) => v - 1)}>↑</button>
                  </div>
                  <h3 className="WeekSection-title">{rangeLabel}</h3>
                  <div className="WeekList">
                    {days.map((day) => {
                      const id = formatDateId(day);
                      const p = plans[id] || {};
                      const weekdayIdx = (day.getDay() + 6) % 7; // Monday=0
                      return (
                        <div key={id} className="WeekItem">
                          <div className="WeekItem-header">
                            <div className="WeekItem-date">{`${day.getMonth() + 1}/${day.getDate()} (${WEEKDAYS[weekdayIdx]})`}</div>
                          </div>
                          <div className="MealRows">
                            {(['breakfast', 'lunch', 'dinner'] as MealType[]).map((mt) => {
                              const text = summarize(p[mt]);
                              return (
                                <div
                                  key={mt}
                                  className={`MealRow clickable${text ? '' : ' empty'}`}
                                  onClick={() => openMealModal(day, mt)}
                                >
                                  <div className="MealRow-label">{mealLabels[mt]}</div>
                                  <div className="MealRow-text">{text || '—'}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="WeekNav bottom">
                    <button className="WeekArrow" aria-label="来週へ" onClick={() => setWeekOffset((v) => v + 1)}>↓</button>
                  </div>
                </div>
              );
            })()
          ) : (
            active === 'shopping' ? (
              <div className="Shopping">
                <div className="ShoppingList">
                  {shopping.length === 0 && <div className="ShoppingEmpty">アイテムがありません</div>}
                  {shopping.map((it) => (
                    <label key={it.id} className={`ShoppingItem${it.done ? ' done' : ''}`}>
                      <input
                        type="checkbox"
                        checked={it.done}
                        onChange={() => toggleShoppingItem(it.id)}
                      />
                      <span className="ShoppingCheck" aria-hidden="true"></span>
                      <span className="ShoppingText">{it.text}</span>
                    </label>
                  ))}
                </div>
                <div className="ShoppingActions">
                  <button
                    className="Fab add"
                    aria-label="追加"
                    onClick={() => { setShoppingInput(''); setIsShoppingModalOpen(true); }}
                  >
                    ＋
                  </button>
                  <button
                    className="Fab trash"
                    aria-label="完了を削除"
                    onClick={clearDoneShoppingItems}
                  >
                    🗑
                  </button>
                </div>
                {isShoppingModalOpen && (
                  <div className="ModalOverlay" role="dialog" aria-modal="true">
                    <div className="ModalCard">
                      <div className="ModalHeader">
                        <h3 className="ModalTitle">買い物アイテムを追加</h3>
                        <button className="ModalClose" onClick={() => setIsShoppingModalOpen(false)} aria-label="閉じる">×</button>
                      </div>
                      <div className="ModalBody">
                        <div className="FormRow">
                          <label className="FormLabel">内容</label>
                          <div className="FormControl">
                            <input
                              value={shoppingInput}
                              onChange={(e) => setShoppingInput(e.target.value)}
                              placeholder="例: 牛乳 2本"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  addShoppingItem(shoppingInput);
                                  setIsShoppingModalOpen(false);
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="ModalActions">
                        <button type="button" className="Button secondary" onClick={() => setIsShoppingModalOpen(false)}>キャンセル</button>
                        <button type="button" className="Button primary" onClick={() => { addShoppingItem(shoppingInput); setIsShoppingModalOpen(false); }}>追加</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : active === 'settings' ? (
              <div className="Settings">
                <h3 className="Settings-title">フィードバック</h3>
                <p className="Settings-desc">アプリの改善のため、ご意見・不具合報告などをお寄せください。</p>
                <div className="SettingsForm">
                  <div className="FormRow">
                    <label className="FormLabel">お名前</label>
                    <div className="FormControl">
                      <input placeholder="任意" />
                    </div>
                  </div>
                  <div className="FormRow">
                    <label className="FormLabel">内容</label>
                    <div className="FormControl">
                      <textarea rows={5} placeholder="ご自由にお書きください"></textarea>
                    </div>
                  </div>
                  <div className="SettingsActions">
                    <button className="Button secondary" onClick={() => {
                      const ta = document.querySelector('.Settings textarea') as HTMLTextAreaElement | null;
                      if (!ta) return;
                      const body = encodeURIComponent(ta.value);
                      const subject = encodeURIComponent('アプリへのフィードバック');
                      window.location.href = `mailto:k.shojun@gmail.com?subject=${subject}&body=${body}`;
                    }}>メールで送る</button>
                    <button className="Button" onClick={() => {
                      const ta = document.querySelector('.Settings textarea') as HTMLTextAreaElement | null;
                      if (!ta) return;
                      navigator.clipboard.writeText(ta.value || '').catch(() => {});
                      alert('内容をコピーしました');
                    }}>内容をコピー</button>
                  </div>
                </div>
              </div>
            ) : (
              <p>選択中: {labels[active]}</p>
            )
          )}
        </header>
      </main>
      {isModalOpen && selectedDate && (
        <div className="ModalOverlay" role="dialog" aria-modal="true">
          <div className="ModalCard">
            <div className="ModalHeader">
              <h3 className="ModalTitle">{formatDateId(selectedDate)} の献立</h3>
              <button className="ModalClose" onClick={closeMealModal} aria-label="閉じる">×</button>
            </div>
            <div className="ModalBody">
              <div className="FormRow">
                <label className="FormLabel">食事</label>
                <div className="FormControl">
                  <select value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
                    <option value="breakfast">{mealLabels.breakfast}</option>
                    <option value="lunch">{mealLabels.lunch}</option>
                    <option value="dinner">{mealLabels.dinner}</option>
                  </select>
                </div>
              </div>
              {(['staple', 'main', 'side', 'other'] as MealCategory[]).map((key) => (
                <div key={key} className="FormRow">
                  <label className="FormLabel">{categoryLabels[key]}</label>
                  <div className="FormControl">
                    <input
                      list={`dl-${key}`}
                      value={form[key] || ''}
                      onChange={(e) => handleChange(key, e.target.value)}
                      placeholder={`${categoryLabels[key]} を入力/選択`}
                    />
                    <datalist id={`dl-${key}`}>
                      {(suggestions[key] || []).map((opt) => (
                        <option key={opt} value={opt} />
                      ))}
                    </datalist>
                  </div>
                </div>
              ))}
            </div>
            <div className="ModalActions">
              <button type="button" className="Button secondary" onClick={closeMealModal}>キャンセル</button>
              <button type="button" className="Button primary" onClick={saveMeal}>保存</button>
            </div>
          </div>
        </div>
      )}
      <nav className="BottomNav">
        <a
          href="#"
          className={active === 'home' ? 'active' : undefined}
          aria-current={active === 'home' ? 'page' : undefined}
          onClick={(e) => {
            e.preventDefault();
            setActive('home');
          }}
        >
          <MsIcon name="home" />
          <span className="sr-only">献立</span>
        </a>
        <a
          href="#"
          className={active === 'calendar' ? 'active' : undefined}
          aria-current={active === 'calendar' ? 'page' : undefined}
          onClick={(e) => {
            e.preventDefault();
            setActive('calendar');
          }}
        >
          <MsIcon name="calendar_month" />
          <span className="sr-only">カレンダー</span>
        </a>
        <a
          href="#"
          className={active === 'shopping' ? 'active' : undefined}
          aria-current={active === 'shopping' ? 'page' : undefined}
          onClick={(e) => {
            e.preventDefault();
            setActive('shopping');
          }}
        >
          <MsIcon name="shopping_cart" />
          <span className="sr-only">買い物リスト</span>
        </a>
        <a
          href="#"
          className={active === 'settings' ? 'active' : undefined}
          aria-current={active === 'settings' ? 'page' : undefined}
          onClick={(e) => {
            e.preventDefault();
            setActive('settings');
          }}
        >
          <MsIcon name="settings" />
          <span className="sr-only">設定</span>
        </a>
      </nav>
    </div>
  );
}

export default App;
