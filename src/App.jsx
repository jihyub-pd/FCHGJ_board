import { useState, useEffect, useMemo } from "react";

// ===== Supabase 프로젝트 정보 입력 =====
const SUPABASE_URL = "https://ozhdfewlboheqpcvbqgz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96aGRmZXdsYm9oZXFwY3ZicWd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NzUwMjksImV4cCI6MjA5ODU1MTAyOX0.X5-4JBMX94Y04PPb5zTQpsbLCk4GMAhRa6yNzhBhjuI"; 

// ===== 구글 시트 (웹에 게시한 CSV) — 개인 기록의 기준 =====
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR5mWLlevsGmjXEYbxwNuHOt26sB-jwJJi_0Y3HhYXV9OeeOfGels_837ZBikzvMnUdX4uEBNTpAkUi/pub?gid=1916584277&single=true&output=csv";

const parseCSV = (text) => {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
};

const num = (v) => { const n = Number(String(v ?? "").replace(/[^0-9.-]/g, "")); return Number.isFinite(n) ? n : 0; };

// 시트 구조: '전체 매치 수' 옆 칸에 총 매치 수, '이름' 헤더 행 아래로 선수별 기록
const readSheet = (text) => {
  const rows = parseCSV(text);
  let totalMatches = null, head = -1, col = {};
  rows.forEach((r, i) => {
    const t = r.findIndex((c) => c.replace(/\s/g, "") === "전체매치수");
    if (t >= 0 && totalMatches === null) totalMatches = num(r.slice(t + 1).find((c) => c.trim() !== ""));
    if (head < 0) {
      const n = r.findIndex((c) => c.trim() === "이름");
      if (n >= 0) { head = i; r.forEach((c, j) => { const k = c.replace(/\s|\(%\)/g, ""); if (k && !(k in col)) col[k] = j; }); }
    }
  });
  if (head < 0) return null;
  const pick = (r, ...keys) => { for (const k of keys) if (k in col) return r[col[k]]; return undefined; };
  const players = [];
  for (let i = head + 1; i < rows.length; i++) {
    const r = rows[i]; const name = (r[col["이름"]] || "").trim();
    if (!name) continue;
    const csRaw = pick(r, "클린시트");
    players.push({
      name,
      att: num(pick(r, "참석횟수", "참석")),
      g: num(pick(r, "득점")),
      mom: num(pick(r, "MOM횟수", "MOM")),
      a: num(pick(r, "도움")),
      points: pick(r, "공격포인트") !== undefined ? num(pick(r, "공격포인트")) : null,
      rate: pick(r, "참석률") !== undefined && String(pick(r, "참석률")).trim() !== "" ? num(pick(r, "참석률")) : null,
      cs: csRaw !== undefined && String(csRaw).trim() !== "" ? num(csRaw) : null,
    });
  }
  return { totalMatches, players };
};

const DB_ROW_ID = 1;
const API_URL = `${SUPABASE_URL}/rest/v1/fc_records?id=eq.${DB_ROW_ID}`;

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
  "정수환":{att:3,g:0,mom:0,a:0},"주조해":{att:3,g:0,mom:0,a:0},"강준혁":{att:2,g:0,mom:0,a:0},
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

// 쿼터별 포메이션 기본 뼈대
const initialQuarterStruct = () => ({
  referee: "", ST: "", LM: "", CAM: "", RM: "", CM1: "", CM2: "", LB: "", CB1: "", CB2: "", RB: "", GK: ""
});

const emptyForm = () => ({
  date: todayStr(),
  opponent: "",
  games: [{ our: "", opp: "" }],
  attendees: [],
  goals: {},
  assists: {},
  mom: null,
  // 1~4쿼터 포메이션 통합 객체
  formations: { q1: initialQuarterStruct(), q2: initialQuarterStruct(), q3: initialQuarterStruct(), q4: initialQuarterStruct() }
});

const POS_LABELS = {
  referee: "주심", ST: "ST", LM: "LM", CAM: "CAM", RM: "RM", CM1: "CM", CM2: "CM", LB: "LB", CB1: "CB", CB2: "CB", RB: "RB", GK: "GK"
};

