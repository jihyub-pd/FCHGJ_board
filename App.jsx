import { useState, useEffect, useMemo } from "react";

// ===== 기존 기록 이월 (18매치 / 80게임) =====
const BASE_MATCHES = 18;
const BASE_TEAM = { games: 80, w: 25, d: 20, l: 35, gf: 74, ga: 87 };
const BASE = {
  "신재빈":{att:13,g:12,mom:1,a:6},"정수한":{att:15,g:9,mom:4,a:7},"윤지환":{att:14,g:7,mom:0,a:6},
  "김민겸":{att:6,g:6,mom:1,a:2},"박효원":{att:14,g:3,mom:0,a:4},"윤석현":{att:12,g:3,mom:0,a:4},
  "이영한":{att:11,g:3,mom:2,a:4},"차민규":{att:11,g:5,mom:2,a:1},"이은빈":{att:5,g:2,mom:1,a:3},
  "권위주":{att:3,g:4,mom:2,a:0},"김형준":{att:9,g:2,mom:0,a:2},"송병진":{att:11,g:1,mom:0,a:3},
  "정인교":{att:1,g:2,mom:1,a:1},"이지협":{att:15,g:1,mom:0,a:2},"윤승욱":{att:2,g:2,mom:0,a:0},
  "박진혁":{att:10,g:1,mom:0,a:1},"권영광":{att:3,g:1,mom:0,a:1},"최장걸":{att:14,g:1,mom:0,a:0},
  "한대호":{att:8,g:1,mom:0,a:0},"최연식":{att:4,g:1,mom:0,a:0},"박정호":{att:3,g:1,mom:0,a:0},
  "서현우":{att:2,g:1,mom:0,a:0},"이찬우":{att:6,g:0,mom:0,a:1},"허재원":{att:3,g:0,mom:0,a:1},
  "박경원":{att:1,g:0,mom:0,a:1},"최세영":{att:1,g:0,mom:0,a:1},"엄준희":{att:10,g:0,mom:2,a:0},
  "손동천":{att:6,g:0,mom:0,a:0},"엽화산":{att:5,g:0,mom:0,a:0},"서성열":{att:4,g:0,mom:0,a:0},
  "정수환":{att:3,g:0,mom:0,a:0},"주조해":{att:3,g:0,mom:0,a:0},"강준혁":{2:0,g:0,mom:0,a:0},
  "김인수":{att:2,g:0,mom:0,a:0},"김창민":{att:2,g:0,mom:0,a:0},"장동현":{att:2,g:0,mom:0,a:0},
  "문효식":{att:1,g:0,mom:0,a:0},"이동현":{att:1,g:0,mom:0,a:0},"이윤기":{att:1,g:0,mom:0,a:0},
  "임하성":{att:1,g:0,mom:0,a:0},"차재호":{att:1,g:0,mom:0,a:0},"최영웅":{att:1,g:0,mom:0,a:0},
};

const ROSTER = [
  "이지협","이영한","정수한","정수환","서성열","최세영","송병진","서현우","최연식","권영광",
  "한대호","박진혁","엄준희","김창민","문효식","윤지환","임하성","정동성","정인교","박경원",
  "박정호","엽화산","김인수","이홍정","신재빈","박효원","권위주","손동천","장동현","강준혁",
  "허재원","최장걸","윤석현","윤승욱","이찬우","김민겸","주조해","차민규","김형준","이은빈",
  "이동현","이윤기","최영웅","차재호",
];

const todayStr = () => new Date().toISOString().slice(0, 10);
const zero = () => ({ att: 0, g: 0, mom: 0, a: 0 });

const emptyForm = () => ({
  date: todayStr(),
  opponent: "",
  games: [{ our: "", opp: "" }],
  attendees: [],
  goals: {},
  assists: {},
  mom: null,
});

