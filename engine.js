// engine.js — Pure game logic. No React. All functions are pure/deterministic.

export const COLORS = ['crimson', 'cobalt', 'jade', 'amber'];

export const COLOR_META = {
  crimson: { bg: '#EF4444', dark: '#B91C1C', grad: 'linear-gradient(145deg,#DC2626,#EF4444,#FCA5A5)', name: 'CRIMSON', ring: '#FCA5A5', emoji: '🔴' },
  cobalt:  { bg: '#3B82F6', dark: '#1D4ED8', grad: 'linear-gradient(145deg,#1D4ED8,#3B82F6,#93C5FD)', name: 'COBALT',  ring: '#93C5FD', emoji: '🔵' },
  jade:    { bg: '#22C55E', dark: '#15803D', grad: 'linear-gradient(145deg,#15803D,#22C55E,#86EFAC)', name: 'JADE',    ring: '#86EFAC', emoji: '🟢' },
  amber:   { bg: '#F59E0B', dark: '#B45309', grad: 'linear-gradient(145deg,#B45309,#F59E0B,#FCD34D)', name: 'AMBER',   ring: '#FCD34D', emoji: '🟡' },
};

export const SPECIAL_META = {
  echo_blast: { name: 'ECHO BLAST', emoji: '💥', desc: 'Next player draws 2 cards',       color: '#7C3AED', glow: '#A78BFA' },
  silence:    { name: 'SILENCE',    emoji: '🤫', desc: 'Play safely — Echo-proof turn',   color: '#475569', glow: '#94A3B8' },
  ripple:     { name: 'RIPPLE',     emoji: '🌊', desc: 'All other players draw 1 card',   color: '#0891B2', glow: '#67E8F9' },
  dark_echo:  { name: 'DARK ECHO',  emoji: '🌑', desc: 'Next player draws 3 cards',       color: '#1E293B', glow: '#64748B' },
  wild:       { name: 'WILD',       emoji: '🎨', desc: 'You choose the active color',     color: 'rainbow', glow: '#F9A8D4' },
  storm:      { name: 'STORM',      emoji: '⚡', desc: 'Everyone draws 1 card',           color: '#78350F', glow: '#FDE68A' },
  skip_echo:  { name: 'SKIP ECHO',  emoji: '🚫', desc: 'Next player loses their turn',    color: '#BE123C', glow: '#FCA5A5' },
};

// ── Level system ──────────────────────────────────────────────────────────────
export function getWildCount(level) {
  if (level <= 2) return 2;
  if (level <= 4) return 3;
  if (level <= 6) return 4;
  if (level <= 8) return 6;
  return 8;
}

export function getLevelLabel(level) {
  if (level <= 2) return 'Beginner';
  if (level <= 4) return 'Apprentice';
  if (level <= 6) return 'Player';
  if (level <= 8) return 'Expert';
  if (level <= 10) return 'Master';
  return 'Legend';
}