export default function App() {
  const [data, setData] = useState(null); 
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("board");
  const [form, setForm] = useState(emptyForm());
  const [formTab, setFormTab] = useState("q1"); // 매치 입력 내 쿼터별 전술판 탭 제어
  const [logTab, setLogTab] = useState({}); // 로그 내 쿼터 보기 토글용
  const [sortKey, setSortKey] = useState("points");
  const [sortDir, setSortDir] = useState(-1);
  const [toast, setToast] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [newPlayer, setNewPlayer] = useState("");
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState(null); // 구글 시트 기록

  const loadSheet = async () => {
    try {
      const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("sheet");
      const parsed = readSheet(await res.text());
      if (parsed && parsed.players.length) setSheet(parsed);
    } catch (e) { /* 시트를 못 읽으면 기존 계산 방식으로 표시 */ }
  };

  // 앱을 열 때, 다시 화면으로 돌아올 때, 5분마다 시트를 다시 읽음
  useEffect(() => {
    loadSheet();
    const iv = setInterval(loadSheet, 5 * 60 * 1000);
    const onVis = () => { if (document.visibilityState === "visible") loadSheet(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  const HEADERS = { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` };

  // 서버에 저장된 최신 기록 불러오기
  const loadLatest = async () => {
    const res = await fetch(API_URL, { method: "GET", headers: HEADERS });
    if (!res.ok) throw new Error("load_failed");
    const dbRows = await res.json();
    return (dbRows && dbRows.length > 0) ? dbRows[0].content : { players: ROSTER, matches: [] };
  };

  const fetchFromSupabase = async () => {
    try {
      setData(await loadLatest());
    } catch (e) {
      setData({ players: ROSTER, matches: [] });
      showToast("기록을 불러오지 못했어요. 잠시 후 새로고침해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFromSupabase(); }, []);

  // 저장: 최신 기록을 먼저 받아와서 내 변경만 반영한 뒤 저장 (동시에 입력해도 서로 덮어쓰지 않음)
  const saveChange = async (mutate) => {
    try {
      const latest = await loadLatest();
      const next = mutate(latest);
      const res = await fetch(API_URL, {
        method: "PATCH",
        headers: { ...HEADERS, "Content-Type": "application/json", "Prefer": "return=minimal" },
        body: JSON.stringify({ content: next })
      });
      if (!res.ok) throw new Error("save_failed");
      setData(next);
      return true;
    } catch (e) {
      showToast("저장에 실패했어요. 인터넷 연결을 확인해 주세요.");
      return false;
    }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2600); };

  // ---------- 통계 연산 ----------
  const validGames = (m) => m.games.filter((x) => x.our !== "" && x.opp !== "" && x.our !== null && x.opp !== null);

  // 앱에 입력된 매치에서 계산한 클린시트 (시트에 값이 없을 때 사용)
  const appCleanSheets = (name) => (data ? data.matches.reduce((sum, m) =>
    sum + (m.attendees.includes(name) ? validGames(m).filter((x) => Number(x.opp) === 0).length : 0), 0) : 0);

  const stats = useMemo(() => {
    if (!data) return [];
    // 1) 구글 시트가 있으면 시트 숫자를 그대로 사용 (전체 누적 기록)
    if (sheet) {
      const total = sheet.totalMatches || 0;
      const fromSheet = sheet.players.map((p) => ({
        name: p.name, att: p.att, g: p.g, a: p.a, mom: p.mom,
        cs: p.cs !== null ? p.cs : appCleanSheets(p.name),
        points: p.points !== null ? p.points : p.g + p.a,
        rate: p.rate !== null ? p.rate : (total ? Math.round((p.att / total) * 100) : 0),
      }));
      const inSheet = new Set(fromSheet.map((p) => p.name));
      const extra = data.players.filter((n) => !inSheet.has(n))
        .map((name) => ({ name, att: 0, g: 0, a: 0, mom: 0, cs: 0, points: 0, rate: 0 }));
      return [...fromSheet, ...extra];
    }
    // 2) 시트를 못 읽었을 때: 기존 방식 (기본 기록 + 앱 입력 매치)
    const totalMatches = BASE_MATCHES + data.matches.length;
    return data.players.map((name) => {
      const b = BASE[name] || zero();
      let att = b.att, g = b.g, a = b.a, mom = b.mom, cs = 0;
      data.matches.forEach((m) => {
        if (m.attendees.includes(name)) {
          att++;
          cs += validGames(m).filter((x) => Number(x.opp) === 0).length;
        }
        g += m.goals[name] || 0;
        a += m.assists[name] || 0;
        if (m.mom === name) mom++;
      });
      return { name, att, g, a, mom, cs, points: g + a, rate: totalMatches ? Math.round((att / totalMatches) * 100) : 0 };
    });
  }, [data, sheet]);

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

  const podium = useMemo(() => [...stats].sort((x, y) => (y.points - x.points) || (y.g - x.g) || (y.att - x.att)).slice(0, 3), [stats]);

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
    if (sheet && sheet.totalMatches) t.matchDays = sheet.totalMatches;
    return t;
  }, [data, sheet]);

  // ---------- 입력 제어 및 전술판 로직 ----------
  const toggleAttendee = (name) => {
    setForm((f) => {
      const on = f.attendees.includes(name);
      const attendees = on ? f.attendees.filter((n) => n !== name) : [...f.attendees, name];
      const goals = { ...f.goals }, assists = { ...f.assists };
      let mom = f.mom;
      
      const nextFormations = { ...f.formations };
      if (on) {
        delete goals[name]; delete assists[name]; if (mom === name) mom = null;
        // 출석 취소 시 포메이션에 배치되어 있던 이름 자동 삭제 처리
        Object.keys(nextFormations).forEach((qKey) => {
          Object.keys(nextFormations[qKey]).forEach((pos) => {
            if (nextFormations[qKey][pos] === name) nextFormations[qKey][pos] = "";
          });
        });
      }
      return { ...f, attendees, goals, assists, mom, formations: nextFormations };
    });
  };

  const handlePositionChange = (qKey, pos, name) => {
    setForm((f) => {
      const updatedQuarter = { ...f.formations[qKey], [pos]: name };
      return { ...f, formations: { ...f.formations, [qKey]: updatedQuarter } };
    });
  };

  // 현재 쿼터에서 선수가 대기 명단에 있는지 판별
  const getSubstitutes = (qKey) => {
    const currentAllocated = Object.values(form.formations[qKey]);
    return form.attendees.filter(name => !currentAllocated.includes(name) || name === "");
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
      formations: form.formations // 쿼터 전술 정보 세이브
    };
    const ok = await saveChange((d) => ({ ...d, matches: [...d.matches, match].sort((a, b) => a.date.localeCompare(b.date)) }));
    if (!ok) return;
    setForm(emptyForm());
    setTab("board");
    showToast("매치 기록을 저장했어요");
  };

  const deleteMatch = async (id) => {
    const ok = await saveChange((d) => ({ ...d, matches: d.matches.filter((m) => m.id !== id) }));
    setConfirmDel(null);
    if (!ok) return;
    showToast("매치를 삭제했어요");
  };

  const addPlayer = async () => {
    const name = newPlayer.trim();
    if (!name) return;
    if (data.players.includes(name)) { showToast("이미 명단에 있는 이름이에요"); return; }
    const ok = await saveChange((d) => ({ ...d, players: d.players.includes(name) ? d.players : [...d.players, name] }));
    if (!ok) return;
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

  // 포메이션 전술판 렌더링용 컴포넌트 내부 함수
  const renderTacticalBoard = (qKey, isReadOnly = false, matchLogData = null) => {
    const targetFormations = isReadOnly ? matchLogData.formations?.[qKey] : form.formations[qKey];
    if (!targetFormations) return <div className="no-pitch">이 매치는 전술판 데이터가 없습니다.</div>;

    // 대기 명단 계산
    const allocatedNames = Object.values(targetFormations);
    const attendeesList = isReadOnly ? matchLogData.attendees : form.attendees;
    const waitingList = attendeesList.filter(name => !allocatedNames.includes(name) && name !== "");

    const renderSelector = (pos) => {
      const currentVal = targetFormations[pos] || "";
      if (isReadOnly) {
        return <div className="pos-read-val">{currentVal || "-"}</div>;
      }
      return (
        <select 
          value={currentVal} 
          onChange={(e) => handlePositionChange(qKey, pos, e.target.value)}
          className="pos-select"
        >
          <option value="">선택</option>
          {form.attendees.map(name => {
            // 미선택 상태거나, 본인이 이미 잡은 칸 외의 칸에 중복으로 들어가는 것 방지
            const isAllocatedElsewhere = allocatedNames.includes(name) && currentVal !== name;
            return (
              <option key={name} value={name} disabled={isAllocatedElsewhere && name !== ""}>
                {name}
              </option>
            );
          })}
        </select>
      );
    };

    return (
      <div className="pitch-container">
        {/* 주심 및 대기 명단 레이아웃 */}
        <div className="pitch-top-bar">
          <div className="top-bar-box">
            <div className="bar-label header-gray">주심</div>
            <div className="bar-value">
              {isReadOnly ? (targetFormations.referee || "-") : (
                <select value={targetFormations.referee || ""} onChange={(e) => handlePositionChange(qKey, "referee", e.target.value)} className="pos-select font-small">
                  <option value="">선택</option>
                  {form.attendees.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              )}
            </div>
          </div>
          <div className="top-bar-box flex-grow">
            <div className="bar-label header-gray">대기</div>
            <div className="bar-value text-left font-subtle-box">
              {waitingList.length > 0 ? waitingList.join(", ") : "대기 선수 없음"}
            </div>
          </div>
        </div>

        {/* 메인 경기장 포메이션 보드 */}
        <div className="pitch-board">
          {/* ST 라인 */}
          <div className="pitch-row row-center">
            <div className="pos-node border-blue">
              <span className="pos-tag text-blue">ST</span>
              {renderSelector("ST")}
            </div>
          </div>

          {/* 미드필더 2선 라인 */}
          <div className="pitch-row row-space-between">
            <div className="pos-node border-green">
              <span className="pos-tag text-green">LM</span>
              {renderSelector("LM")}
            </div>
            <div className="pos-node border-green">
              <span className="pos-tag text-green">CAM</span>
              {renderSelector("CAM")}
            </div>
            <div className="pos-node border-green">
              <span className="pos-tag text-green">RM</span>
              {renderSelector("RM")}
            </div>
          </div>

          {/* 3선 CM 중앙 수비형 라인 */}
          <div className="pitch-row row-double-center">
            <div className="pos-node border-green">
              <span className="pos-tag text-green">CM</span>
              {renderSelector("CM1")}
            </div>
            <div className="pos-node border-green">
              <span className="pos-tag text-green">CM</span>
              {renderSelector("CM2")}
            </div>
          </div>

          {/* 수비 4선 백라인 */}
          <div className="pitch-row row-space-between">
            <div className="pos-node border-orange">
              <span className="pos-tag text-orange">LB</span>
              {renderSelector("LB")}
            </div>
            <div className="pos-node border-orange">
              <span className="pos-tag text-orange">CB</span>
              {renderSelector("CB1")}
            </div>
            <div className="pos-node border-orange">
              <span className="pos-tag text-orange">CB</span>
              {renderSelector("CB2")}
            </div>
            <div className="pos-node border-orange">
              <span className="pos-tag text-orange">RB</span>
              {renderSelector("RB")}
            </div>
          </div>

          {/* GK 골키퍼 */}
          <div className="pitch-row row-center">
            <div className="pos-node border-gray">
              <span className="pos-tag text-gray">GK</span>
              {renderSelector("GK")}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const allPlayers = data ? [...new Set([...(sheet ? sheet.players.map((p) => p.name) : []), ...data.players])] : [];
  const filteredRoster = allPlayers.filter((n) => n.includes(query.trim()));

  if (loading) {
    return (
      <div className="wrap"><style>{CSS}</style><div className="loading"><span className="ball" />기록 불러오는 중</div></div>
    );
  }

  return (
    <div className="wrap">
      <style>{CSS}</style>

      <header className="board-head">
        <svg className="pitch-mark" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="58" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="3" fill="currentColor" />
          <line x1="0" y1="100" x2="200" y2="100" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <div className="head-inner">
          <div className="brand"><span className="crest">FC</span><div><div className="team">헌강자 FC</div><div className="sub-brand">팀 기록실</div></div></div>
          <div className="scoreboard" aria-label="팀 통산 전적">
            <div className="sb w"><span className="n">{teamRecord.w}</span><span className="l">승</span></div>
            <div className="sb d"><span className="n">{teamRecord.d}</span><span className="l">무</span></div>
            <div className="sb l"><span className="n">{teamRecord.l}</span><span className="l">패</span></div>
          </div>
          <dl className="record-strip">
            <div className="rec"><dt>매치</dt><dd>{teamRecord.matchDays}</dd></div>
            <div className="rec"><dt>게임</dt><dd>{teamRecord.games}</dd></div>
            <div className="rec"><dt>득실</dt><dd>{teamRecord.gf}:{teamRecord.ga}</dd></div>
            <div className="rec"><dt>선수단</dt><dd>{stats.length}</dd></div>
          </dl>
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
          <div className="podium">
            {podium.map((p, i) => (
              <div className={`pod pod-${i + 1}`} key={p.name}>
                <span className="pod-rank">{i + 1}</span>
                <span className="pod-name">{p.name}</span>
                <span className="pod-pts">{p.points}<small>P</small></span>
                <span className="pod-sub">{p.g}골 {p.a}도움</span>
              </div>
            ))}
          </div>
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
                  <tr key={s.name} className={i < 3 && sortKey === "points" && sortDir === -1 ? "top" : ""}>
                    <td className="rank-col">{i + 1}</td>
                    <td className="name-col">{s.name}</td>
                    <td className="strong">{s.points}</td>
                    <td>{s.g}</td>
                    <td>{s.a}</td>
                    <td className={s.mom > 0 ? "mom-cell" : "dim"}>{s.mom > 0 ? `★ ${s.mom}` : "–"}</td>
                    <td>{s.att}</td>
                    <td>{s.rate}%</td>
                    <td>{s.cs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">{sheet ? "개인 기록은 팀 구글 시트 기준이며, 시트를 고치면 자동으로 반영돼요." : "시트를 불러오지 못해 앱에 입력된 기록으로 계산했어요."} 열 제목을 누르면 정렬돼요.</p>

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

          <div className="section-label">
            참석 선수 <b>{form.attendees.length}</b>명
            <input className="roster-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이름 검색" />
          </div>
          <div className="chip-grid">
            {filteredRoster.map((n) => (
              <button key={n} className={form.attendees.includes(n) ? "chip on" : "chip"} onClick={() => toggleAttendee(n)}>{n}</button>
            ))}
          </div>

          {/* 쿼터별 포메이션 전술판 전용 배치 탭 영역 */}
          <div className="section-label">당일 쿼터별 라인업 전술판</div>
          <div className="quarter-nav-tabs">
            {["q1", "q2", "q3", "q4"].map((q) => (
              <button key={q} type="button" className={formTab === q ? "q-nav-btn activated" : "q-nav-btn"} onClick={() => setFormTab(q)}>
                {q === "q1" ? "1쿼터" : q === "q2" ? "2쿼터" : q === "q3" ? "3쿼터" : "4쿼터"}
              </button>
            ))}
          </div>
          <div className="quarter-board-wrapper">
            {renderTacticalBoard(formTab, false)}
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
                      <button type="button" onClick={() => step("goals", n, -1)}>−</button>
                      <span className="st-val">{form.goals[n] || 0}</span>
                      <button type="button" onClick={() => step("goals", n, 1)}>+</button>
                    </div>
                    <div className="stepper">
                      <span className="st-lab">A</span>
                      <button type="button" onClick={() => step("assists", n, -1)}>−</button>
                      <span className="st-val">{form.assists[n] || 0}</span>
                      <button type="button" onClick={() => step("assists", n, 1)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <button className="save" disabled={!canSave} onClick={saveMatch}>
            {canSave ? "매치 저장" : "스코어와 참석 선수를 입력하면 저장할 수 있어요"}
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
            <div className="empty">아직 앱에서 입력한 매치가 없어요. 매치 입력 탭에서 첫 경기를 기록해 보세요.</div>
          )}
          <div className="log-list">
            {[...data.matches].reverse().map((m) => {
              const currentLogQuarter = logTab[m.id] || "q1";
              return (
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
                      
                      {/* 로그 상세보기 내부 쿼터 포메이션 라인업 확인용 */}
                      <div className="log-formation-section">
                        <div className="section-label sub-title">당일 매치 쿼터별 라인업 기록</div>
                        <div className="quarter-nav-tabs">
                          {["q1", "q2", "q3", "q4"].map((q) => (
                            <button 
                              key={q} 
                              type="button" 
                              className={currentLogQuarter === q ? "q-nav-btn activated" : "q-nav-btn"} 
                              onClick={() => setLogTab({ ...logTab, [m.id]: q })}
                            >
                              {q === "q1" ? "1쿼터" : q === "q2" ? "2쿼터" : q === "q3" ? "3쿼터" : "4쿼터"}
                            </button>
                          ))}
                        </div>
                        <div className="quarter-board-wrapper">
                          {renderTacticalBoard(currentLogQuarter, true, m)}
                        </div>
                      </div>

                      {confirmDel === m.id ? (
                        <div className="del-confirm">
                          이 매치를 삭제할까요?
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
              );
            })}
          </div>
        </section>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

const CSS = `
:root {
  --pitch: #0F3B2C; --pitch-2: #145038; --grass: #1C6B48; --chalk: #EEF1EC; --card: #FFFFFF;
  --ink: #14211B; --ink-2: #66756C; --ink-3: #9AA69E; --line: #DCE3DB; --line-2: #E9EEE8;
  --gold: #C99A1E; --gold-soft: #F6EDD3;
  --win: #1F7A4E; --win-soft: #DDEFE4; --loss: #C0453A; --loss-soft: #F7E1DE; --draw: #7E8A84; --draw-soft: #E8ECE9;
  --r: 14px;
  --font: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--chalk); -webkit-text-size-adjust: 100%; }
body { padding-bottom: env(safe-area-inset-bottom, 0px); }
button, input, select { font: inherit; color: inherit; }
button { cursor: pointer; }
button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.wrap { min-height: 100vh; background: var(--chalk); color: var(--ink); font-family: var(--font); max-width: 760px; margin: 0 auto; padding-bottom: 96px; font-feature-settings: "tnum"; letter-spacing: -0.01em; }
.loading { padding: 120px 0; text-align: center; color: var(--ink-2); font-size: 14px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
.ball { width: 22px; height: 22px; border-radius: 50%; border: 3px solid var(--line); border-top-color: var(--pitch); animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* header */
.board-head { position: relative; overflow: hidden; background: var(--pitch); color: #fff; padding: calc(env(safe-area-inset-top, 0px) + 22px) 20px 20px; }
.board-head::before { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 48px, transparent 48px 96px); pointer-events: none; }
.pitch-mark { position: absolute; right: -70px; top: 50%; transform: translateY(-50%); width: 240px; height: 240px; color: rgba(255,255,255,.1); pointer-events: none; }
.head-inner { position: relative; }
.brand { display: flex; align-items: center; gap: 10px; }
.crest { width: 34px; height: 34px; border-radius: 10px; background: #fff; color: var(--pitch); font-weight: 800; font-size: 13px; display: grid; place-items: center; letter-spacing: 0; }
.team { font-size: 17px; font-weight: 700; line-height: 1.2; }
.sub-brand { font-size: 12px; color: rgba(255,255,255,.62); }
.scoreboard { display: flex; gap: 8px; margin: 22px 0 18px; }
.sb { flex: 1; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.1); border-radius: 12px; padding: 10px 12px 8px; display: flex; align-items: baseline; gap: 6px; }
.sb .n { font-size: 34px; font-weight: 800; line-height: 1; letter-spacing: -0.03em; }
.sb .l { font-size: 13px; color: rgba(255,255,255,.62); }
.sb.w .n { color: #fff; }
.sb.l .n { color: rgba(255,255,255,.78); }
.record-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; margin: 0; border-top: 1px solid rgba(255,255,255,.12); padding-top: 12px; }
.rec dt { font-size: 11.5px; color: rgba(255,255,255,.55); }
.rec dd { margin: 2px 0 0; font-size: 16px; font-weight: 700; }

/* tabs */
.tabs { display: flex; gap: 4px; margin: 0; padding: 10px 16px; position: sticky; top: 0; z-index: 5; background: rgba(238,241,236,.92); backdrop-filter: saturate(1.4) blur(10px); -webkit-backdrop-filter: saturate(1.4) blur(10px); border-bottom: 1px solid var(--line); padding-top: calc(env(safe-area-inset-top, 0px) + 10px); }
.tab { flex: 1; padding: 9px 0; border: 0; background: transparent; border-radius: 10px; font-size: 14px; font-weight: 600; color: var(--ink-2); }
.tab.on { background: var(--card); color: var(--ink); box-shadow: 0 1px 2px rgba(20,33,27,.08), 0 0 0 1px var(--line); }
section { padding: 16px 16px 0; }

/* podium */
.podium { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 14px; }
.pod { background: var(--card); border: 1px solid var(--line); border-radius: var(--r); padding: 12px 12px 11px; display: flex; flex-direction: column; min-width: 0; }
.pod-1 { background: var(--pitch); border-color: var(--pitch); color: #fff; }
.pod-rank { font-size: 12px; font-weight: 700; color: var(--ink-3); }
.pod-1 .pod-rank { color: var(--gold); }
.pod-name { font-size: 15px; font-weight: 700; margin-top: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pod-pts { font-size: 26px; font-weight: 800; line-height: 1.1; margin-top: 2px; letter-spacing: -0.03em; }
.pod-pts small { font-size: 12px; font-weight: 600; margin-left: 2px; color: var(--ink-3); }
.pod-1 .pod-pts small, .pod-1 .pod-sub { color: rgba(255,255,255,.6); }
.pod-sub { font-size: 11.5px; color: var(--ink-2); margin-top: 2px; }

/* table */
.table-scroll { overflow-x: auto; background: var(--card); border: 1px solid var(--line); border-radius: var(--r); }
table { width: 100%; border-collapse: collapse; font-size: 14px; white-space: nowrap; }
th { font-size: 12px; font-weight: 600; color: var(--ink-2); text-align: right; padding: 11px 10px; border-bottom: 1px solid var(--line); background: var(--card); position: sticky; top: 0; }
th.click { cursor: pointer; user-select: none; }
td { text-align: right; padding: 11px 10px; border-bottom: 1px solid var(--line-2); }
tbody tr:last-child td { border-bottom: 0; }
.rank-col { width: 36px; text-align: center; color: var(--ink-3); font-weight: 600; position: sticky; left: 0; background: var(--card); }
.name-col { text-align: left; font-weight: 600; position: sticky; left: 36px; background: var(--card); }
th.name-col, th.rank-col { z-index: 1; }
tr.top .rank-col { color: var(--gold); }
td.strong { font-weight: 800; }
td.mom-cell { color: var(--gold); font-weight: 700; }
td.dim { color: var(--ink-3); }
.note { font-size: 12.5px; color: var(--ink-2); margin: 10px 2px 0; line-height: 1.5; }
.add-player { display: flex; gap: 8px; margin-top: 18px; }
.add-player input { flex: 1; padding: 11px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); font-size: 15px; }
.add-player button { padding: 0 16px; border: 0; border-radius: 10px; background: var(--ink); color: #fff; font-weight: 600; font-size: 14px; }

/* form */
.form { display: flex; flex-direction: column; }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.field { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; color: var(--ink-2); }
.field input { padding: 11px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); font-size: 15px; color: var(--ink); min-height: 44px; }
.section-label { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; margin: 24px 0 10px; }
.section-label .sub { font-size: 12.5px; font-weight: 400; color: var(--ink-2); }
.section-label b { color: var(--grass); }
.roster-search { margin-left: auto; width: 130px; padding: 7px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--card); font-size: 13.5px; font-weight: 400; }
.games-box { background: var(--card); border: 1px solid var(--line); border-radius: var(--r); padding: 6px 12px; }
.game-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--line-2); }
.game-idx { width: 22px; font-size: 12px; color: var(--ink-3); font-weight: 600; }
.game-row input { width: 64px; text-align: center; padding: 9px 4px; border: 1px solid var(--line); border-radius: 9px; font-size: 16px; font-weight: 700; background: var(--chalk); }
.colon { color: var(--ink-3); font-weight: 700; }
.game-del { margin-left: auto; border: 0; background: none; color: var(--ink-3); font-size: 20px; width: 32px; height: 32px; border-radius: 8px; }
.game-add { width: 100%; border: 0; background: none; color: var(--grass); font-weight: 600; font-size: 14px; padding: 12px 0 8px; text-align: left; }
.g { display: inline-block; min-width: 40px; text-align: center; padding: 3px 7px; border-radius: 7px; font-size: 13px; font-weight: 700; }
.g.win { background: var(--win-soft); color: var(--win); }
.g.loss { background: var(--loss-soft); color: var(--loss); }
.g.draw { background: var(--draw-soft); color: var(--draw); }
.chip-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { padding: 8px 12px; border-radius: 999px; border: 1px solid var(--line); background: var(--card); font-size: 14px; color: var(--ink-2); }
.chip.on { background: var(--pitch); border-color: var(--pitch); color: #fff; font-weight: 600; }
.stat-rows { background: var(--card); border: 1px solid var(--line); border-radius: var(--r); padding: 0 12px; }
.stat-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--line-2); }
.stat-row:last-child { border-bottom: 0; }
.mom { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--line); background: var(--card); color: var(--ink-3); font-size: 15px; }
.mom.on { background: var(--gold); border-color: var(--gold); color: #fff; }
.stat-name { flex: 1; font-weight: 600; font-size: 14.5px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stepper { display: flex; align-items: center; background: var(--chalk); border-radius: 10px; padding: 2px; }
.stepper button { width: 30px; height: 30px; border: 0; background: none; font-size: 17px; color: var(--ink-2); border-radius: 8px; }
.stepper button:active { background: var(--line); }
.st-lab { font-size: 11px; font-weight: 700; color: var(--ink-3); padding: 0 2px 0 6px; }
.st-val { min-width: 18px; text-align: center; font-weight: 800; font-size: 15px; }
.save { position: sticky; bottom: calc(env(safe-area-inset-bottom, 0px) + 12px); margin-top: 28px; padding: 15px; border: 0; border-radius: 14px; background: var(--pitch); color: #fff; font-size: 16px; font-weight: 700; box-shadow: 0 8px 24px rgba(15,59,44,.25); }
.save:disabled { background: #C9D2CB; color: #fff; box-shadow: none; cursor: default; font-size: 14px; font-weight: 600; }

/* tactical board */
.quarter-nav-tabs { display: flex; gap: 4px; background: var(--line-2); padding: 3px; border-radius: 10px; margin-bottom: 10px; }
.q-nav-btn { flex: 1; border: 0; background: none; padding: 7px 0; border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--ink-2); }
.q-nav-btn.activated { background: var(--card); color: var(--ink); box-shadow: 0 1px 2px rgba(20,33,27,.1); }
.pitch-container { display: flex; flex-direction: column; gap: 8px; }
.pitch-top-bar { display: flex; gap: 8px; }
.top-bar-box { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 7px 10px; display: flex; align-items: center; gap: 8px; min-width: 0; }
.flex-grow { flex: 1; }
.bar-label { font-size: 11.5px; font-weight: 700; color: var(--ink-3); flex: none; }
.bar-value { font-size: 13px; min-width: 0; }
.font-subtle-box { color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pitch-board { position: relative; border-radius: var(--r); padding: 18px 10px; display: flex; flex-direction: column; gap: 16px;
  background: repeating-linear-gradient(180deg, #1D6A47 0 36px, #1A6242 36px 72px); box-shadow: inset 0 0 0 2px rgba(255,255,255,.35); overflow: hidden; }
.pitch-board::before { content: ""; position: absolute; left: 50%; top: -52px; width: 104px; height: 104px; transform: translateX(-50%); border: 2px solid rgba(255,255,255,.3); border-radius: 50%; }
.pitch-board::after { content: ""; position: absolute; left: 25%; right: 25%; bottom: 0; height: 58px; border: 2px solid rgba(255,255,255,.3); border-bottom: 0; }
.pitch-row { position: relative; z-index: 1; display: flex; gap: 6px; }
.row-center { justify-content: center; }
.row-space-between { justify-content: space-between; }
.row-double-center { justify-content: center; gap: 28px; }
.pos-node { background: rgba(255,255,255,.95); border-radius: 10px; padding: 4px 4px 5px; display: flex; flex-direction: column; align-items: center; width: 23%; min-width: 0; max-width: 110px; box-shadow: 0 2px 6px rgba(0,0,0,.18); border-top: 3px solid transparent; }
.border-blue { border-top-color: #D1493B; }
.border-green { border-top-color: #2E7D5B; }
.border-orange { border-top-color: #2F5FA8; }
.border-gray { border-top-color: #C99A1E; }
.pos-tag { font-size: 10px; font-weight: 800; letter-spacing: .02em; color: var(--ink-2); }
.pos-select { width: 100%; border: 0; background: transparent; font-size: 13px; font-weight: 600; text-align: center; text-align-last: center; padding: 2px 0; appearance: none; -webkit-appearance: none; color: var(--ink); }
.pos-read-val { font-size: 13px; font-weight: 600; padding: 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.no-pitch { padding: 20px; text-align: center; color: var(--ink-3); font-size: 13px; background: var(--card); border-radius: 10px; }

/* log */
.base-card { background: transparent; border: 1px dashed var(--line); border-radius: var(--r); padding: 12px 14px; margin-bottom: 10px; }
.base-card .log-date { font-size: 12px; color: var(--ink-3); }
.base-card .log-score { display: flex; align-items: center; gap: 8px; margin-top: 4px; font-size: 13px; color: var(--ink-2); }
.base-tag { font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 6px; background: var(--line-2); color: var(--ink-2); }
.empty { text-align: center; color: var(--ink-2); font-size: 14px; padding: 36px 16px; line-height: 1.6; }
.log-list { display: flex; flex-direction: column; gap: 8px; }
.log-card { background: var(--card); border: 1px solid var(--line); border-radius: var(--r); overflow: hidden; }
.log-head { width: 100%; text-align: left; border: 0; background: none; padding: 14px; display: flex; flex-direction: column; gap: 6px; }
.log-date { font-size: 12.5px; color: var(--ink-2); font-weight: 600; }
.log-score { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.games-line { display: flex; gap: 4px; flex-wrap: wrap; }
.opp { font-size: 13.5px; color: var(--ink-2); }
.log-meta { font-size: 12.5px; color: var(--ink-3); }
.log-body { padding: 0 14px 14px; border-top: 1px solid var(--line-2); font-size: 14px; line-height: 1.6; }
.log-body p { margin: 10px 0 0; }
.log-body p b { display: inline-block; width: 44px; color: var(--ink-3); font-weight: 600; font-size: 12.5px; }
.log-formation-section { margin-top: 6px; }
.sub-title { font-size: 13px; margin: 16px 0 8px; }
.del { margin-top: 14px; border: 0; background: none; color: var(--loss); font-size: 13.5px; font-weight: 600; padding: 6px 0; }
.del-confirm { margin-top: 14px; background: var(--loss-soft); border-radius: 10px; padding: 12px; font-size: 13.5px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.del-confirm button { border: 0; border-radius: 8px; padding: 7px 12px; font-weight: 600; font-size: 13px; background: var(--card); margin-left: 6px; }
.del-confirm .danger { background: var(--loss); color: #fff; }

/* toast */
.toast { position: fixed; left: 50%; bottom: calc(env(safe-area-inset-bottom, 0px) + 24px); transform: translateX(-50%); background: var(--ink); color: #fff; padding: 11px 16px; border-radius: 12px; font-size: 14px; box-shadow: 0 8px 24px rgba(0,0,0,.2); z-index: 20; max-width: calc(100% - 32px); animation: rise .2s ease-out; }
@keyframes rise { from { opacity: 0; transform: translate(-50%, 8px); } }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
@media (min-width: 640px) { .wrap { padding-left: 0; padding-right: 0; } .board-head { border-radius: 0 0 20px 20px; } }
`;