export default function App() {
  const [data, setData] = useState(null); 
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("board");
  const [form, setForm] = useState(emptyForm());
  const [sortKey, setSortKey] = useState("points");
  const [sortDir, setSortDir] = useState(-1);
  const [toast, setToast] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [newPlayer, setNewPlayer] = useState("");
  const [query, setQuery] = useState("");

  // KV 스토리지 대용 엔드포인트와 통신 (Vercel 연동용)
  const fetchRecords = async () => {
    try {
      const res = await fetch('/api/records');
      const json = await res.json();
      if (json && json.players) {
        setData(json);
      } else {
        setData({ players: ROSTER, matches: [] });
      }
    } catch (e) {
      setData({ players: ROSTER, matches: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const persist = async (next) => {
    setData(next);
    try {
      await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
    } catch (e) {
      showToast("중앙 서버 저장에 실패했습니다.");
    }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2600); };

  // ---------- 누적 통계 ----------
  const validGames = (m) => m.games.filter((x) => x.our !== "" && x.opp !== "" && x.our !== null && x.opp !== null);

  const stats = useMemo(() => {
    if (!data) return [];
    const totalMatches = BASE_MATCHES + data.matches.length;
    return data.players.map((name) => {
      const b = BASE[name] || zero();
      let att = b.att, g = b.g, a = b.a, mom = b.mom, cs = 0;
      data.matches.forEach((m) => {
        const present = m.attendees.includes(name);
        if (present) {
          att++;
          cs += validGames(m).filter((x) => Number(x.opp) === 0).length;
        }
        g += m.goals[name] || 0;
        a += m.assists[name] || 0;
        if (m.mom === name) mom++;
      });
      return { name, att, g, a, mom, cs, points: g + a, rate: totalMatches ? Math.round((att / totalMatches) * 100) : 0 };
    });
  }, [data]);

  const sorted = useMemo(() => {
    const arr = [...stats];
    arr.sort((x, y) => {
      if (sortKey === "name") return sortDir * x.name.localeCompare(y.name, "ko");
      const d = (x[sortKey] - y[sortKey]) * sortDir;
      if (d !== 0) return d;
      if (y.g !== x.g) return y.g - x.g;
      if (y.att !== x.att) return y.att - x.att;
      return x.name.localeCompare(y.name, "ko");
    });
    return arr;
  }, [stats, sortKey, sortDir]);

  const teamRecord = useMemo(() => {
    const t = { ...BASE_TEAM, matchDays: BASE_MATCHES };
    if (!data) return t;
    t.matchDays += data.matches.length;
    data.matches.forEach((m) => {
      validGames(m).forEach((x) => {
        const o = Number(x.our), p = Number(x.opp);
        t.games++; t.gf += o; t.ga += p;
        if (o > p) t.w++; else if (o === p) t.d++; else t.l++;
      });
    });
    return t;
  }, [data]);

  // ---------- 입력 폼 제어 생략 (기존 기직 로직 유지) ----------
  const toggleAttendee = (name) => {
    setForm((f) => {
      const on = f.attendees.includes(name);
      const attendees = on ? f.attendees.filter((n) => n !== name) : [...f.attendees, name];
      const goals = { ...f.goals }, assists = { ...f.assists };
      let mom = f.mom;
      if (on) { delete goals[name]; delete assists[name]; if (mom === name) mom = null; }
      return { ...f, attendees, goals, assists, mom };
    });
  };

  const step = (field, name, delta) => {
    setForm((f) => {
      const cur = f[field][name] || 0;
      const next = Math.max(0, cur + delta);
      const obj = { ...f[field] };
      if (next === 0) delete obj[name]; else obj[name] = next;
      return { ...f, [field]: obj };
    });
  };

  const setGame = (i, key, val) => {
    setForm((f) => {
      const games = f.games.map((x, j) => (j === i ? { ...x, [key]: val } : x));
      return { ...f, games };
    });
  };
  const addGame = () => setForm((f) => ({ ...f, games: [...f.games, { our: "", opp: "" }] }));
  const removeGame = (i) => setForm((f) => ({ ...f, games: f.games.filter((_, j) => j !== i) }));

  const formGames = form.games.filter((x) => x.our !== "" && x.opp !== "");
  const ourTotal = formGames.reduce((s, x) => s + Number(x.our), 0);
  const csGames = formGames.filter((x) => Number(x.opp) === 0).length;
  const goalSum = Object.values(form.goals).reduce((s, v) => s + v, 0);
  const canSave = form.attendees.length > 0 && formGames.length > 0;

  const saveMatch = async () => {
    if (!canSave) return;
    const match = {
      id: Date.now().toString(36),
      date: form.date,
      opponent: form.opponent.trim(),
      games: formGames.map((x) => ({ our: Number(x.our), opp: Number(x.opp) })),
      attendees: [...form.attendees],
      goals: { ...form.goals },
      assists: { ...form.assists },
      mom: form.mom,
    };
    const matches = [...data.matches, match].sort((a, b) => a.date.localeCompare(b.date));
    await persist({ ...data, matches });
    setForm(emptyForm());
    setTab("board");
    showToast("매치 기록이 중앙 서버에 저장됐어요");
  };

  const deleteMatch = async (id) => {
    const matches = data.matches.filter((m) => m.id !== id);
    await persist({ ...data, matches });
    setConfirmDel(null);
    showToast("매치를 삭제했어요");
  };

  const addPlayer = async () => {
    const name = newPlayer.trim();
    if (!name) return;
    if (data.players.includes(name)) { showToast("이미 명단에 있는 이름이에요"); return; }
    await persist({ ...data, players: [...data.players, name] });
    setNewPlayer("");
    showToast(`${name} 선수를 명단에 추가했어요`);
  };

  const arrow = (k) => (sortKey === k ? (sortDir === -1 ? " ▾" : " ▴") : "");
  const headSort = (k) => {
    if (sortKey === k) setSortDir((d) => -d);
    else { setSortKey(k); setSortDir(k === "name" ? 1 : -1); }
  };

  const gameBadge = (x, i) => {
    const o = Number(x.our), p = Number(x.opp);
    const cls = o > p ? "g win" : o === p ? "g draw" : "g loss";
    return <span key={i} className={cls}>{o}:{p}</span>;
  };

  const matchSummary = (m) => {
    const gs = validGames(m);
    let w = 0, d = 0, l = 0;
    gs.forEach((x) => {
      const o = Number(x.our), p = Number(x.opp);
      if (o > p) w++; else if (o === p) d++; else l++;
    });
    return `${w}승 ${d}무 ${l}패`;
  };

  const filteredRoster = data ? data.players.filter((n) => n.includes(query.trim())) : [];

  if (loading) {
    return (
      <div className="wrap"><style>{CSS}</style><div className="loading">클라우드 기록실 원격 연결 중…</div></div>
    );
  }

  return (
    <div className="wrap">
      <style>{CSS}</style>

      <header className="board-head">
        <svg className="pitch-mark" viewBox="0 0 200 120" aria-hidden="true">
          <circle cx="100" cy="60" r="42" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="2" />
          <line x1="100" y1="0" x2="100" y2="120" stroke="rgba(255,255,255,.14)" strokeWidth="2" />
          <circle cx="100" cy="60" r="3" fill="rgba(255,255,255,.14)" />
        </svg>
        <div className="head-inner">
          <div className="eyebrow">헌강자 FC · 실시간 클라우드</div>
          <h1>팀 기록실</h1>
          <div className="record-strip">
            <div className="rec"><span className="num">{teamRecord.matchDays}</span><span className="lab">매치</span></div>
            <div className="rec"><span className="num">{teamRecord.games}</span><span className="lab">게임</span></div>
            <div className="rec"><span className="num">{teamRecord.w}-{teamRecord.d}-{teamRecord.l}</span><span className="lab">승무패</span></div>
            <div className="rec"><span className="num">{teamRecord.gf}:{teamRecord.ga}</span><span className="lab">득실</span></div>
            <div className="rec"><span className="num">{data.players.length}</span><span className="lab">선수단</span></div>
          </div>
        </div>
      </header>

      <nav className="tabs">
        {[["board", "순위표"], ["input", "매치 입력"], ["log", "매치 기록"]].map(([k, label]) => (
          <button key={k} className={tab === k ? "tab on" : "tab"} onClick={() => setTab(k)}>{label}</button>
        ))}
      </nav>

      {/* ---------- 순위표 ---------- */}
      {tab === "board" && (
        <section>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th className="rank-col">#</th>
                  <th className="name-col click" onClick={() => headSort("name")}>이름{arrow("name")}</th>
                  <th className="click" onClick={() => headSort("points")}>공격P{arrow("points")}</th>
                  <th className="click" onClick={() => headSort("g")}>득점{arrow("g")}</th>
                  <th className="click" onClick={() => headSort("a")}>도움{arrow("a")}</th>
                  <th className="click" onClick={() => headSort("mom")}>MOM{arrow("mom")}</th>
                  <th className="click" onClick={() => headSort("att")}>출석{arrow("att")}</th>
                  <th className="click" onClick={() => headSort("rate")}>출석률{arrow("rate")}</th>
                  <th className="click" onClick={() => headSort("cs")}>클린시트{arrow("cs")}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, i) => (
                  <tr key={s.name}>
                    <td className="rank-col">{i + 1}</td>
                    <td className="name-col">{s.name}</td>
                    <td className="strong">{s.points}</td>
                    <td>{s.g}</td>
                    <td>{s.a}</td>
                    <td>{s.mom > 0 ? `★${s.mom}` : "-"}</td>
                    <td>{s.att}</td>
                    <td>{s.rate}%</td>
                    <td>{s.cs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">어떤 기기에서 접속하든 실시간으로 실시간 연동 및 공유됩니다.</p>

          <div className="add-player">
            <input value={newPlayer} onChange={(e) => setNewPlayer(e.target.value)} placeholder="새 선수 이름"
              onKeyDown={(e) => e.key === "Enter" && addPlayer()} />
            <button onClick={addPlayer}>선수 추가</button>
          </div>
        </section>
      )}

      {/* ---------- 매치 입력 ---------- */}
      {tab === "input" && (
        <section className="form">
          <div className="field-row">
            <label className="field">
              <span>날짜</span>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </label>
            <label className="field">
              <span>상대팀 (선택)</span>
              <input value={form.opponent} placeholder="예: 윤상현팀" onChange={(e) => setForm({ ...form, opponent: e.target.value })} />
            </label>
          </div>

          <div className="section-label">게임 스코어 <span className="sub">쿼터·세트별로 추가</span></div>
          <div className="games-box">
            {form.games.map((x, i) => (
              <div className="game-row" key={i}>
                <span className="game-idx">{i + 1}</span>
                <input type="number" min="0" inputMode="numeric" placeholder="우리" value={x.our}
                  onChange={(e) => setGame(i, "our", e.target.value)} />
                <span className="colon">:</span>
                <input type="number" min="0" inputMode="numeric" placeholder="상대" value={x.opp}
                  onChange={(e) => setGame(i, "opp", e.target.value)} />
                {x.our !== "" && x.opp !== "" && gameBadge(x, i)}
                {form.games.length > 1 && (
                  <button className="game-del" onClick={() => removeGame(i)} title="이 게임 삭제">×</button>
                )}
              </div>
            ))}
            <button className="game-add" onClick={addGame}>+ 게임 추가</button>
          </div>
          {csGames > 0 && (
            <div className="hint good">실점 0 게임 {csGames}개 → 참석자 전원에게 클린시트 {csGames}회가 기록됩니다</div>
          )}

          <div className="section-label">
            참석 선수 <b>{form.attendees.length}</b>명
            <input className="roster-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이름 검색" />
          </div>
          <div className="chip-grid">
            {filteredRoster.map((n) => (
              <button key={n} className={form.attendees.includes(n) ? "chip on" : "chip"} onClick={() => toggleAttendee(n)}>{n}</button>
            ))}
          </div>

          {form.attendees.length > 0 && (
            <>
              <div className="section-label">기록 입력 <span className="sub">득점 · 도움 · MOM(★는 1명)</span></div>
              <div className="stat-rows">
                {form.attendees.map((n) => (
                  <div className="stat-row" key={n}>
                    <button className={form.mom === n ? "mom on" : "mom"} title="MOM 지정"
                      onClick={() => setForm({ ...form, mom: form.mom === n ? null : n })}>★</button>
                    <div className="stat-name">{n}</div>
                    <div className="stepper">
                      <span className="st-lab">G</span>
                      <button onClick={() => step("goals", n, -1)}>−</button>
                      <span className="st-val">{form.goals[n] || 0}</span>
                      <button onClick={() => step("goals", n, 1)}>+</button>
                    </div>
                    <div className="stepper">
                      <span className="st-lab">A</span>
                      <button onClick={() => step("assists", n, -1)}>−</button>
                      <span className="st-val">{form.assists[n] || 0}</span>
                      <button onClick={() => step("assists", n, 1)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
              {formGames.length > 0 && goalSum > ourTotal && (
                <div className="hint warn">개인 득점 합({goalSum})이 팀 총득점({ourTotal})보다 많아요. 확인해 주세요.</div>
              )}
              {formGames.length > 0 && goalSum < ourTotal && (
                <div className="hint">개인 득점 합 {goalSum} / 팀 총득점 {ourTotal} — 차이는 용병·자책골 득점으로 간주돼요.</div>
              )}
            </>
          )}

          <button className="save" disabled={!canSave} onClick={saveMatch}>
            {canSave ? "매치 기록 저장" : "게임 스코어와 참석 선수를 입력해 주세요"}
          </button>
        </section>
      )}

      {/* ---------- 매치 기록 ---------- */}
      {tab === "log" && (
        <section>
          <div className="base-card">
            <div className="log-date">~ 2026-07-04</div>
            <div className="log-score"><span className="base-tag">이월</span><span className="opp">18매치 · 80게임 · 25승 20무 35패 · 득실 74:87</span></div>
          </div>
          {data.matches.length === 0 && (
            <div className="empty">중앙 클라우드에 기록된 매치가 아직 없어요.<br /><b>매치 입력</b> 탭에서 경기를 등록해 보세요.</div>
          )}
          <div className="log-list">
            {[...data.matches].reverse().map((m) => (
              <div className="log-card" key={m.id}>
                <button className="log-head" onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
                  <div className="log-date">{m.date}</div>
                  <div className="log-score">
                    <span className="games-line">{validGames(m).map(gameBadge)}</span>
                    {m.opponent && <span className="opp">vs {m.opponent}</span>}
                  </div>
                  <div className="log-meta">{matchSummary(m)} · {m.attendees.length}명</div>
                </button>
                {expanded === m.id && (
                  <div className="log-body">
                    {Object.keys(m.goals).length > 0 && (
                      <p><b>득점</b> {Object.entries(m.goals).map(([n, c]) => (c > 1 ? `${n}(${c})` : n)).join(", ")}</p>
                    )}
                    {Object.keys(m.assists).length > 0 && (
                      <p><b>도움</b> {Object.entries(m.assists).map(([n, c]) => (c > 1 ? `${n}(${c})` : n)).join(", ")}</p>
                    )}
                    {m.mom && <p><b>MOM</b> ★ {m.mom}</p>}
                    <p><b>출석</b> {m.attendees.join(", ")}</p>
                    {confirmDel === m.id ? (
                      <div className="del-confirm">
                        이 매치를 삭제할까요? 순위표 수치도 함께 빠집니다.
                        <div>
                          <button className="danger" onClick={() => deleteMatch(m.id)}>삭제</button>
                          <button onClick={() => setConfirmDel(null)}>취소</button>
                        </div>
                      </div>
                    ) : (
                      <button className="del" onClick={() => setConfirmDel(m.id)}>매치 삭제</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

const CSS = `
/* (CSS 코드는 이전 스타일과 완전히 일치하여 동일하게 유지됩니다.) */
:root {
  --pitch: #0E3B2E; --pitch-2: #17573F; --chalk: #F4F6F1; --card: #FFFFFF;
  --ink: #16241D; --ink-2: #5A6B61; --line: #DDE5DC; --gold: #D9A419;
  --win: #1E7A4F; --loss: #C4453A; --draw: #7A8580;
}
* { box-sizing: border-box; }
.wrap {
  min-height: 100vh; background: var(--chalk); color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", "Malgun Gothic", sans-serif;
  padding-bottom: 64px; max-width: 860px; margin: 0 auto;
}
.loading { padding: 80px 0; text-align: center; color: var(--ink-2); }
.board-head { position: relative; background: linear-gradient(160deg, var(--pitch) 0%, var(--pitch-2) 100%); color: #fff; padding: 26px 20px 22px; overflow: hidden; border-radius: 0 0 18px 18px; }
.pitch-mark { position: absolute; right: -30px; top: -14px; width: 220px; height: 150px; pointer-events: none; }
.head-inner { position: relative; }
.eyebrow { font-size: 11px; letter-spacing: .22em; opacity: .75; margin-bottom: 6px; }
.board-head h1 { margin: 0 0 16px; font-size: 22px; font-weight: 800; letter-spacing: -.01em; }
.record-strip { display: flex; gap: 20px; flex-wrap: wrap; }
.rec { display: flex; flex-direction: column; }
.rec .num { font-variant-numeric: tabular-nums; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 19px; font-weight: 700; letter-spacing: .02em; }
.rec .lab { font-size: 11px; opacity: .7; margin-top: 2px; }
.tabs { display: flex; gap: 6px; padding: 14px 16px 10px; position: sticky; top: 0; background: var(--chalk); z-index: 5; }
.tab { flex: 1; padding: 10px 0; border: 1px solid var(--line); background: var(--card); border-radius: 10px; font-size: 14px; font-weight: 600; color: var(--ink-2); cursor: pointer; }
.tab.on { background: var(--pitch); border-color: var(--pitch); color: #fff; }
section { padding: 8px 16px 0; }
.empty { background: var(--card); border: 1px dashed var(--line); border-radius: 12px; padding: 26px 16px; text-align: center; color: var(--ink-2); font-size: 14px; line-height: 1.7; margin-bottom: 14px; }
.empty b { color: var(--ink); }
.note { font-size: 12.5px; color: var(--ink-2); line-height: 1.6; margin: 10px 2px; }
.table-scroll { overflow-x: auto; background: var(--card); border: 1px solid var(--line); border-radius: 12px; }
table { border-collapse: collapse; width: 100%; min-width: 640px; font-size: 13.5px; }
th, td { padding: 9px 10px; text-align: center; white-space: nowrap; }
thead th { background: var(--card); border-bottom: 2px solid var(--pitch); font-size: 12px; color: var(--ink-2); font-weight: 700; user-select: none; }
th.click { cursor: pointer; }
tbody tr { border-bottom: 1px solid var(--line); }
tbody tr:last-child { border-bottom: none; }
tbody tr:nth-child(-n+3) .rank-col { color: var(--gold); font-weight: 800; }
td { font-variant-numeric: tabular-nums; }
td.strong { font-weight: 800; }
.rank-col { width: 34px; color: var(--ink-2); }
.name-col { text-align: left; position: sticky; left: 0; background: var(--card); font-weight: 600; min-width: 84px; }
thead .name-col { z-index: 2; }
.add-player { display: flex; gap: 8px; margin: 6px 0 14px; }
.add-player input { flex: 1; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; font-size: 14px; background: var(--card); }
.add-player button { padding: 10px 16px; border: none; border-radius: 10px; background: var(--pitch); color: #fff; font-weight: 700; font-size: 14px; cursor: pointer; }
.form { display: flex; flex-direction: column; }
.field-row { display: flex; gap: 10px; }
.field { flex: 1; display: flex; flex-direction: column; gap: 5px; }
.field span { font-size: 12px; color: var(--ink-2); font-weight: 600; }
.field input { padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; font-size: 15px; background: var(--card); width: 100%; }
.games-box { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; }
.game-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
.game-idx { width: 18px; font-size: 12px; color: var(--ink-2); font-weight: 700; }
.game-row input { width: 64px; padding: 9px 6px; border: 1px solid var(--line); border-radius: 10px; font-size: 18px; text-align: center; font-weight: 800; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
.game-row .colon { font-weight: 800; color: var(--ink-2); }
.g { font-size: 11px; font-weight: 800; color: #fff; border-radius: 6px; padding: 3px 7px; margin-right: 3px; font-variant-numeric: tabular-nums; }
.g.win { background: var(--win); } .g.draw { background: var(--draw); } .g.loss { background: var(--loss); }
.game-del { margin-left: auto; width: 28px; height: 28px; border: 1px solid var(--line); background: var(--chalk); border-radius: 8px; color: var(--loss); cursor: pointer; font-size: 14px; }
.game-add { margin-top: 4px; width: 100%; padding: 9px; border: 1px dashed var(--line); background: none; border-radius: 10px; color: var(--pitch-2); font-weight: 700; font-size: 13.5px; cursor: pointer; }
.section-label { margin: 20px 2px 8px; font-size: 14px; font-weight: 800; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.section-label .sub { font-size: 12px; color: var(--ink-2); font-weight: 500; }
.section-label b { color: var(--pitch-2); }
.roster-search { margin-left: auto; padding: 6px 10px; border: 1px solid var(--line); border-radius: 8px; font-size: 13px; width: 110px; background: var(--card); }
.chip-grid { display: flex; flex-wrap: wrap; gap: 7px; }
.chip { padding: 8px 13px; border-radius: 999px; border: 1px solid var(--line); background: var(--card); font-size: 13.5px; cursor: pointer; color: var(--ink); }
.chip.on { background: var(--pitch); color: #fff; border-color: var(--pitch); font-weight: 700; }
.stat-rows { background: var(--card); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
.stat-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-bottom: 1px solid var(--line); }
.stat-row:last-child { border-bottom: none; }
.stat-name { flex: 1; font-weight: 600; font-size: 14px; min-width: 0; }
.mom { border: 1px solid var(--line); background: var(--card); color: #C9CFC9; border-radius: 8px; width: 32px; height: 32px; font-size: 16px; cursor: pointer; flex-shrink: 0; }
.mom.on { color: #fff; background: var(--gold); border-color: var(--gold); }
.stepper { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.st-lab { font-size: 11px; color: var(--ink-2); font-weight: 700; width: 12px; }
.stepper button { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--line); background: var(--chalk); font-size: 16px; cursor: pointer; color: var(--ink); }
.st-val { width: 22px; text-align: center; font-weight: 800; font-variant-numeric: tabular-nums; }
.hint { margin-top: 10px; font-size: 13px; color: var(--ink-2); background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
.hint.warn { color: #8A3830; border-color: #E8C6C2; background: #FBF1F0; }
.hint.good { color: #1E5C40; border-color: #C9E0D2; background: #EFF7F2; }
.save { margin: 20px 0 10px; padding: 15px; border: none; border-radius: 12px; background: var(--pitch); color: #fff; font-size: 16px; font-weight: 800; cursor: pointer; }
.save:disabled { background: #B9C4BD; cursor: default; }
.log-list { display: flex; flex-direction: column; gap: 10px; }
.base-card { display: flex; align-items: center; gap: 12px; padding: 12px 14px; margin-bottom: 10px; background: var(--card); border: 1px solid var(--line); border-left: 4px solid var(--pitch); border-radius: 12px; }
.base-tag { font-size: 11px; font-weight: 800; color: var(--pitch-2); border: 1px solid var(--pitch-2); border-radius: 6px; padding: 2px 7px; margin-right: 8px; }
.log-card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
.log-head { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: none; border: none; cursor: pointer; text-align: left; font-family: inherit; }
.log-date { font-size: 12.5px; color: var(--ink-2); font-variant-numeric: tabular-nums; white-space: nowrap; }
.log-score { display: flex; align-items: center; gap: 6px; flex: 1; flex-wrap: wrap; }
.games-line { display: flex; gap: 4px; flex-wrap: wrap; }
.opp { font-size: 13px; color: var(--ink-2); }
.log-meta { font-size: 12px; color: var(--ink-2); white-space: nowrap; }
.log-body { padding: 2px 14px 14px; font-size: 13.5px; line-height: 1.7; border-top: 1px solid var(--line); }
.log-body p { margin: 8px 0; }
.log-body b { color: var(--pitch-2); margin-right: 6px; }
.del { margin-top: 6px; background: none; border: 1px solid var(--line); color: var(--loss); border-radius: 8px; padding: 7px 12px; font-size: 13px; cursor: pointer; }
.del-confirm { margin-top: 8px; background: #FBF1F0; border: 1px solid #E8C6C2; border-radius: 10px; padding: 12px; font-size: 13px; color: #8A3830; }
.del-confirm div { display: flex; gap: 8px; margin-top: 10px; }
.del-confirm button { padding: 8px 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); cursor: pointer; font-size: 13px; }
.del-confirm .danger { background: var(--loss); border-color: var(--loss); color: #fff; font-weight: 700; }
.toast { position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%); background: var(--ink); color: #fff; font-size: 14px; padding: 11px 18px; border-radius: 999px; z-index: 20; box-shadow: 0 6px 18px rgba(0,0,0,.2); }
@media (max-width: 480px) { .field-row { flex-direction: column; } .record-strip { gap: 14px; } }
`;
