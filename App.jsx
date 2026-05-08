import { useState, useEffect, useRef } from "react";

const COLORS = ['crimson', 'cobalt', 'jade', 'amber'];
const COL = {
  crimson: { bg: '#DC2626', grad: 'linear-gradient(160deg,#DC2626,#EF4444)', t: '#fff', name: 'CRIMSON' },
  cobalt:  { bg: '#1D4ED8', grad: 'linear-gradient(160deg,#1D4ED8,#60A5FA)', t: '#fff', name: 'COBALT'  },
  jade:    { bg: '#16A34A', grad: 'linear-gradient(160deg,#16A34A,#4ADE80)', t: '#fff', name: 'JADE'    },
  amber:   { bg: '#D97706', grad: 'linear-gradient(160deg,#D97706,#FBBF24)', t: '#fff', name: 'AMBER'   },
};
const SP = {
  echo_blast: { n: 'ECHO BLAST', e: '💥', d: 'Next player draws 2', c: '#7C3AED' },
  silence:    { n: 'SILENCE',    e: '🤫', d: 'Echo-proof this turn', c: '#374151' },
  ripple:     { n: 'RIPPLE',     e: '🌊', d: 'All others draw 1',   c: '#0284C7' },
  dark_echo:  { n: 'DARK ECHO',  e: '🌑', d: 'Next player draws 3', c: '#0F172A' },
  wild:       { n: 'WILD',       e: '🎨', d: 'Change active color', c: '#6D28D9' },
  storm:      { n: 'STORM',      e: '⚡', d: 'Everyone draws 1',    c: '#92400E' },
  skip_echo:  { n: 'SKIP ECHO',  e: '🚫', d: 'Skip next player',    c: '#B91C1C' },
};

function mkDeck() {
  let id = 0; const c = [];
  COLORS.forEach(col => {
    for (let n = 1; n <= 9; n++) {
      c.push({ id: id++, t: 'n', col, n });
      c.push({ id: id++, t: 'n', col, n });
    }
  });
  [['echo_blast',8],['silence',6],['ripple',6],['dark_echo',4],['wild',4],['storm',4],['skip_echo',4]]
    .forEach(([sp, cnt]) => { for (let i = 0; i < cnt; i++) c.push({ id: id++, t: 's', col: 's', sp }); });
  return sfl(c);
}
function sfl(a) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = 0 | Math.random() * (i + 1);
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
function nxt(cur, dir, n) { return ((cur + dir) % n + n) % n; }
function canPlay(c, top, acol) {
  if (c.t === 's') return true;
  return c.col === acol || (top?.t === 'n' && c.n === top.n);
}
function drawN(state, pidx, count) {
  let { deck, discard, players } = state;
  deck = [...deck]; players = players.map(p => ({ ...p, hand: [...p.hand] }));
  for (let i = 0; i < count; i++) {
    if (!deck.length) {
      const top = discard[discard.length - 1];
      deck = sfl(discard.slice(0, -1));
      discard = [top];
    }
    if (deck.length) players[pidx].hand.push(deck.shift());
  }
  return { ...state, deck, discard, players };
}
function initGame(bots) {
  const total = bots + 1;
  const raw = mkDeck();
  const d = [...raw];
  const players = [];
  for (let i = 0; i < total; i++) {
    players.push({ id: i, name: i === 0 ? 'You' : `Bot ${i}`, hand: d.splice(0, 7), isBot: i > 0, wins: 0 });
  }
  let top; do { top = d.shift(); } while (top.t === 's');
  return {
    players, deck: d, discard: [top],
    acol: top.col, cur: 0, dir: 1,
    phase: 'human',
    echoNum: null, echoFrom: null,
    scores: Array(total).fill(0),
    msg: "Your turn! Match color or number to play.",
    round: 1,
  };
}

