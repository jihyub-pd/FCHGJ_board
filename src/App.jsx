import { useState, useEffect, useMemo, useRef } from "react";

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

// ===== 일정 도우미 =====
const WD = ["일", "월", "화", "수", "목", "금", "토"];
const fmtDate = (d) => { const [y, m, dd] = d.split("-").map(Number); const w = new Date(y, m - 1, dd).getDay(); return `${m}월 ${dd}일 (${WD[w]})`; };
const dday = (d) => {
  const [y, m, dd] = d.split("-").map(Number);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, dd) - t) / 86400000);
};
const ddayLabel = (n) => (n === 0 ? "오늘" : n > 0 ? `D-${n}` : "결과 미입력");
// 상대팀 이름 비교용 (띄어쓰기·대소문자 무시)
const normTeam = (n) => (n || "").replace(/\s+/g, "").toLowerCase();

// 영상 링크 → 유튜브면 임베드 주소로
const ytEmbed = (url) => {
  try {
    const u = new URL(url.trim());
    let id = "";
    if (u.hostname.includes("youtu.be")) id = u.pathname.slice(1).split("/")[0];
    else if (u.hostname.includes("youtube.com")) {
      if (u.searchParams.get("v")) id = u.searchParams.get("v");
      else { const m = u.pathname.match(/\/(shorts|live|embed)\/([^/?]+)/); if (m) id = m[2]; }
    }
    if (!id) return null;
    const t = u.searchParams.get("t") || u.searchParams.get("start");
    const sec = t ? (/^\d+$/.test(t) ? t : String(((t.match(/(\d+)h/) || [0, 0])[1] * 3600) + ((t.match(/(\d+)m/) || [0, 0])[1] * 60) + Number((t.match(/(\d+)s/) || [0, 0])[1]))) : "";
    return `https://www.youtube-nocookie.com/embed/${id}${sec && sec !== "0" ? `?start=${sec}` : ""}`;
  } catch (e) { return null; }
};
const isUrl = (v) => { try { const u = new URL(v.trim()); return u.protocol === "https:" || u.protocol === "http:"; } catch (e) { return false; } };

const emptySched = () => ({ date: todayStr(), time: "", opponent: "", place: "", memo: "" });