// ── Deck builder ──────────────────────────────────────────────────────────────
export function buildDeck(level = 1) {
  let id = 0;
  const cards = [];

  // 72 number cards (4 colors × 9 numbers × 2 copies)
  COLORS.forEach(col => {
    for (let n = 1; n <= 9; n++) {
      cards.push({ id: id++, kind: 'num', col, num: n });
      cards.push({ id: id++, kind: 'num', col, num: n });
    }
  });

  // Fixed special cards (no wilds here)
  [['echo_blast', 6], ['silence', 4], ['ripple', 4], ['dark_echo', 3], ['storm', 3], ['skip_echo', 4]]
    .forEach(([sp, cnt]) => {
      for (let i = 0; i < cnt; i++) cards.push({ id: id++, kind: 'special', sp });
    });

  // Level-scaled wild cards (start LOW, increase as player progresses)
  const wildCnt = getWildCount(level);
  for (let i = 0; i < wildCnt; i++) cards.push({ id: id++, kind: 'special', sp: 'wild' });

  return shuffle(cards);
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = 0 | (Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextIdx(cur, dir, n, skip = false) {
  let next = ((cur + dir) % n + n) % n;
  if (skip) next = ((next + dir) % n + n) % n;
  return next;
}

function drawCards(state, pidx, count) {
  let { deck, pile, players } = state;
  deck = [...deck];
  pile = [...pile];
  players = players.map(p => ({ ...p, hand: [...p.hand] }));

  for (let i = 0; i < count; i++) {
    if (!deck.length) {
      if (pile.length <= 1) break; // nothing to reshuffle
      const top = pile[pile.length - 1];
      deck = shuffle(pile.slice(0, -1));
      pile = [top];
    }
    if (deck.length) players[pidx].hand.push(deck.shift());
  }
  return { ...state, deck, pile, players };
}

export function canPlayCard(card, topCard, activeColor) {
  if (card.kind === 'special') return true; // all specials always playable
  return card.col === activeColor || (topCard?.kind === 'num' && card.num === topCard.num);
}

// ── Win / round handling ─────────────────────────────────────────────────────
function handleRoundWin(state, winnerIdx) {
  const players = state.players.map((p, i) =>
    i === winnerIdx ? { ...p, wins: (p.wins || 0) + 1 } : p
  );
  return {
    ...state, players,
    phase: 'round_over',
    roundWinner: winnerIdx,
    message: winnerIdx === 0 ? '🎉 ECHO OUT! You win the round!' : `${state.players[winnerIdx].name} wins the round!`,
  };
}

// ── Special card effects ──────────────────────────────────────────────────────
function applySpecialFX(state, card, byIdx) {
  const n = state.players.length;
  const ni = nextIdx(byIdx, state.direction, n);
  switch (card.sp) {
    case 'echo_blast': {
      const s = drawCards(state, ni, 2);
      return { ...s, message: `💥 ECHO BLAST! ${s.players[ni].name} draws 2!` };
    }
    case 'ripple': {
      let s = state;
      for (let i = 0; i < n; i++) if (i !== byIdx) s = drawCards(s, i, 1);
      return { ...s, message: '🌊 RIPPLE! All others draw 1!' };
    }
    case 'dark_echo': {
      const s = drawCards(state, ni, 3);
      return { ...s, message: `🌑 DARK ECHO! ${s.players[ni].name} draws 3!` };
    }
    case 'storm': {
      let s = state;
      for (let i = 0; i < n; i++) s = drawCards(s, i, 1);
      return { ...s, message: '⚡ STORM! Everyone draws 1!' };
    }
    default: return state;
  }
}

// ── Bot AI helpers ────────────────────────────────────────────────────────────
function getBotBestColor(hand) {
  const cnt = {};
  COLORS.forEach(c => cnt[c] = 0);
  hand.filter(c => c.kind === 'num').forEach(c => cnt[c.col]++);
  return COLORS.reduce((best, c) => cnt[c] > cnt[best] ? c : best, COLORS[0]);
}

function pickBotCard(playable, hand) {
  // When low on cards, prefer attack specials
  if (hand.length <= 3) {
    const atk = playable.filter(c =>
      c.kind === 'special' && ['echo_blast', 'dark_echo', 'skip_echo'].includes(c.sp)
    );
    if (atk.length) return atk[0 | (Math.random() * atk.length)];
  }
  // Generally prefer number cards to save specials
  const nums = playable.filter(c => c.kind === 'num');
  if (nums.length) return nums[0 | (Math.random() * nums.length)];
  return playable[0 | (Math.random() * playable.length)];
}

// ── Core play function ────────────────────────────────────────────────────────
// This is the heart of the engine — deterministic, pure, handles all routing.
function doPlay(state, card, byIdx) {
  const n = state.numPlayers;

  // Remove card from player's hand, add to pile
  let s = {
    ...state,
    pile: [...state.pile, card],
    players: state.players.map((p, i) =>
      i === byIdx ? { ...p, hand: p.hand.filter(c => c.id !== card.id) } : { ...p, hand: [...p.hand] }
    ),
    lastCard: card,
    lastBy: byIdx,
    lastEchoBy: null,
  };

  // Update active color for number cards
  if (card.kind === 'num') s.activeColor = card.col;

  // Check for round win
  if (s.players[byIdx].hand.length === 0) return handleRoundWin(s, byIdx);

  // Wild by human → open color picker
  if (card.kind === 'special' && card.sp === 'wild') {
    if (byIdx === 0) return { ...s, phase: 'wild_pick' };
    // Bot wild: pick best color immediately
    const handWithoutCard = state.players[byIdx].hand.filter(c => c.id !== card.id);
    s.activeColor = getBotBestColor(handWithoutCard);
    s.message = `${state.players[byIdx].name} plays WILD → ${s.activeColor.toUpperCase()}!`;
  }

  // Apply special effects
  if (card.kind === 'special' && card.sp !== 'wild') {
    s = applySpecialFX(s, card, byIdx);
  }

  // Advance turn pointer
  const skip = card.kind === 'special' && card.sp === 'skip_echo';
  const next = nextIdx(byIdx, s.direction, n, skip);
  s.curPlayer = next;

  // Check echo opportunity (only for number cards)
  if (card.kind === 'num') {
    const humanCanEcho = byIdx !== 0 && s.players[0].hand.some(c => c.kind === 'num' && c.num === card.num);
    const botCanEcho = s.players.some((p, i) =>
      i !== byIdx && p.isBot && p.hand.some(c => c.kind === 'num' && c.num === card.num)
    );

    if (humanCanEcho) {
      return {
        ...s,
        phase: 'echo_window',
        echoNum: card.num,
        echoFrom: byIdx,
        echoId: (s.echoId || 0) + 1,
        message: `You have a ${card.num}! ⚡ SLAM it before time runs out!`,
      };
    }
    if (botCanEcho) {
      return {
        ...s,
        phase: 'echo_bot',
        echoNum: card.num,
        echoFrom: byIdx,
        echoId: (s.echoId || 0) + 1,
        turnId: (s.turnId || 0) + 1,
      };
    }
  }

  // Normal turn advance
  s.phase = next === 0 ? 'human_turn' : 'bot_turn';
  s.turnId = (s.turnId || 0) + 1;
  if (s.phase === 'human_turn') s.message = '✨ Your turn! Match color or number.';
  return s;
}

// ── Main reducer ─────────────────────────────────────────────────────────────
export function engineReducer(state, action) {
  if (action.type === 'INIT') return initGame(action.numPlayers, action.level);
  if (!state) return null;

  switch (action.type) {

    case 'HUMAN_PLAY': {
      if (state.phase !== 'human_turn' || state.curPlayer !== 0) return state;
      const { card } = action;
      if (!canPlayCard(card, state.pile[state.pile.length - 1], state.activeColor)) return state;
      return doPlay(state, card, 0);
    }

    case 'HUMAN_DRAW': {
      if (state.phase !== 'human_turn' || state.curPlayer !== 0) return state;
      let s = drawCards(state, 0, 1);
      const drawn = s.players[0].hand[s.players[0].hand.length - 1];
      if (!canPlayCard(drawn, s.pile[s.pile.length - 1], s.activeColor)) {
        const next = nextIdx(0, s.direction, s.numPlayers);
        return {
          ...s,
          curPlayer: next,
          phase: next === 0 ? 'human_turn' : 'bot_turn',
          turnId: (s.turnId || 0) + 1,
          message: `Drew a card. ${s.players[next].name}'s turn.`,
        };
      }
      return { ...s, message: '🃏 Drew a playable card — play it now!' };
    }

    case 'HUMAN_ECHO': {
      if (state.phase !== 'echo_window') return state;
      const { card } = action;
      if (card.kind !== 'num' || card.num !== state.echoNum) return state;
      let s = drawCards(state, state.echoFrom, 1);
      s = { ...s, lastEchoBy: 0, message: `💥 ECHO! ${s.players[state.echoFrom].name} draws 1!` };
      return doPlay(s, card, 0);
    }

    case 'ECHO_TIMEOUT': {
      if (state.phase !== 'echo_window') return state;
      if (action.echoId !== state.echoId) return state; // stale timer
      // Check if any bot can now echo
      const botHasMatch = state.players.some((p, i) =>
        i !== state.echoFrom && p.isBot && p.hand.some(c => c.kind === 'num' && c.num === state.echoNum)
      );
      if (botHasMatch) {
        return { ...state, phase: 'echo_bot', turnId: (state.turnId || 0) + 1 };
      }
      const next = state.curPlayer;
      return {
        ...state,
        phase: next === 0 ? 'human_turn' : 'bot_turn',
        echoNum: null, echoFrom: null,
        message: next === 0 ? '✨ Your turn!' : `${state.players[next]?.name}'s turn`,
        turnId: (state.turnId || 0) + 1,
      };
    }

    case 'BOT_ECHO': {
      if (state.phase !== 'echo_bot') return state;
      if (!action.doEcho) {
        const next = state.curPlayer;
        return {
          ...state,
          phase: next === 0 ? 'human_turn' : 'bot_turn',
          echoNum: null, echoFrom: null,
          message: next === 0 ? '✨ Your turn!' : `${state.players[next]?.name}'s turn`,
          turnId: (state.turnId || 0) + 1,
        };
      }
      const { botIdx, card } = action;
      let s = drawCards(state, state.echoFrom, 1);
      s = { ...s, lastEchoBy: botIdx, message: `${s.players[botIdx].name} ECHO'd! 💥` };
      return doPlay(s, card, botIdx);
    }

    case 'BOT_PLAY': {
      if (state.phase !== 'bot_turn') return state;
      const { curPlayer, players, direction, numPlayers } = state;
      if (curPlayer === 0) return state; // safety guard

      const hand = players[curPlayer].hand;
      const topCard = state.pile[state.pile.length - 1];
      const playable = hand.filter(c => canPlayCard(c, topCard, state.activeColor));

      if (!playable.length) {
        // Must draw
        let s = drawCards(state, curPlayer, 1);
        const drawn = s.players[curPlayer].hand[s.players[curPlayer].hand.length - 1];
        if (canPlayCard(drawn, s.pile[s.pile.length - 1], s.activeColor)) {
          return doPlay(s, drawn, curPlayer);
        }
        const next = nextIdx(curPlayer, direction, numPlayers);
        return {
          ...s,
          curPlayer: next,
          phase: next === 0 ? 'human_turn' : 'bot_turn',
          turnId: (s.turnId || 0) + 1,
          message: `${players[curPlayer].name} draws a card.`,
        };
      }

      const card = pickBotCard(playable, hand);
      return doPlay(state, card, curPlayer);
    }

    case 'PICK_COLOR': {
      if (state.phase !== 'wild_pick') return state;
      const { col } = action;
      const next = nextIdx(state.curPlayer, state.direction, state.numPlayers);
      return {
        ...state,
        activeColor: col,
        curPlayer: next,
        phase: next === 0 ? 'human_turn' : 'bot_turn',
        turnId: (state.turnId || 0) + 1,
        message: `🎨 Color → ${col.toUpperCase()}! ${state.players[next]?.name}'s turn.`,
      };
    }

    case 'NEW_ROUND': {
      const gameOver = state.players.some(p => (p.wins || 0) >= 3);
      if (gameOver) {
        const winner = state.players.reduce((a, b) => ((a.wins || 0) > (b.wins || 0) ? a : b));
        return { ...state, phase: 'game_over', message: `${winner.name} wins the GAME! 🏆` };
      }
      return startRound(state);
    }

    default: return state;
  }
}

// ── Init helpers ──────────────────────────────────────────────────────────────
const BOT_NAMES  = ['Bot Alpha', 'Bot Blaze', 'Bot Comet', 'Bot Delta'];
const BOT_EMOJIS = ['🤖', '👾', '🎮', '🎲'];

function startRound(existing) {
  const { numPlayers, level, players: old } = existing;
  const deck = buildDeck(level);
  const d = [...deck];
  const hands = Array.from({ length: numPlayers }, () => d.splice(0, 7));
  let top; do { top = d.shift(); } while (top.kind !== 'num');

  const players = Array.from({ length: numPlayers }, (_, i) => ({
    id: i,
    name: old?.[i]?.name ?? (i === 0 ? 'You' : BOT_NAMES[i - 1]),
    emoji: i === 0 ? '😊' : BOT_EMOJIS[i - 1],
    isBot: i > 0,
    wins: old?.[i]?.wins ?? 0,
    hand: hands[i],
  }));

  return {
    ...existing, players, deck: d, pile: [top],
    activeColor: top.col, curPlayer: 0, direction: 1,
    phase: 'human_turn',
    echoNum: null, echoFrom: null, echoId: 0, turnId: 0,
    roundWinner: null, lastCard: null, lastBy: null, lastEchoBy: null,
    message: '✨ Your turn! Match color or number.',
    roundNum: (existing.roundNum || 0) + 1,
  };
}

export function initGame(numPlayers, level) {
  return startRound({ numPlayers, level, players: null, roundNum: 0 });
}