function CardEl({ card, onClick, glow, small = false, back = false, dim = false }) {
  const w = small ? 40 : 62, h = small ? 58 : 88;
  const base = {
    width: w, height: h, borderRadius: 8, flexShrink: 0,
    cursor: onClick ? 'pointer' : 'default',
    boxShadow: glow ? '0 0 16px rgba(255,255,255,0.55), 2px 2px 0 #000' : '2px 2px 0 #000',
    border: glow ? '2.5px solid #fff' : '2px solid rgba(255,255,255,0.1)',
    transform: (glow && onClick) ? 'translateY(-7px) scale(1.07)' : 'none',
    transition: 'transform .13s, box-shadow .13s',
    opacity: dim ? 0.38 : 1,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    userSelect: 'none', position: 'relative', overflow: 'hidden',
  };
  if (back) return (
    <div style={{ ...base, background: 'linear-gradient(135deg,#1e1b4b,#312e81)', border: '2px solid #4338ca44' }} onClick={onClick}>
      <div style={{ fontSize: small ? 10 : 14, opacity: 0.4 }}>⚡</div>
    </div>
  );
  if (card.t === 'n') {
    const col = COL[card.col];
    return (
      <div style={{ ...base, background: col.grad }} onClick={onClick}>
        <div style={{ position: 'absolute', top: 3, left: 5, fontSize: 8, color: col.t, opacity: 0.75, fontWeight: 900 }}>{card.col[0].toUpperCase()}</div>
        <div style={{ fontSize: small ? 20 : 30, fontWeight: 900, color: col.t, fontFamily: 'Georgia,serif', lineHeight: 1 }}>{card.n}</div>
        <div style={{ position: 'absolute', bottom: 3, right: 5, fontSize: 8, color: col.t, opacity: 0.75, fontWeight: 900, transform: 'rotate(180deg)' }}>{card.col[0].toUpperCase()}</div>
      </div>
    );
  }
  const sp = SP[card.sp];
  const bg = card.sp === 'wild'
    ? 'linear-gradient(135deg,#DC2626 0%,#1D4ED8 33%,#16A34A 66%,#D97706 100%)'
    : sp.c;
  return (
    <div style={{ ...base, background: bg }} onClick={onClick}>
      <div style={{ fontSize: small ? 14 : 20 }}>{sp.e}</div>
      {!small && <div style={{ fontSize: 6.5, color: '#fff', fontWeight: 900, textAlign: 'center', padding: '0 3px', lineHeight: 1.2, marginTop: 2 }}>{sp.n}</div>}
    </div>
  );
}

function Tip({ card }) {
  if (!card || card.t !== 's') return null;
  const sp = SP[card.sp];
  return (
    <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6, background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, padding: '6px 10px', fontSize: 11, color: '#fff', whiteSpace: 'nowrap', zIndex: 50, pointerEvents: 'none' }}>
      <strong>{sp.n}</strong>: {sp.d}
    </div>
  );
}