const emptyForm = () => ({
  scheduleId: null,
  editId: null,
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
  const [busy, setBusy] = useState(false);          // 저장 중 (연타 방지)
  const busyRef = useRef(false);
  const [playerView, setPlayerView] = useState(null); // 선수 개인 페이지
  const [backups, setBackups] = useState(null);       // 되돌리기 목록 (null이면 닫힘)
  const [expanded, setExpanded] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [newPlayer, setNewPlayer] = useState("");
  const [manage, setManage] = useState(false);      // 선수 관리 펼침
  const [selected, setSelected] = useState([]);           // 명단 관리에서 체크한 선수
  const [rosterFilter, setRosterFilter] = useState("all"); // all | active | inactive
  const [confirmBulkDel, setConfirmBulkDel] = useState(false);
  const [matchSeg, setMatchSeg] = useState("upcoming");  // upcoming | past
  const [schedForm, setSchedForm] = useState(null);       // 일정 추가 폼 (null이면 닫힘)
  const [confirmSched, setConfirmSched] = useState(null);
  const [vidInput, setVidInput] = useState({});     // 매치별 영상 링크 입력값 { [matchId]: {url, label} }
  const [playing, setPlaying] = useState(null);     // 재생 중인 영상 id
  const [confirmVid, setConfirmVid] = useState(null);
  const [showInactive, setShowInactive] = useState(false);     // 순위표에 미활동 포함
  const [showInactiveInput, setShowInactiveInput] = useState(false); // 참석 선택에 미활동 포함
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
    if (busyRef.current) return false;   // 이미 저장 중이면 무시 (두 번 저장 방지)
    busyRef.current = true; setBusy(true);
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
    } finally {
      busyRef.current = false; setBusy(false);
    }
  };

  // 관리자 PIN 확인 (삭제·되돌리기에만 사용, 맞으면 이 기기에 기억)
  const requirePin = async () => {
    let pin = "";
    try { pin = localStorage.getItem("fc-admin-pin") || ""; } catch (e) {}
    if (!pin) pin = (window.prompt("삭제하려면 관리자 PIN을 입력하세요") || "").trim();
    if (!pin) return false;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/fc_check_pin`, {
        method: "POST", headers: { ...HEADERS, "Content-Type": "application/json" }, body: JSON.stringify({ p_pin: pin })
      });
      const ok = res.ok && (await res.json()) === true;
      if (ok) { try { localStorage.setItem("fc-admin-pin", pin); } catch (e) {} return true; }
      try { localStorage.removeItem("fc-admin-pin"); } catch (e) {}
      showToast("관리자 PIN이 맞지 않아요");
      return false;
    } catch (e) { showToast("PIN을 확인하지 못했어요. 인터넷 연결을 확인해 주세요."); return false; }
  };

  // 자동 백업 목록 불러오기 / 되돌리기
  const openBackups = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/fc_backups?select=id,saved_at,content&order=id.desc&limit=30`, { headers: HEADERS });
      if (!res.ok) throw new Error();
      setBackups(await res.json());
    } catch (e) { showToast("백업 목록을 불러오지 못했어요"); }
  };
  const restoreBackup = async (b) => {
    if (!(await requirePin())) return;
    const ok = await saveChange(() => b.content);
    if (!ok) return;
    setBackups(null);
    showToast("선택한 시점으로 되돌렸어요. 되돌리기 전 상태도 백업에 남아 있어요.");
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2600); };

  // ---------- 통계 연산 ----------
  const validGames = (m) => m.games.filter((x) => x.our !== "" && x.opp !== "" && x.our !== null && x.opp !== null);

  // 삭제(숨김) 처리된 선수 — 시트에 이름이 남아 있어도 앱에서는 보이지 않음
  const hidden = useMemo(() => new Set((data && data.hidden) || []), [data]);
  // 미활동(휴식) 멤버 — 기록은 유지, 순위표와 참석 선택에서 기본으로 숨김
  const inactive = useMemo(() => new Set((data && data.inactive) || []), [data]);

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
      return [...fromSheet, ...extra].filter((p) => !hidden.has(p.name));
    }
    // 2) 시트를 못 읽었을 때: 기존 방식 (기본 기록 + 앱 입력 매치)
    const totalMatches = BASE_MATCHES + data.matches.length;
    return data.players.filter((n) => !hidden.has(n)).map((name) => {
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
  }, [data, sheet, hidden]);

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

  const activeStats = useMemo(() => stats.filter((p) => !inactive.has(p.name)), [stats, inactive]);
  const shown = useMemo(() => (showInactive ? sorted : sorted.filter((p) => !inactive.has(p.name))), [sorted, inactive, showInactive]);
  const podium = useMemo(() => [...activeStats].sort((x, y) => (y.points - x.points) || (y.g - x.g) || (y.att - x.att)).slice(0, 3), [activeStats]);

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
    const editId = form.editId;
    const match = {
      id: editId || Date.now().toString(36),
      date: form.date,
      opponent: form.opponent.trim(),
      games: formGames.map((x) => ({ our: Number(x.our), opp: Number(x.opp) })),
      attendees: [...form.attendees],
      goals: { ...form.goals },
      assists: { ...form.assists },
      mom: form.mom,
      formations: form.formations // 쿼터 전술 정보 세이브
    };
    const sid = form.scheduleId;
    const ok = await saveChange((d) => ({
      ...d,
      matches: (editId
        ? d.matches.map((m) => (m.id === editId ? { ...m, ...match } : m))   // 수정: 영상 등 기존 정보 유지
        : [...d.matches, match]).sort((a, b) => a.date.localeCompare(b.date)),
      schedule: (d.schedule || []).filter((x) => x.id !== sid)
    }));
    if (!ok) return;
    setForm(emptyForm());
    setTab(editId ? "log" : "board");
    if (editId) setMatchSeg("past");
    showToast(editId ? "매치를 수정했어요" : "매치 기록을 저장했어요");
  };

  const startEditMatch = (m) => {
    const base = emptyForm();
    setForm({
      ...base,
      editId: m.id,
      date: m.date,
      opponent: m.opponent || "",
      games: (m.games && m.games.length ? m.games : [{ our: "", opp: "" }]).map((g) => ({ our: String(g.our), opp: String(g.opp) })),
      attendees: [...(m.attendees || [])],
      goals: { ...(m.goals || {}) },
      assists: { ...(m.assists || {}) },
      mom: m.mom || null,
      formations: { ...base.formations, ...(m.formations || {}) }
    });
    setTab("input");
    window.scrollTo(0, 0);
  };

  // ---------- 경기 일정 ----------
  const schedule = useMemo(() => [...((data && data.schedule) || [])].sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""))), [data]);
  const nextMatch = schedule.find((x) => dday(x.date) >= 0);

  const addSchedule = async () => {
    const f = schedForm;
    if (!f || !f.date) return;
    const item = { id: f.id || "s" + Date.now().toString(36), date: f.date, time: f.time, opponent: f.opponent.trim(), place: f.place.trim(), memo: f.memo.trim() };
    const editing = !!f.id;
    const ok = await saveChange((d) => {
      const list = d.schedule || [];
      return { ...d, schedule: editing ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item] };
    });
    if (!ok) return;
    setSchedForm(null);
    showToast(editing ? "일정을 수정했어요" : `${fmtDate(item.date)} 경기 일정을 추가했어요`);
  };

  const deleteSchedule = async (id) => {
    if (!(await requirePin())) return;
    const ok = await saveChange((d) => ({ ...d, schedule: (d.schedule || []).filter((x) => x.id !== id) }));
    setConfirmSched(null);
    if (ok) showToast("일정을 삭제했어요");
  };

  const startResult = (x) => {
    setForm({ ...emptyForm(), date: x.date, opponent: x.opponent || "", scheduleId: x.id });
    setTab("input");
    window.scrollTo(0, 0);
    showToast("일정 정보를 불러왔어요. 스코어와 참석 선수를 입력해 주세요.");
  };

  // 전에 입력한 상대팀 이름 (자동완성용, 같은 팀은 최근 표기 하나만)
  const opponents = useMemo(() => {
    const map = new Map();
    [...(data ? data.matches : []), ...schedule].forEach((m) => { const k = normTeam(m.opponent); if (k) map.set(k, m.opponent.trim()); });
    return [...map.values()].sort((a, b) => a.localeCompare(b, "ko"));
  }, [data, schedule]);

  // ---------- 상대 전적 ----------
  const h2h = (opp) => {
    const key = normTeam(opp);
    if (!key || !data) return null;
    const ms = data.matches.filter((m) => normTeam(m.opponent) === key);
    if (!ms.length) return null;
    const r = { n: ms.length, w: 0, d: 0, l: 0, gf: 0, ga: 0, mw: 0, md: 0, ml: 0, last: ms[ms.length - 1] };
    ms.forEach((m) => {
      let mf = 0, ma = 0;
      validGames(m).forEach((x) => {
        const o = Number(x.our), p = Number(x.opp);
        r.gf += o; r.ga += p; mf += o; ma += p;
        if (o > p) r.w++; else if (o === p) r.d++; else r.l++;
      });
      if (mf > ma) r.mw++; else if (mf === ma) r.md++; else r.ml++;
    });
    return r;
  };
  const H2H = ({ opp, compact }) => {
    const r = h2h(opp);
    if (!opp || !opp.trim()) return null;
    if (!r) return <div className="h2h first">이 팀과는 첫 만남이에요</div>;
    return (
      <div className="h2h">
        <div className="h2h-top"><b>상대 전적</b><span>{r.n}번 만남</span></div>
        <div className="h2h-rec">
          <span className="w">{r.mw}승</span><span className="d">{r.md}무</span><span className="l">{r.ml}패</span>
          <span className="sub">게임 {r.w}승 {r.d}무 {r.l}패 · 득실 {r.gf}:{r.ga}</span>
        </div>
        <div className="h2h-last">최근 {fmtDate(r.last.date)} · {validGames(r.last).map((x) => `${x.our}:${x.opp}`).join(", ")}</div>
      </div>
    );
  };

  // ---------- 경기 영상 ----------
  const addVideo = async (mid) => {
    const v = vidInput[mid] || {};
    const url = (v.url || "").trim();
    if (!isUrl(url)) { showToast("영상 주소를 확인해 주세요 (https://로 시작)"); return; }
    const item = { id: "v" + Date.now().toString(36), url, label: (v.label || "").trim() };
    const ok = await saveChange((d) => ({ ...d, matches: d.matches.map((m) => (m.id === mid ? { ...m, videos: [...(m.videos || []), item] } : m)) }));
    if (!ok) return;
    setVidInput({ ...vidInput, [mid]: { url: "", label: "" } });
    showToast("영상을 추가했어요");
  };
  const removeVideo = async (mid, vid) => {
    const ok = await saveChange((d) => ({ ...d, matches: d.matches.map((m) => (m.id === mid ? { ...m, videos: (m.videos || []).filter((x) => x.id !== vid) } : m)) }));
    setConfirmVid(null);
    if (ok) showToast("영상을 삭제했어요");
  };

  const renderSchedForm = () => (
                <div className="sched-form">
                  <div className="field-row">
                    <label className="field"><span>날짜</span><input type="date" value={schedForm.date} onChange={(e) => setSchedForm({ ...schedForm, date: e.target.value })} /></label>
                    <label className="field"><span>시간</span><input type="time" value={schedForm.time} onChange={(e) => setSchedForm({ ...schedForm, time: e.target.value })} /></label>
                  </div>
                  <div className="field-row">
                    <label className="field"><span>상대팀</span><input value={schedForm.opponent} placeholder="예: FC 상암" list="opp-list" autoComplete="off" onChange={(e) => setSchedForm({ ...schedForm, opponent: e.target.value })} /></label>
                    <label className="field"><span>장소</span><input value={schedForm.place} placeholder="예: 망원 유수지" onChange={(e) => setSchedForm({ ...schedForm, place: e.target.value })} /></label>
                  </div>
                  {schedForm.opponent.trim() && <H2H opp={schedForm.opponent} />}
                  <label className="field" style={{ marginTop: 8 }}><span>메모</span><input value={schedForm.memo} placeholder="예: 원정, 흰 유니폼, 회비 1만 원" onChange={(e) => setSchedForm({ ...schedForm, memo: e.target.value })} /></label>
                  <div className="sched-actions">
                    <button className="ghost-btn" onClick={() => setSchedForm(null)}>취소</button>
                    <button className="solid-btn" disabled={busy} onClick={addSchedule}>{schedForm.id ? "수정 저장" : "일정 추가"}</button>
                  </div>
                </div>
  );

  const deleteMatch = async (id) => {
    if (!(await requirePin())) return;
    const ok = await saveChange((d) => ({ ...d, matches: d.matches.filter((m) => m.id !== id) }));
    setConfirmDel(null);
    if (!ok) return;
    showToast("매치를 삭제했어요");
  };

  const addPlayer = async () => {
    const name = newPlayer.trim();
    if (!name) return;
    const wasHidden = hidden.has(name);
    if (!wasHidden && stats.some((p) => p.name === name)) { showToast("이미 명단에 있는 이름이에요"); return; }
    const ok = await saveChange((d) => ({
      ...d,
      players: d.players.includes(name) ? d.players : [...d.players, name],
      hidden: (d.hidden || []).filter((n) => n !== name),
      inactive: (d.inactive || []).filter((n) => n !== name)
    }));
    if (!ok) return;
    setNewPlayer("");
    showToast(wasHidden ? `${name} 선수를 명단에 다시 넣었어요` : `${name} 선수를 명단에 추가했어요`);
  };

  const toggleSelect = (name) => { setConfirmBulkDel(false); setSelected((sel) => sel.includes(name) ? sel.filter((n) => n !== name) : [...sel, name]); };

  const setStatus = async (makeInactive) => {
    const names = selected;
    if (!names.length) return;
    const ok = await saveChange((d) => {
      const cur = new Set(d.inactive || []);
      names.forEach((n) => (makeInactive ? cur.add(n) : cur.delete(n)));
      return { ...d, inactive: [...cur] };
    });
    if (!ok) return;
    setSelected([]);
    showToast(`${names.length}명을 ${makeInactive ? "미활동" : "활동"} 멤버로 바꿨어요`);
  };

  const removeSelected = async () => {
    if (!(await requirePin())) return;
    const names = selected;
    const ok = await saveChange((d) => ({
      ...d,
      players: d.players.filter((n) => !names.includes(n)),
      hidden: [...new Set([...(d.hidden || []), ...names])],
      inactive: (d.inactive || []).filter((n) => !names.includes(n))
    }));
    setConfirmBulkDel(false);
    if (!ok) return;
    setSelected([]);
    showToast(`${names.length}명을 명단에서 뺐어요`);
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

  const allPlayers = data ? [...new Set([...(sheet ? sheet.players.map((p) => p.name) : []), ...data.players])].filter((n) => !hidden.has(n)) : [];
  const filteredRoster = allPlayers
    .filter((n) => showInactiveInput || !inactive.has(n) || form.attendees.includes(n))
    .filter((n) => n.includes(query.trim()));

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
            <div className="rec"><dt>활동 선수</dt><dd>{activeStats.length}</dd></div>
          </dl>
          {nextMatch && (
            <button className="next-match" onClick={() => { setTab("log"); setMatchSeg("upcoming"); }}>
              <span className="nm-d">{ddayLabel(dday(nextMatch.date))}</span>
              <span className="nm-t">다음 경기 · {fmtDate(nextMatch.date)}{nextMatch.time ? ` ${nextMatch.time}` : ""}{nextMatch.opponent ? ` · vs ${nextMatch.opponent}` : ""}{nextMatch.place ? ` · ${nextMatch.place}` : ""}</span>
            </button>
          )}
        </div>
      </header>

      <nav className="tabs">
        {[["board", "순위표"], ["input", "매치 입력"], ["log", "경기 일정"]].map(([k, label]) => (
          <button key={k} className={tab === k ? "tab on" : "tab"} onClick={() => setTab(k)}>{label}</button>
        ))}
      </nav>

      {/* ---------- 순위표 ---------- */}
      {tab === "board" && (
        <section>
          <div className="podium">
            {podium.map((p, i) => (
              <div className={`pod pod-${i + 1}`} key={p.name} role="button" tabIndex={0} onClick={() => setPlayerView(p.name)}>
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
                {shown.map((s, i) => (
                  <tr key={s.name} className={[i < 3 && sortKey === "points" && sortDir === -1 && !inactive.has(s.name) ? "top" : "", inactive.has(s.name) ? "rest" : ""].join(" ")}>
                    <td className="rank-col">{i + 1}</td>
                    <td className="name-col"><button className="name-btn" onClick={() => setPlayerView(s.name)}>{s.name}</button>{inactive.has(s.name) && <span className="rest-tag">미활동</span>}</td>
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
          {inactive.size > 0 && (
            <button className="link-btn" onClick={() => setShowInactive(!showInactive)}>
              {showInactive ? "미활동 멤버 숨기기" : `미활동 멤버 ${[...inactive].filter((n) => stats.some((p) => p.name === n)).length}명도 보기`}
            </button>
          )}

          <div className="manage">
            <button className="manage-toggle" onClick={() => { setManage(!manage); setSelected([]); setConfirmBulkDel(false); }} aria-expanded={manage}>
              <span>선수 명단 관리</span><span className="manage-count">활동 {activeStats.length} · 미활동 {stats.length - activeStats.length} {manage ? "▴" : "▾"}</span>
            </button>
            {manage && (() => {
              const list = [...stats].sort((x, y) => x.name.localeCompare(y.name, "ko"))
                .filter((p) => rosterFilter === "all" || (rosterFilter === "inactive") === inactive.has(p.name));
              const allOn = list.length > 0 && list.every((p) => selected.includes(p.name));
              return (
                <div className="manage-body">
                  <div className="add-player">
                    <input value={newPlayer} onChange={(e) => setNewPlayer(e.target.value)} placeholder="새 선수 이름"
                      onKeyDown={(e) => e.key === "Enter" && addPlayer()} />
                    <button onClick={addPlayer}>추가</button>
                  </div>
                  <div className="seg-mini">
                    {[["all", `전체 ${stats.length}`], ["active", `활동 ${activeStats.length}`], ["inactive", `미활동 ${stats.length - activeStats.length}`]].map(([k, l]) => (
                      <button key={k} className={rosterFilter === k ? "on" : ""} onClick={() => { setRosterFilter(k); setSelected([]); setConfirmBulkDel(false); }}>{l}</button>
                    ))}
                  </div>
                  <p className="manage-hint">선수를 체크한 뒤 아래 버튼으로 상태를 바꾸세요. 미활동 멤버는 기록이 그대로 남고, 순위표와 참석 선택에서만 숨겨져요.</p>
                  <button className="select-all" onClick={() => setSelected(allOn ? [] : list.map((p) => p.name))}>{allOn ? "선택 해제" : "모두 선택"}</button>
                  <div className="roster-rows">
                    {list.map((p) => (
                      <label className={`roster-row ${selected.includes(p.name) ? "sel" : ""}`} key={p.name}>
                        <input type="checkbox" checked={selected.includes(p.name)} onChange={() => toggleSelect(p.name)} />
                        <span className="rn">{p.name}</span>
                        {inactive.has(p.name) ? <span className="rest-tag">미활동</span> : <span className="act-tag">활동</span>}
                      </label>
                    ))}
                    {!list.length && <p className="manage-hint">해당하는 선수가 없어요.</p>}
                  </div>
                  {selected.length > 0 && (
                    <div className="bulk-bar">
                      <span className="bulk-n">{selected.length}명 선택</span>
                      {confirmBulkDel ? (
                        <>
                          <button className="danger" onClick={removeSelected}>정말 삭제</button>
                          <button onClick={() => setConfirmBulkDel(false)}>취소</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setStatus(true)}>미활동으로</button>
                          <button onClick={() => setStatus(false)}>활동으로</button>
                          <button className="danger-ghost" onClick={() => setConfirmBulkDel(true)}>삭제</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          <button className="link-btn" style={{ marginTop: 14 }} onClick={openBackups}>기록 되돌리기 (자동 백업)</button>
        </section>
      )}

      {/* ---------- 매치 입력 ---------- */}
      {tab === "input" && (
        <section className="form">
          {form.editId && (
            <div className="from-sched">지난 매치를 수정하고 있어요. 영상과 다른 정보는 그대로 유지돼요.
              <button onClick={() => { setForm(emptyForm()); setTab("log"); setMatchSeg("past"); }}>수정 취소</button></div>
          )}
          {form.scheduleId && (
            <div className="from-sched">예정 경기의 결과를 입력 중이에요. 저장하면 예정 목록에서 지난 경기로 옮겨져요.
              <button onClick={() => setForm(emptyForm())}>새 매치로</button></div>
          )}
          <div className="field-row">
            <label className="field">
              <span>날짜</span>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </label>
            <label className="field">
              <span>상대팀 (선택)</span>
              <input value={form.opponent} placeholder="예: 윤상현팀" list="opp-list" autoComplete="off" onChange={(e) => setForm({ ...form, opponent: e.target.value })} />
            </label>
          </div>
          {form.opponent.trim() && <H2H opp={form.opponent} />}

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
              <button key={n} className={[form.attendees.includes(n) ? "chip on" : "chip", inactive.has(n) ? "rest" : ""].join(" ")} onClick={() => toggleAttendee(n)}>{n}</button>
            ))}
          </div>
          {inactive.size > 0 && (
            <button className="link-btn" onClick={() => setShowInactiveInput(!showInactiveInput)}>
              {showInactiveInput ? "미활동 멤버 숨기기" : "미활동 멤버도 보기"}
            </button>
          )}

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

          <button className="save" disabled={!canSave || busy} onClick={saveMatch}>
            {busy ? "저장 중…" : !canSave ? "스코어와 참석 선수를 입력하면 저장할 수 있어요" : form.editId ? "수정 저장" : "매치 저장"}
          </button>
        </section>
      )}

      {/* ---------- 매치 기록 ---------- */}
      {tab === "log" && (
        <section>
          <div className="seg-mini" style={{ marginTop: 0, marginBottom: 12 }}>
            <button className={matchSeg === "upcoming" ? "on" : ""} onClick={() => setMatchSeg("upcoming")}>예정 경기 {schedule.length}</button>
            <button className={matchSeg === "past" ? "on" : ""} onClick={() => setMatchSeg("past")}>지난 경기 {data.matches.length}</button>
          </div>

          {matchSeg === "upcoming" && (
            <div>
              {schedForm && !schedForm.id ? (
                renderSchedForm()
              ) : (
                <button className="add-sched" onClick={() => setSchedForm(emptySched())}>+ 경기 일정 추가</button>
              )}
              {schedule.length === 0 && !schedForm && <div className="empty">예정된 경기가 없어요. 다음 경기 일정을 추가해 보세요.</div>}
              <div className="log-list">
                {schedule.map((x) => {
                  const n = dday(x.date);
                  if (schedForm && schedForm.id === x.id) return <div key={x.id}>{renderSchedForm()}</div>;
                  return (
                    <div className={`sched-card ${n < 0 ? "overdue" : ""}`} key={x.id}>
                      <div className="sc-top">
                        <span className={`dd ${n === 0 ? "today" : n < 0 ? "late" : ""}`}>{ddayLabel(n)}</span>
                        <span className="sc-date">{fmtDate(x.date)}{x.time ? ` · ${x.time}` : ""}</span>
                      </div>
                      <div className="sc-opp">{x.opponent ? `vs ${x.opponent}` : "상대 미정"}</div>
                      {(x.place || x.memo) && <div className="sc-meta">{[x.place, x.memo].filter(Boolean).join(" · ")}</div>}
                      {x.opponent && <H2H opp={x.opponent} compact />}
                      {confirmSched === x.id ? (
                        <div className="del-confirm"><span>이 일정을 삭제할까요?</span><span><button onClick={() => setConfirmSched(null)}>취소</button><button className="danger" onClick={() => deleteSchedule(x.id)}>삭제</button></span></div>
                      ) : (
                        <div className="sc-actions">
                          <button className="ghost-btn" onClick={() => setConfirmSched(x.id)}>삭제</button>
                          <button className="ghost-btn" onClick={() => { setConfirmSched(null); setSchedForm({ id: x.id, date: x.date, time: x.time || "", opponent: x.opponent || "", place: x.place || "", memo: x.memo || "" }); }}>수정</button>
                          <button className="solid-btn" onClick={() => startResult(x)}>결과 입력</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {matchSeg === "past" && (<>
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
                    <div className="log-meta">{matchSummary(m)} · {m.attendees.length}명{(m.videos || []).length > 0 && <span className="vid-badge">▶ 영상 {m.videos.length}</span>}</div>
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
                      {m.opponent && <H2H opp={m.opponent} />}

                      {/* 경기 영상 */}
                      <div className="section-label sub-title">경기 영상</div>
                      <div className="videos">
                        {(m.videos || []).map((v) => {
                          const emb = ytEmbed(v.url);
                          return (
                            <div className="video" key={v.id}>
                              {emb && playing === v.id ? (
                                <div className="player"><iframe src={emb + (emb.includes("?") ? "&" : "?") + "autoplay=1"} title={v.label || "경기 영상"} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>
                              ) : null}
                              <div className="video-row">
                                <span className="v-label">{v.label || (emb ? "유튜브 영상" : "영상 링크")}</span>
                                {emb ? (
                                  <button className="solid-btn sm" onClick={() => setPlaying(playing === v.id ? null : v.id)}>{playing === v.id ? "닫기" : "▶ 재생"}</button>
                                ) : (
                                  <a className="solid-btn sm" href={v.url} target="_blank" rel="noopener noreferrer">열기</a>
                                )}
                                {confirmVid === v.id ? (
                                  <><button className="ghost-btn sm danger-t" onClick={() => removeVideo(m.id, v.id)}>삭제</button><button className="ghost-btn sm" onClick={() => setConfirmVid(null)}>취소</button></>
                                ) : (
                                  <button className="ghost-btn sm" aria-label="영상 삭제" onClick={() => setConfirmVid(v.id)}>×</button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <div className="vid-add">
                          <input value={(vidInput[m.id] || {}).url || ""} placeholder="영상 링크 (유튜브, 드라이브 등)" onChange={(e) => setVidInput({ ...vidInput, [m.id]: { ...(vidInput[m.id] || {}), url: e.target.value } })} />
                          <input value={(vidInput[m.id] || {}).label || ""} placeholder="이름 (예: 1쿼터, 하이라이트)" onChange={(e) => setVidInput({ ...vidInput, [m.id]: { ...(vidInput[m.id] || {}), label: e.target.value } })} />
                          <button className="solid-btn" disabled={busy} onClick={() => addVideo(m.id)}>영상 추가</button>
                        </div>
                      </div>
                      
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
                        <div className="log-actions">
                          <button className="ghost-btn sm" onClick={() => startEditMatch(m)}>매치 수정</button>
                          <button className="del" onClick={() => setConfirmDel(m.id)}>매치 삭제</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </>)}
        </section>
      )}

      <datalist id="opp-list">{opponents.map((o) => <option key={o} value={o} />)}</datalist>

      {/* ---------- 선수 개인 페이지 ---------- */}
      {playerView && (() => {
        const name = playerView;
        const st = stats.find((p) => p.name === name) || { att: 0, g: 0, a: 0, mom: 0, points: 0, rate: 0, cs: 0 };
        const POSN = { referee: "심판", ST: "ST", LM: "LM", CAM: "CAM", RM: "RM", CM1: "CM", CM2: "CM", LB: "LB", CB1: "CB", CB2: "CB", RB: "RB", GK: "GK" };
        const ms = data.matches.filter((m) => (m.attendees || []).includes(name)).slice().reverse();
        let quarters = 0, refs = 0; const posCount = {};
        data.matches.forEach((m) => Object.values(m.formations || {}).forEach((q) => Object.entries(q || {}).forEach(([k, v]) => {
          if (v !== name) return;
          if (k === "referee") { refs++; return; }
          quarters++; const lab = POSN[k] || k; posCount[lab] = (posCount[lab] || 0) + 1;
        })));
        const posList = Object.entries(posCount).sort((a, b) => b[1] - a[1]);
        const vids = ms.flatMap((m) => (m.videos || []).map((v) => ({ ...v, m })));
        const appGoals = ms.reduce((t, m) => t + ((m.goals || {})[name] || 0), 0);
        const appAssists = ms.reduce((t, m) => t + ((m.assists || {})[name] || 0), 0);
        return (
          <div className="pp" role="dialog" aria-modal="true" aria-label={`${name} 선수 기록`}>
            <div className="pp-in">
              <div className="pp-top">
                <button className="pp-back" onClick={() => { setPlayerView(null); setPlaying(null); }}>← 순위표</button>
              </div>
              <div className="pp-head">
                <div className="pp-name">{name}</div>
                {inactive.has(name) ? <span className="rest-tag">미활동</span> : <span className="act-tag">활동</span>}
              </div>
              <div className="pp-grid">
                <div><b>{st.points}</b><span>공격P</span></div>
                <div><b>{st.g}</b><span>득점</span></div>
                <div><b>{st.a}</b><span>도움</span></div>
                <div><b>{st.mom}</b><span>MOM</span></div>
                <div><b>{st.att}</b><span>출석</span></div>
                <div><b>{st.rate}%</b><span>출석률</span></div>
              </div>
              <p className="note">{sheet ? "위 숫자는 팀 구글 시트 기준 통산 기록이에요." : "위 숫자는 앱에 입력된 기록으로 계산했어요."} 아래는 앱에 입력된 경기 기준이에요.</p>

              <div className="section-label sub-title">출전 쿼터</div>
              {quarters + refs === 0 ? <p className="note">전술판에 배치된 기록이 아직 없어요.</p> : (
                <div className="pp-box">
                  <div className="pp-q"><b>{quarters}</b>쿼터 출전{refs > 0 && <span> · 심판 {refs}회</span>}</div>
                  <div className="pos-bars">
                    {posList.map(([p, c]) => (
                      <div className="pos-bar" key={p}><span className="pb-l">{p}</span><span className="pb-t"><i style={{ width: `${Math.round((c / quarters) * 100)}%` }} /></span><span className="pb-n">{c}</span></div>
                    ))}
                  </div>
                </div>
              )}

              <div className="section-label sub-title">참석한 경기 <span className="sub">{ms.length}경기 · 앱 기록 {appGoals}골 {appAssists}도움</span></div>
              {ms.length === 0 ? <p className="note">앱에 입력된 참석 경기가 없어요.</p> : (
                <div className="pp-list">
                  {ms.map((m) => {
                    const g = (m.goals || {})[name] || 0, a = (m.assists || {})[name] || 0;
                    const qn = Object.values(m.formations || {}).filter((q) => Object.entries(q || {}).some(([k, v]) => k !== "referee" && v === name)).length;
                    return (
                      <div className="pp-row" key={m.id}>
                        <div className="pp-row-top"><span className="log-date">{fmtDate(m.date)}</span>{m.opponent && <span className="opp">vs {m.opponent}</span>}</div>
                        <div className="games-line">{validGames(m).map(gameBadge)}</div>
                        <div className="pp-row-meta">
                          {g > 0 && <span>⚽ {g}골</span>}{a > 0 && <span>🅰 {a}도움</span>}{m.mom === name && <span className="mom-t">★ MOM</span>}
                          {qn > 0 && <span>{qn}쿼터</span>}{g + a === 0 && m.mom !== name && qn === 0 && <span className="dim-t">출석</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {vids.length > 0 && (<>
                <div className="section-label sub-title">나온 경기 영상 <span className="sub">{vids.length}개</span></div>
                <div className="videos">
                  {vids.map((v) => {
                    const emb = ytEmbed(v.url);
                    return (
                      <div className="video" key={v.id}>
                        {emb && playing === v.id && <div className="player"><iframe src={emb + (emb.includes("?") ? "&" : "?") + "autoplay=1"} title={v.label || "경기 영상"} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>}
                        <div className="video-row">
                          <span className="v-label">{fmtDate(v.m.date)} · {v.label || "영상"}</span>
                          {emb ? <button className="solid-btn sm" onClick={() => setPlaying(playing === v.id ? null : v.id)}>{playing === v.id ? "닫기" : "▶ 재생"}</button>
                               : <a className="solid-btn sm" href={v.url} target="_blank" rel="noopener noreferrer">열기</a>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>)}
            </div>
          </div>
        );
      })()}

      {/* ---------- 되돌리기 ---------- */}
      {backups && (
        <div className="pp" role="dialog" aria-modal="true" aria-label="기록 되돌리기">
          <div className="pp-in">
            <div className="pp-top"><button className="pp-back" onClick={() => setBackups(null)}>← 닫기</button></div>
            <div className="pp-name" style={{ marginTop: 6 }}>기록 되돌리기</div>
            <p className="note">기록이 바뀔 때마다 바로 전 상태가 자동으로 저장돼요(최근 300개). 실수로 지웠다면 지우기 전 시점을 골라 되돌리세요. 관리자 PIN이 필요해요.</p>
            <div className="pp-list">
              {backups.map((b) => {
                const c = b.content || {};
                const t = new Date(b.saved_at);
                return (
                  <div className="pp-row" key={b.id}>
                    <div className="pp-row-top"><span className="log-date">{t.getMonth() + 1}월 {t.getDate()}일 {String(t.getHours()).padStart(2, "0")}:{String(t.getMinutes()).padStart(2, "0")}</span></div>
                    <div className="pp-row-meta"><span>매치 {(c.matches || []).length}</span><span>일정 {(c.schedule || []).length}</span><span>명단 {(c.players || []).length}</span></div>
                    <button className="ghost-btn sm" style={{ marginTop: 8 }} disabled={busy} onClick={() => restoreBackup(b)}>이 시점으로 되돌리기</button>
                  </div>
                );
              })}
              {!backups.length && <p className="note">아직 백업이 없어요.</p>}
            </div>
          </div>
        </div>
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
.manage { margin-top: 18px; background: var(--card); border: 1px solid var(--line); border-radius: var(--r); overflow: hidden; }
.manage-toggle { width: 100%; display: flex; justify-content: space-between; align-items: center; border: 0; background: none; padding: 14px; font-size: 15px; font-weight: 700; }
.manage-count { font-size: 13px; font-weight: 500; color: var(--ink-2); }
.manage-body { padding: 0 14px 14px; border-top: 1px solid var(--line-2); }
.manage-hint { font-size: 12.5px; color: var(--ink-2); margin: 10px 0; line-height: 1.5; }
.name-btn { border: 0; background: none; padding: 0; font: inherit; font-weight: 600; color: inherit; text-decoration: underline; text-decoration-color: var(--line); text-underline-offset: 3px; cursor: pointer; }
.pod { cursor: pointer; }
.log-actions { display: flex; align-items: center; gap: 12px; margin-top: 14px; }
.log-actions .del { margin-top: 0; }
button:disabled { opacity: .55; cursor: default; }
.pp { position: fixed; inset: 0; z-index: 30; background: var(--chalk); overflow-y: auto; -webkit-overflow-scrolling: touch; }
.pp-in { max-width: 760px; margin: 0 auto; padding: calc(env(safe-area-inset-top, 0px) + 10px) 16px calc(env(safe-area-inset-bottom, 0px) + 40px); }
.pp-top { position: sticky; top: 0; background: var(--chalk); padding: 6px 0; z-index: 1; }
.pp-back { border: 0; background: none; font-size: 14.5px; font-weight: 600; color: var(--grass); padding: 6px 0; }
.pp-head { display: flex; align-items: center; gap: 4px; margin-top: 4px; }
.pp-name { font-size: 28px; font-weight: 800; letter-spacing: -0.03em; }
.pp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 14px; }
.pp-grid div { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; }
.pp-grid b { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; }
.pp-grid span { font-size: 12px; color: var(--ink-2); margin-top: 2px; }
.pp-box { background: var(--card); border: 1px solid var(--line); border-radius: var(--r); padding: 12px 14px; }
.pp-q { font-size: 14px; color: var(--ink-2); }
.pp-q b { font-size: 22px; color: var(--ink); margin-right: 3px; }
.pos-bars { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
.pos-bar { display: grid; grid-template-columns: 44px 1fr 24px; align-items: center; gap: 8px; font-size: 13px; }
.pb-l { font-weight: 700; color: var(--ink-2); }
.pb-t { height: 8px; background: var(--line-2); border-radius: 4px; overflow: hidden; }
.pb-t i { display: block; height: 100%; background: var(--grass); border-radius: 4px; }
.pb-n { text-align: right; font-weight: 700; }
.pp-list { display: flex; flex-direction: column; gap: 8px; }
.pp-row { background: var(--card); border: 1px solid var(--line); border-radius: var(--r); padding: 12px 14px; }
.pp-row-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.pp-row-meta { display: flex; flex-wrap: wrap; gap: 10px; font-size: 13px; margin-top: 8px; color: var(--ink); font-weight: 600; }
.mom-t { color: var(--gold); }
.dim-t { color: var(--ink-3); font-weight: 500; }
.h2h { margin-top: 10px; background: var(--chalk); border-radius: 10px; padding: 10px 12px; }
.h2h.first { font-size: 13px; color: var(--ink-2); }
.h2h-top { display: flex; justify-content: space-between; font-size: 12.5px; color: var(--ink-2); }
.h2h-top b { color: var(--ink); }
.h2h-rec { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.h2h-rec .w, .h2h-rec .d, .h2h-rec .l { font-size: 17px; font-weight: 800; }
.h2h-rec .w { color: var(--win); } .h2h-rec .d { color: var(--draw); } .h2h-rec .l { color: var(--loss); }
.h2h-rec .sub { font-size: 12.5px; color: var(--ink-2); margin-left: 4px; }
.h2h-last { font-size: 12.5px; color: var(--ink-3); margin-top: 2px; }
.vid-badge { margin-left: 8px; font-size: 11.5px; font-weight: 700; color: var(--loss); }
.videos { display: flex; flex-direction: column; gap: 8px; }
.video { background: var(--chalk); border-radius: 10px; overflow: hidden; }
.player { position: relative; width: 100%; aspect-ratio: 16 / 9; background: #000; }
.player iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.video-row { display: flex; align-items: center; gap: 6px; padding: 8px 10px; }
.v-label { flex: 1; font-size: 14px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.solid-btn.sm, .ghost-btn.sm { padding: 6px 10px; font-size: 12.5px; border-radius: 8px; text-decoration: none; }
.danger-t { color: var(--loss) !important; }
.vid-add { display: flex; flex-direction: column; gap: 6px; margin-top: 2px; }
.vid-add input { padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); font-size: 14.5px; }
.next-match { display: flex; align-items: center; gap: 10px; width: 100%; margin-top: 14px; padding: 10px 12px; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.06); border-radius: 12px; color: #fff; text-align: left; }
.nm-d { flex: none; font-size: 12px; font-weight: 800; background: var(--gold); color: var(--pitch); padding: 3px 8px; border-radius: 6px; }
.nm-t { font-size: 13.5px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.add-sched { width: 100%; padding: 13px; border: 1px dashed var(--line); border-radius: var(--r); background: var(--card); color: var(--grass); font-weight: 700; font-size: 14.5px; margin-bottom: 10px; }
.sched-form { background: var(--card); border: 1px solid var(--line); border-radius: var(--r); padding: 14px; margin-bottom: 10px; display: flex; flex-direction: column; gap: 8px; }
.sched-actions, .sc-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px; }
.solid-btn { border: 0; border-radius: 10px; padding: 10px 14px; background: var(--pitch); color: #fff; font-weight: 700; font-size: 14px; }
.ghost-btn { border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; background: var(--card); color: var(--ink-2); font-weight: 600; font-size: 14px; }
.sched-card { background: var(--card); border: 1px solid var(--line); border-radius: var(--r); padding: 14px; }
.sched-card.overdue { border-color: var(--gold); }
.sc-top { display: flex; align-items: center; gap: 8px; }
.dd { font-size: 12px; font-weight: 800; padding: 3px 8px; border-radius: 6px; background: var(--line-2); color: var(--ink-2); }
.dd.today { background: var(--pitch); color: #fff; }
.dd.late { background: var(--gold-soft); color: #8A6A10; }
.sc-date { font-size: 13.5px; font-weight: 600; color: var(--ink-2); }
.sc-opp { font-size: 18px; font-weight: 800; margin-top: 6px; letter-spacing: -0.02em; }
.sc-meta { font-size: 13.5px; color: var(--ink-2); margin-top: 2px; }
.from-sched { background: var(--gold-soft); border-radius: 12px; padding: 12px 14px; font-size: 13.5px; line-height: 1.5; margin-bottom: 14px; display: flex; gap: 10px; align-items: center; justify-content: space-between; }
.from-sched button { flex: none; border: 0; background: var(--card); border-radius: 8px; padding: 6px 10px; font-size: 12.5px; font-weight: 600; }
.seg-mini { display: flex; gap: 4px; background: var(--line-2); padding: 3px; border-radius: 10px; margin-top: 12px; }
.seg-mini button { flex: 1; border: 0; background: none; padding: 7px 0; border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--ink-2); }
.seg-mini button.on { background: var(--card); color: var(--ink); box-shadow: 0 1px 2px rgba(20,33,27,.1); }
.select-all { border: 0; background: none; color: var(--grass); font-size: 13px; font-weight: 600; padding: 2px 0 6px; }
.roster-rows { display: flex; flex-direction: column; }
.roster-row { display: flex; align-items: center; gap: 12px; padding: 10px 4px; border-bottom: 1px solid var(--line-2); cursor: pointer; }
.roster-row:last-child { border-bottom: 0; }
.roster-row input { width: 20px; height: 20px; accent-color: var(--pitch); margin: 0; flex: none; }
.roster-row .rn { flex: 1; font-size: 15px; font-weight: 600; }
.roster-row.sel { background: var(--chalk); border-radius: 8px; }
.act-tag, .rest-tag { font-size: 11.5px; font-weight: 700; padding: 2px 7px; border-radius: 6px; margin-left: 6px; }
.act-tag { background: var(--win-soft); color: var(--win); }
.rest-tag { background: var(--draw-soft); color: var(--draw); }
tr.rest td { color: var(--ink-3); }
tr.rest .name-col { color: var(--ink-2); }
.chip.rest { border-style: dashed; }
.link-btn { border: 0; background: none; color: var(--grass); font-size: 13px; font-weight: 600; padding: 8px 2px 0; }
.bulk-bar { position: sticky; bottom: calc(env(safe-area-inset-bottom, 0px) + 10px); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 12px; background: var(--ink); color: #fff; padding: 10px 10px 10px 14px; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,.2); }
.bulk-n { font-size: 13.5px; font-weight: 700; margin-right: auto; }
.bulk-bar button { border: 0; border-radius: 8px; padding: 7px 10px; font-size: 13px; font-weight: 600; background: rgba(255,255,255,.14); color: #fff; }
.bulk-bar .danger { background: var(--loss); }
.bulk-bar .danger-ghost { color: #F3A79F; }
.roster-list { display: flex; flex-wrap: wrap; gap: 6px; }
.roster-item { display: inline-flex; align-items: center; gap: 2px; padding: 4px 4px 4px 12px; border: 1px solid var(--line); border-radius: 999px; font-size: 14px; background: var(--chalk); }
.roster-item .x { border: 0; background: none; width: 28px; height: 28px; border-radius: 50%; color: var(--ink-3); font-size: 17px; line-height: 1; }
.roster-item .x:active { background: var(--line); }
.roster-item.confirm { background: var(--loss-soft); border-color: var(--loss-soft); gap: 6px; padding-right: 6px; }
.roster-item.confirm button { border: 0; border-radius: 999px; padding: 4px 10px; font-size: 12.5px; font-weight: 600; background: var(--card); }
.roster-item.confirm .yes { background: var(--loss); color: #fff; }
.add-player { display: flex; gap: 8px; margin-top: 12px; }
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