function CardWithTip({ card, onClick, glow, small, back, dim }) {
  const [hover, setHover] = useState(false);
  return (
    <div style={{ position: 'relative' }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {hover && !back && <Tip card={card} />}
      <CardEl card={card} onClick={onClick} glow={glow} small={small} back={back} dim={dim} />
    </div>
  );
}

function Menu({ bots, setBots, onStart }) {
  const [hovered, setHovered] = useState(null);
  const rules = [
    ['Match', 'Play a card matching color or number'],
    ['ECHO!', 'Slam your matching number when anyone plays it'],
    ['Win', 'First to empty their hand wins the round'],
    ['3 wins', 'First to 3 round wins, wins the game'],
  ];
  return (
    <div style={{ minHeight: '100vh', background: '#080810', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, padding: '32px 24px', fontFamily: "'Trebuchet MS',sans-serif", overflowY: 'auto' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 10, letterSpacing: 6, color: '#E63946', fontWeight: 900, marginBottom: 8 }}>✦ ORIGINAL CARD GAME ✦</div>
        <h1 style={{ fontSize: 'clamp(72px,22vw,120px)', fontWeight: 900, margin: '0 0 4px', letterSpacing: '-4px', lineHeight: 0.9, background: 'linear-gradient(135deg,#fff 0%,#E63946 45%,#60A5FA 80%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>ECHO</h1>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: 4, fontWeight: 700 }}>PLAY IT · MATCH IT · SLAM IT</div>
      </div>
      <div style={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 16, padding: 24, width: '100%', maxWidth: 320 }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: 'rgba(255,255,255,.3)', fontWeight: 900, marginBottom: 14 }}>OPPONENTS</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
          {[1, 2, 3, 4].map(n => (
            <button key={n} onClick={() => setBots(n)}
              onMouseEnter={() => setHovered(n)} onMouseLeave={() => setHovered(null)}
              style={{ flex: 1, padding: '12px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 18, fontFamily: 'inherit', background: bots === n ? '#E63946' : hovered === n ? '#1a1a2e' : '#111', color: bots === n ? '#fff' : 'rgba(255,255,255,.5)', transition: 'all .15s' }}>
              {n}
            </button>
          ))}
        </div>
        <button onClick={onStart} style={{ width: '100%', padding: '15px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#E63946,#c1121f)', color: '#fff', fontWeight: 900, fontSize: 17, letterSpacing: 2, fontFamily: 'inherit', boxShadow: '0 4px 24px rgba(230,57,70,0.45)' }}>
          PLAY NOW ⚡
        </button>
      </div>
      <div style={{ width: '100%', maxWidth: 320 }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: 'rgba(255,255,255,.25)', fontWeight: 900, marginBottom: 12 }}>HOW TO PLAY</div>
        {rules.map(([title, desc]) => (
          <div key={title} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
            <div style={{ minWidth: 50, fontWeight: 900, fontSize: 11, color: '#E63946', letterSpacing: 1 }}>{title}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>
      <div style={{ width: '100%', maxWidth: 320 }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: 'rgba(255,255,255,.25)', fontWeight: 900, marginBottom: 12 }}>SPECIAL CARDS</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {Object.entries(SP).map(([k, v]) => (
            <div key={k} style={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 8, padding: '8px 10px', display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ fontSize: 16 }}>{v.e}</div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 900, color: 'rgba(255,255,255,.6)', letterSpacing: 1 }}>{v.n}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,.3)' }}>{v.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState('menu');
  const [bots, setBots] = useState(2);
  const [G, setG] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const echoTimerRef = useRef(null);
  const cdIntervalRef = useRef(null);
  const prevEchoKeyRef = useRef(null);

  function applyFx(state, card, byIdx) {
    let s = { ...state };
    const n = s.players.length;
    s.discard = [...s.discard, card];
    s.players = s.players.map((p, i) =>
      i === byIdx ? { ...p, hand: p.hand.filter(c => c.id !== card.id) } : { ...p, hand: [...p.hand] }
    );
    if (card.t === 'n') s.acol = card.col;
    const ni = nxt(byIdx, s.dir, n);
    if (s.players[byIdx].hand.length === 0) {
      s.scores = [...s.scores]; s.scores[byIdx] += 3;
      s.players = s.players.map((p, i) => i === byIdx ? { ...p, wins: p.wins + 1 } : p);
      s.phase = 'round_end';
      s.msg = `${s.players[byIdx].name} plays their last card! 🎉`;
      return s;
    }
    if (card.t === 's') {
      switch (card.sp) {
        case 'echo_blast': s = drawN(s, ni, 2); s.msg = `💥 ECHO BLAST! ${s.players[ni].name} draws 2!`; break;
        case 'ripple': for (let i = 0; i < n; i++) if (i !== byIdx) s = drawN(s, i, 1); s.msg = '🌊 RIPPLE! All others draw 1!'; break;
        case 'dark_echo': s = drawN(s, ni, 3); s.msg = `🌑 DARK ECHO! ${s.players[ni].name} draws 3!`; break;
        case 'storm': for (let i = 0; i < n; i++) s = drawN(s, i, 1); s.msg = '⚡ STORM! Everyone draws 1!'; break;
        default: break;
      }
    }
    let nextI = ni;
    if (card.t === 's' && card.sp === 'skip_echo') {
      nextI = nxt(ni, s.dir, n);
      s.msg = `🚫 ${s.players[ni].name} is SKIPPED!`;
    }
    s.cur = nextI;
    return s;
  }

  function routeAfterPlay(s, card, byIdx) {
    if (s.phase === 'round_end') return s;
    if (card.t === 's' && card.sp === 'wild') {
      if (byIdx === 0) { s.phase = 'wild'; return s; }
      s.acol = COLORS[0 | Math.random() * 4];
      s.msg = `${s.players[byIdx].name} picked ${s.acol.toUpperCase()}!`;
    }
    if (card.t === 'n') {
      const humanCanEcho = byIdx !== 0 && s.players[0].hand.some(c => c.t === 'n' && c.n === card.n);
      const anyAICanEcho = s.players.some((p, i) => i !== byIdx && p.isBot && p.hand.some(c => c.t === 'n' && c.n === card.n));
      if (humanCanEcho) {
        s.phase = 'echo_human'; s.echoNum = card.n; s.echoFrom = byIdx;
        s.msg = `You have a ${card.n}! Hit ECHO! before time runs out!`;
        return s;
      }
      if (anyAICanEcho) {
        s.phase = 'echo_ai'; s.echoNum = card.n; s.echoFrom = byIdx;
        return s;
      }
    }
    s.phase = s.cur === 0 ? 'human' : 'ai';
    if (s.phase === 'human') s.msg = 'Your turn!';
    return s;
  }

  function startGame() { setG(initGame(bots)); setScreen('game'); }

  function humanPlay(card) {
    if (!G) return;
    if (G.phase === 'echo_human') {
      if (card.t !== 'n' || card.n !== G.echoNum) return;
      clearTimeout(echoTimerRef.current);
      clearInterval(cdIntervalRef.current);
      setCountdown(0);
      let s = drawN(G, G.echoFrom, 1);
      s.msg = `ECHO! 💥 ${G.players[G.echoFrom].name} draws 1.`;
      s = applyFx(s, card, 0);
      s = routeAfterPlay(s, card, 0);
      setG(s); return;
    }
    if (G.phase !== 'human' || G.cur !== 0) return;
    const top = G.discard[G.discard.length - 1];
    if (!canPlay(card, top, G.acol)) return;
    if (card.t === 's' && card.sp === 'wild') {
      let s = { ...G };
      s.discard = [...s.discard, card];
      s.players = s.players.map((p, i) => i === 0 ? { ...p, hand: p.hand.filter(c => c.id !== card.id) } : { ...p });
      if (s.players[0].hand.length === 0) {
        s.scores = [...s.scores]; s.scores[0] += 3;
        s.players = s.players.map((p, i) => i === 0 ? { ...p, wins: p.wins + 1 } : p);
        s.phase = 'round_end'; s.msg = 'You win the round! 🎉';
      } else { s.phase = 'wild'; }
      setG(s); return;
    }
    let s = applyFx(G, card, 0);
    s = routeAfterPlay(s, card, 0);
    setG(s);
  }

  function humanDraw() {
    if (!G || G.phase !== 'human' || G.cur !== 0) return;
    let s = drawN(G, 0, 1);
    const drawn = s.players[0].hand[s.players[0].hand.length - 1];
    const top = s.discard[s.discard.length - 1];
    if (!canPlay(drawn, top, s.acol)) {
      const ni = nxt(0, s.dir, s.players.length);
      s.cur = ni; s.phase = ni === 0 ? 'human' : 'ai';
      s.msg = `Drew a card. ${s.players[ni].name}'s turn.`;
    } else {
      s.msg = 'Drew a playable card — play it!';
    }
    setG(s);
  }

  function pickColor(col) {
    setG(prev => {
      if (!prev) return prev;
      let s = { ...prev, acol: col };
      const ni = nxt(prev.cur, prev.dir, prev.players.length);
      s.cur = ni; s.phase = ni === 0 ? 'human' : 'ai';
      s.msg = `Color → ${col.toUpperCase()}! ${s.players[ni].name}'s turn.`;
      return s;
    });
  }

  function newRound() {
    setG(prev => {
      if (!prev) return prev;
      if (prev.players.some(p => p.wins >= 3)) {
        const winner = prev.players.reduce((a, b) => a.wins > b.wins ? a : b);
        return { ...prev, phase: 'game_over', msg: `${winner.name} wins the game! 🏆` };
      }
      const d = [...mkDeck()];
      const players = prev.players.map(p => ({ ...p, hand: d.splice(0, 7) }));
      let top; do { top = d.shift(); } while (top.t === 's');
      return { ...prev, players, deck: d, discard: [top], acol: top.col, cur: 0, dir: 1, phase: 'human', echoNum: null, echoFrom: null, msg: 'New round! Your turn.', round: prev.round + 1 };
    });
  }

  // Echo countdown
  useEffect(() => {
    if (G?.phase !== 'echo_human') return;
    const key = `${G.echoNum}-${G.echoFrom}`;
    if (prevEchoKeyRef.current === key) return;
    prevEchoKeyRef.current = key;
    setCountdown(25);
    clearInterval(cdIntervalRef.current);
    clearTimeout(echoTimerRef.current);
    cdIntervalRef.current = setInterval(() => {
      setCountdown(p => { if (p <= 1) { clearInterval(cdIntervalRef.current); return 0; } return p - 1; });
    }, 100);
    echoTimerRef.current = setTimeout(() => {
      clearInterval(cdIntervalRef.current); setCountdown(0);
      prevEchoKeyRef.current = null;
      setG(prev => prev?.phase === 'echo_human' ? { ...prev, phase: 'echo_ai' } : prev);
    }, 2500);
    return () => { clearTimeout(echoTimerRef.current); clearInterval(cdIntervalRef.current); };
  }, [G?.phase === 'echo_human' ? `${G?.echoNum}-${G?.echoFrom}` : null]);

  // AI turn
  useEffect(() => {
    if (!G || G.phase !== 'ai') return;
    const t = setTimeout(() => {
      setG(prev => {
        if (!prev || prev.phase !== 'ai') return prev;
        const { cur, players, discard, acol, dir } = prev;
        const top = discard[discard.length - 1];
        const hand = players[cur].hand;
        const playable = hand.filter(c => canPlay(c, top, acol));
        if (!playable.length) {
          let s = drawN(prev, cur, 1);
          const ni = nxt(cur, dir, players.length);
          s.cur = ni; s.phase = ni === 0 ? 'human' : 'ai';
          s.msg = `${players[cur].name} draws a card.`;
          return s;
        }
        let card;
        if (hand.length <= 3) {
          const atk = playable.filter(c => ['skip_echo','echo_blast','dark_echo'].includes(c.sp));
          if (atk.length) card = atk[0];
        }
        if (!card) {
          const nums = playable.filter(c => c.t === 'n');
          card = nums.length ? nums[0 | Math.random() * nums.length] : playable[0 | Math.random() * playable.length];
        }
        if (card.t === 's' && card.sp === 'wild') {
          let s = applyFx(prev, card, cur);
          if (s.phase === 'round_end') return s;
          s.acol = COLORS[0 | Math.random() * 4];
          const ni = nxt(cur, s.dir, players.length);
          s.cur = ni; s.phase = ni === 0 ? 'human' : 'ai';
          s.msg = `${players[cur].name} plays WILD → ${s.acol.toUpperCase()}!`;
          return s;
        }
        let s = applyFx(prev, card, cur);
        s = routeAfterPlay(s, card, cur);
        if (s.phase !== 'round_end') s.msg = `${players[cur].name} played ${card.t === 'n' ? `${card.n} (${card.col})` : `${SP[card.sp].n} ${SP[card.sp].e}`}`;
        return s;
      });
    }, 700 + Math.random() * 500);
    return () => clearTimeout(t);
  }, [G?.phase, G?.cur]);

  // AI echo
  useEffect(() => {
    if (!G || G.phase !== 'echo_ai') return;
    const t = setTimeout(() => {
      setG(prev => {
        if (!prev || prev.phase !== 'echo_ai') return prev;
        const { players, echoNum, echoFrom } = prev;
        const eligible = players.filter((p, i) => i !== echoFrom && p.isBot && p.hand.some(c => c.t === 'n' && c.n === echoNum));
        if (eligible.length && Math.random() < 0.38) {
          const echoer = eligible[0 | Math.random() * eligible.length];
          const card = echoer.hand.find(c => c.t === 'n' && c.n === echoNum);
          let s = drawN(prev, echoFrom, 1);
          s.msg = `${echoer.name} ECHO'd! 💥`;
          s = applyFx(s, card, echoer.id);
          s = routeAfterPlay(s, card, echoer.id);
          return s;
        }
        const ni = prev.cur;
        return { ...prev, phase: ni === 0 ? 'human' : 'ai', echoNum: null, echoFrom: null, msg: ni === 0 ? 'Your turn!' : `${prev.players[ni]?.name}'s turn` };
      });
    }, 400);
    return () => clearTimeout(t);
  }, [G?.phase, G?.echoNum]);

  if (screen === 'menu') return <Menu bots={bots} setBots={setBots} onStart={startGame} />;
  if (!G) return null;

  const top = G.discard[G.discard.length - 1];
  const humanHand = G.players[0].hand;
  const isHumanTurn = G.phase === 'human' && G.cur === 0;
  const canEchoNow = G.phase === 'echo_human' && humanHand.some(c => c.t === 'n' && c.n === G.echoNum);
  const echoCards = G.phase === 'echo_human' ? humanHand.filter(c => c.t === 'n' && c.n === G.echoNum) : [];
  const colStyle = COL[G.acol] || { bg: '#374151', name: 'WILD' };

  return (
    <div style={{ minHeight: '100vh', background: '#080810', display: 'flex', flexDirection: 'column', fontFamily: "'Trebuchet MS', sans-serif", maxWidth: 600, margin: '0 auto', position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#0d0d1a', borderBottom: '1px solid #1a1a2e' }}>
        <div style={{ fontWeight: 900, fontSize: 22, background: 'linear-gradient(135deg,#fff,#E63946)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>ECHO⚡</div>
        <div style={{ display: 'flex', gap: 16 }}>
          {G.players.map((p, i) => (
            <div key={i} style={{ textAlign: 'center', opacity: G.cur === i ? 1 : 0.4 }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', fontWeight: 700 }}>{p.name.toUpperCase()}</div>
              <div style={{ fontSize: 12, fontWeight: 900, color: G.cur === i ? '#E63946' : '#fff' }}>{p.wins}W · {G.scores[i]}pt</div>
            </div>
          ))}
        </div>
        <button onClick={() => setScreen('menu')} style={{ background: 'transparent', border: '1px solid #333', color: 'rgba(255,255,255,.3)', cursor: 'pointer', borderRadius: 6, padding: '4px 8px', fontSize: 10, fontFamily: 'inherit' }}>MENU</button>
      </div>

      {/* Bot hands */}
      <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {G.players.filter(p => p.isBot).map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 10, background: G.cur === p.id ? 'rgba(230,57,70,0.1)' : '#0d0d1a', border: G.cur === p.id ? '1px solid rgba(230,57,70,0.35)' : '1px solid #1a1a2e' }}>
            <div style={{ minWidth: 60 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: G.cur === p.id ? '#E63946' : 'rgba(255,255,255,.5)' }}>{p.name} {G.cur === p.id ? '▶' : ''}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)' }}>{p.hand.length} cards</div>
            </div>
            <div style={{ display: 'flex', gap: 3, overflow: 'hidden', flex: 1, justifyContent: 'flex-end' }}>
              {p.hand.slice(0, 9).map(c => <CardEl key={c.id} card={c} back small />)}
              {p.hand.length > 9 && <div style={{ width: 40, height: 58, borderRadius: 8, background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'rgba(255,255,255,.3)', fontWeight: 900 }}>+{p.hand.length - 9}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Color strip */}
      <div style={{ height: 3, background: colStyle.bg, margin: '0 16px', borderRadius: 2, boxShadow: `0 0 10px ${colStyle.bg}` }} />

      {/* Game center */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24, padding: '14px 24px' }}>
        <div style={{ textAlign: 'center' }}>
          <CardEl card={{ t: 's', sp: 'wild' }} back onClick={isHumanTurn ? humanDraw : undefined} />
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,.25)', marginTop: 4, fontWeight: 700 }}>{G.deck.length} LEFT</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <CardEl card={top} />
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,.25)', marginTop: 4, fontWeight: 700 }}>PILE</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: colStyle.bg, border: '3px solid rgba(255,255,255,0.15)', boxShadow: `0 0 20px ${colStyle.bg}99`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,.7)', fontWeight: 900 }}>{colStyle.name}</div>
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,.25)', marginTop: 4, fontWeight: 700 }}>ACTIVE</div>
        </div>
      </div>

      {/* Message */}
      <div style={{ margin: '0 16px', padding: '10px 16px', borderRadius: 10, background: '#0d0d1a', border: '1px solid #1a1a2e', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.85)', textAlign: 'center', minHeight: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {G.msg}
      </div>

      {/* Echo window */}
      {canEchoNow && (
        <div style={{ margin: '8px 16px 0', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 12, padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: '#EF4444' }}>⚡ ECHO WINDOW — You have a {G.echoNum}!</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: countdown < 8 ? '#F87171' : '#fff' }}>{(countdown / 10).toFixed(1)}s</span>
          </div>
          <div style={{ height: 4, background: '#1a1a2e', borderRadius: 2, marginBottom: 10 }}>
            <div style={{ height: '100%', background: '#E63946', borderRadius: 2, width: `${(countdown / 25) * 100}%`, transition: 'width .1s linear' }} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {echoCards.map(c => (
              <div key={c.id} style={{ position: 'relative', cursor: 'pointer' }} onClick={() => humanPlay(c)}>
                <CardEl card={c} glow />
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#E63946', color: '#fff', fontSize: 9, fontWeight: 900, padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>ECHO!</div>
              </div>
            ))}
            <div style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,.35)', lineHeight: 1.6 }}>Click your {G.echoNum}<br/>to SLAM it!</div>
          </div>
        </div>
      )}

      {/* Human hand */}
      <div style={{ marginTop: 'auto', padding: '12px 16px', background: '#06060f', borderTop: '1px solid #1a1a2e' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: 'rgba(255,255,255,.25)', fontWeight: 900 }}>YOUR HAND ({humanHand.length})</div>
          {isHumanTurn && <div style={{ fontSize: 11, color: '#4ADE80', fontWeight: 900 }}>▶ YOUR TURN</div>}
          {canEchoNow && <div style={{ fontSize: 11, color: '#E63946', fontWeight: 900 }}>⚡ ECHO AVAILABLE</div>}
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6 }}>
          {humanHand.map(c => {
            const isPlayable = isHumanTurn && canPlay(c, top, G.acol);
            const isEchoPick = canEchoNow && c.t === 'n' && c.n === G.echoNum;
            return (
              <CardWithTip key={c.id} card={c}
                onClick={(isPlayable || isEchoPick) ? () => humanPlay(c) : undefined}
                glow={isPlayable || isEchoPick}
                dim={isHumanTurn && !isPlayable && !isEchoPick}
              />
            );
          })}
        </div>
        {isHumanTurn && humanHand.filter(c => canPlay(c, top, G.acol)).length === 0 && (
          <button onClick={humanDraw} style={{ marginTop: 8, width: '100%', padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#1a1a2e', color: 'rgba(255,255,255,.55)', fontWeight: 900, fontSize: 13, fontFamily: 'inherit', letterSpacing: 1 }}>
            DRAW A CARD
          </button>
        )}
      </div>

      {/* Wild picker */}
      {G.phase === 'wild' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, zIndex: 200, padding: 24 }}>
          <div style={{ fontSize: 28 }}>🎨</div>
          <div style={{ fontSize: 16, letterSpacing: 4, color: 'rgba(255,255,255,.6)', fontWeight: 900 }}>PICK A COLOR</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {COLORS.map(col => (
              <button key={col} onClick={() => pickColor(col)} style={{ width: 110, height: 90, borderRadius: 16, border: 'none', cursor: 'pointer', background: COL[col].grad, fontWeight: 900, fontSize: 13, color: '#fff', fontFamily: 'inherit', letterSpacing: 2 }}>
                {COL[col].name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Round end */}
      {G.phase === 'round_end' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, zIndex: 200, padding: 24 }}>
          <div style={{ fontSize: 56 }}>🎉</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', textAlign: 'center' }}>{G.msg}</div>
          <div style={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 16, padding: 20, width: '100%', maxWidth: 300 }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: 'rgba(255,255,255,.3)', fontWeight: 900, marginBottom: 12 }}>SCOREBOARD — ROUND {G.round}</div>
            {G.players.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #1a1a2e' }}>
                <span style={{ fontWeight: 700, color: 'rgba(255,255,255,.8)' }}>{p.name}</span>
                <span style={{ fontWeight: 900, color: '#E63946' }}>{p.wins} win{p.wins !== 1 ? 's' : ''} · {G.scores[i]}pts</span>
              </div>
            ))}
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 10, textAlign: 'center' }}>First to 3 round wins takes the game!</div>
          </div>
          <button onClick={newRound} style={{ padding: '16px 40px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#E63946,#c1121f)', color: '#fff', fontWeight: 900, fontSize: 16, letterSpacing: 2, fontFamily: 'inherit' }}>
            NEXT ROUND ⚡
          </button>
        </div>
      )}

      {/* Game over */}
      {G.phase === 'game_over' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, zIndex: 200, padding: 24 }}>
          <div style={{ fontSize: 72 }}>🏆</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', textAlign: 'center' }}>{G.msg}</div>
          <div style={{ background: '#0d0d1a', border: '1px solid #1a1a2e', borderRadius: 16, padding: 20, width: '100%', maxWidth: 300 }}>
            {G.players.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #1a1a2e' }}>
                <span style={{ fontWeight: 700, color: 'rgba(255,255,255,.8)' }}>{p.name}</span>
                <span style={{ fontWeight: 900, color: '#F59E0B' }}>{p.wins} win{p.wins !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setScreen('menu')} style={{ padding: '16px 40px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#E63946,#c1121f)', color: '#fff', fontWeight: 900, fontSize: 16, letterSpacing: 2, fontFamily: 'inherit' }}>
            PLAY AGAIN
          </button>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        ::-webkit-scrollbar{height:4px;background:transparent}
        ::-webkit-scrollbar-thumb{background:#333;border-radius:2px}
      `}</style>
    </div>
  );
}
