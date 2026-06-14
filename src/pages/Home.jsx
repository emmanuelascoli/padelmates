import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, isToday, isTomorrow, isPast } from 'date-fns'
import { fr } from 'date-fns/locale'
import { LEVEL_SHORT } from '../lib/constants'

// ── Helpers ───────────────────────────────────────────────────
function avatarColor(str = '') {
  const colors = ['#2563EB','#059669','#7C3AED','#D97706','#DC2626','#0891B2','#9333EA','#16A34A']
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff
  return colors[Math.abs(h) % colors.length]
}

// Muted palette for feed avatars (not rainbow)
const FEED_COLORS = ['#3B6D4E', '#5C6E7A', '#7A6556', '#4A6090']
function feedColor(str = '') {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff
  return FEED_COLORS[Math.abs(h) % FEED_COLORS.length]
}

function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 60) return `Il y a ${mins}min`
  if (hours < 24) return `Il y a ${hours}h`
  if (days  ===1) return 'Hier'
  if (days  < 7)  return `Il y a ${days}j`
  return format(new Date(ts), 'd MMM', { locale: fr })
}

function firstName(fullName = '') {
  return fullName.split(' ')[0] ?? fullName
}

// ── Avatar ────────────────────────────────────────────────────
function Avatar({ name, avatarUrl, color, size = 32, radius = 10 }) {
  const initials = (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  if (avatarUrl) {
    return (
      <img src={avatarUrl} alt={name}
        style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, background: color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.38), fontWeight: 500, color: '#fff',
    }}>
      {initials}
    </div>
  )
}

// Avatar for feed (muted palette, photo-ready)
function FeedAvatar({ profile, size = 24 }) {
  const p = profile ?? {}
  const color    = feedColor(p.id || '')
  const initials = (p.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const url      = p.avatar_url || p.avatarUrl
  const r        = Math.round(size * 0.33)
  if (url) {
    return <img src={url} alt={p.name} style={{ width: size, height: size, borderRadius: r, objectFit: 'cover', flexShrink: 0 }} />
  }
  return (
    <div style={{ width: size, height: size, borderRadius: r, background: color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.38), fontWeight: 600, color: '#fff' }}>
      {initials}
    </div>
  )
}

// ── Kudos button (local state only — no DB persistence yet) ───
function KudosButton({ itemId, kudosGiven, onKudos }) {
  const given = !!kudosGiven[itemId]
  return (
    <button
      onClick={() => onKudos(itemId)}
      style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color: given ? '#15803d' : '#9CA3AF', background:'none', border:'none', cursor:'pointer', padding:0 }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill={given ? '#15803d' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/>
        <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
      </svg>
      Kudos
    </button>
  )
}

// ── Feed card: Match result ───────────────────────────────────
function MatchResultCard({ item, myId, kudosGiven, onKudos }) {
  const { session, matches, timestamp, isMySession } = item
  return (
    <div style={{ background:'#fff', borderRadius:12, border:'.5px solid #E5E7EB', marginBottom:7, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', padding:'10px 12px 6px', gap:6 }}>
        <span style={{ fontSize:9, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.05em' }}>
          Résultat{isMySession ? ' · Ta partie' : ''}
        </span>
        {isMySession && (
          <span style={{ fontSize:9, fontWeight:600, color:'#14532d', background:'#F0FDF4', border:'.5px solid #BBF7D0', padding:'1px 6px', borderRadius:999 }}>
            Inscrit
          </span>
        )}
        <span style={{ marginLeft:'auto', fontSize:10, color:'#C4C2BC' }}>{timeAgo(timestamp)}</span>
      </div>

      {/* Matches */}
      <div style={{ padding:'0 12px 10px' }}>
        {session && (
          <div style={{ fontSize:10, color:'#9CA3AF', marginBottom:7 }}>
            {session.location} · {matches.length} match{matches.length > 1 ? 's' : ''} joué{matches.length > 1 ? 's' : ''}
          </div>
        )}

        {matches.map((m, idx) => {
          const t1Won = m.winner_team === 1
          const t2Won = m.winner_team === 2
          const t1Label = [m.t1p1, m.t1p2]
            .filter(Boolean)
            .map(p => p.id === myId ? 'Toi' : firstName(p.name))
            .join(' + ')
          const t2Label = [m.t2p1, m.t2p2]
            .filter(Boolean)
            .map(p => p.id === myId ? 'Toi' : firstName(p.name))
            .join(' + ')
          return (
            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:6, paddingTop: idx > 0 ? 6 : 0, borderTop: idx > 0 ? '.5px solid #F9F9F8' : 'none', paddingBottom:6 }}>
              {/* Team 1 */}
              <div style={{ flex:1, display:'flex', alignItems:'center', gap:4, minWidth:0, overflow:'hidden' }}>
                <FeedAvatar profile={m.t1p1} size={20} />
                {m.t1p2 && <FeedAvatar profile={m.t1p2} size={20} />}
                <span style={{ fontSize:11, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', fontWeight: t1Won ? 600 : 400, color: t1Won ? '#14532d' : '#B0AEA8' }}>
                  {t1Label}
                </span>
              </div>

              {/* Score */}
              <div style={{ display:'flex', alignItems:'center', gap:3, flexShrink:0 }}>
                <span style={{ fontSize:14, fontWeight:700, color: t1Won ? '#14532d' : '#D1D5DB', lineHeight:1 }}>{m.team1_score}</span>
                <span style={{ fontSize:10, color:'#E5E7EB' }}>–</span>
                <span style={{ fontSize:14, fontWeight:700, color: t2Won ? '#14532d' : '#D1D5DB', lineHeight:1 }}>{m.team2_score}</span>
              </div>

              {/* Team 2 */}
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'flex-end', gap:4, minWidth:0, overflow:'hidden' }}>
                <span style={{ fontSize:11, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', textAlign:'right', fontWeight: t2Won ? 600 : 400, color: t2Won ? '#14532d' : '#B0AEA8' }}>
                  {t2Label}
                </span>
                {m.t2p2 && <FeedAvatar profile={m.t2p2} size={20} />}
                <FeedAvatar profile={m.t2p1} size={20} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ borderTop:'.5px solid #F3F4F6', padding:'7px 12px', display:'flex', alignItems:'center' }}>
        <KudosButton itemId={item.id} kudosGiven={kudosGiven} onKudos={onKudos} />
      </div>
    </div>
  )
}

// ── Feed card: Friend upcoming session ────────────────────────
function FriendSessionCard({ item }) {
  const { friends, session } = item
  const sessDate   = new Date(`${session.date}T${session.time}`)
  const placesLeft = session.max_players - (session.session_participants?.length ?? 0)
  const when       = isToday(sessDate) ? "aujourd'hui" : isTomorrow(sessDate) ? 'demain' : format(sessDate, 'EEE d MMM', { locale: fr })

  const names = friends.map(f => firstName(f.name))
  const nameLabel = names.length === 1
    ? `${names[0]} joue ${when}`
    : names.length === 2
      ? `${names[0]} et ${names[1]} jouent ${when}`
      : `${names[0]}, ${names[1]} et ${names.length - 2} autre${names.length > 3 ? 's' : ''} jouent ${when}`

  return (
    <div style={{ background:'#fff', borderRadius:12, border:'.5px solid #E5E7EB', marginBottom:7 }}>
      <div style={{ display:'flex', alignItems:'center', padding:'10px 12px 6px' }}>
        <span style={{ fontSize:9, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.05em' }}>
          {friends.length > 1 ? 'Amis disponibles' : 'Ami disponible'}
        </span>
        <span style={{ marginLeft:'auto', fontSize:10, color:'#C4C2BC' }}>
          {isToday(sessDate) ? 'Auj.' : isTomorrow(sessDate) ? 'Dem.' : format(sessDate, 'EEE d', { locale: fr })}
        </span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:9, padding:'0 12px 10px' }}>
        {/* Avatar stack — overlap quand plusieurs amis */}
        <div style={{ display:'flex', flexShrink:0 }}>
          {friends.slice(0, 3).map((f, i) => (
            <div key={f.id} style={{ marginLeft: i > 0 ? -8 : 0, zIndex: 3 - i, position:'relative' }}>
              <FeedAvatar profile={{ id: f.id, name: f.name, avatar_url: f.avatarUrl }} size={28} />
            </div>
          ))}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:500, color:'#111827', marginBottom:1 }}>{nameLabel}</div>
          <div style={{ fontSize:10, color:'#9CA3AF' }}>
            {format(sessDate, 'HH:mm')} · {session.location} · {placesLeft} place{placesLeft > 1 ? 's' : ''} dispo
          </div>
        </div>
        <Link to={`/sessions/${session.id}`} style={{ fontSize:11, fontWeight:500, color:'#14532d', flexShrink:0, textDecoration:'none' }}>
          Rejoindre →
        </Link>
      </div>
    </div>
  )
}

// ── Feed card: Streak ─────────────────────────────────────────
function StreakCard({ item, kudosGiven, onKudos }) {
  const { player, count, isWin, isMine } = item
  return (
    <div style={{ background:'#fff', borderRadius:12, border:'.5px solid #E5E7EB', marginBottom:7, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', padding:'10px 12px 6px' }}>
        <span style={{ fontSize:9, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.05em' }}>Série</span>
        <span style={{ marginLeft:'auto', fontSize:10, color:'#C4C2BC' }}>{timeAgo(item.timestamp)}</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:9, padding:'0 12px 10px' }}>
        <FeedAvatar profile={{ id: player.id, name: player.name, avatar_url: player.avatarUrl }} size={28} />
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12, fontWeight:500, color:'#111827' }}>
            {isMine ? 'Tu enchaînes' : `${firstName(player.name)} enchaîne`} les {isWin ? 'victoires' : 'défaites'}
          </div>
          <div style={{ fontSize:10, color:'#9CA3AF', marginTop:1 }}>
            {count} matchs consécutifs {isWin ? 'gagnés' : 'perdus'}
          </div>
        </div>
        <span style={{ fontSize:11, fontWeight:700, color: isWin ? '#D97706' : '#9CA3AF', background: isWin ? '#FEF3C7' : '#F3F4F6', padding:'2px 8px', borderRadius:999, flexShrink:0 }}>
          🔥 ×{count}
        </span>
      </div>
      {!isMine && (
        <div style={{ borderTop:'.5px solid #F3F4F6', padding:'7px 12px' }}>
          <KudosButton itemId={item.id} kudosGiven={kudosGiven} onKudos={onKudos} />
        </div>
      )}
    </div>
  )
}

// ── Feed card: Top 3 ──────────────────────────────────────────
function Top3Card({ item }) {
  const [first, second, third] = item.players
  const cols = [
    { p: second, bar: 30, bg: '#C7D9BE', label: '2' },
    { p: first,  bar: 44, bg: '#2A5A3A', label: '1', crown: true },
    { p: third,  bar: 20, bg: '#DDD9D0', label: '3', textColor: '#8A8880' },
  ]
  return (
    <div style={{ background:'#fff', borderRadius:12, border:'.5px solid #E5E7EB', marginBottom:7 }}>
      <div style={{ display:'flex', alignItems:'center', padding:'10px 12px 6px' }}>
        <Link to="/leaderboard" style={{ fontSize:9, fontWeight:600, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.05em', textDecoration:'none' }}>
          Classement ELO →
        </Link>
      </div>
      <div style={{ padding:'0 12px 12px' }}>
        <div style={{ fontSize:10, color:'#9CA3AF', marginBottom:10 }}>Top 3 du classement général</div>
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'center', gap:6 }}>
          {cols.map(({ p, bar, bg, label, crown, textColor }) => p && (
            <div key={p.id} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
              {crown && <span style={{ fontSize:12 }}>👑</span>}
              <Link to={`/players/${p.id}`} style={{ textDecoration:'none' }}>
                <FeedAvatar profile={{ id: p.id, name: p.name, avatar_url: p.avatar_url }} size={28} />
              </Link>
              <div style={{ fontSize:9, fontWeight: crown ? 700 : 500, color: crown ? '#111827' : '#374151' }}>{firstName(p.name)}</div>
              <div style={{ fontSize:8, color:'#9CA3AF' }}>{p.rank_score} pts</div>
              <div style={{ width:50, height:bar, borderRadius:'4px 4px 0 0', background: bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color: textColor ?? '#fff' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Activity Feed ─────────────────────────────────────────────
function ActivityFeed({ items, loading, myId, kudosGiven, onKudos }) {
  if (loading) {
    return (
      <div style={{ display:'flex', justifyContent:'center', padding:'20px 0', marginBottom:14 }}>
        <div className="w-5 h-5 border-[2px] border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!items.length) return null

  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:13, fontWeight:500, color:'#111827', marginBottom:9 }}>Fil d'actu</div>
      {items.map(item => {
        switch (item.type) {
          case 'match_result':
            return <MatchResultCard key={item.id} item={item} myId={myId} kudosGiven={kudosGiven} onKudos={onKudos} />
          case 'friend_session':
            return <FriendSessionCard key={item.id} item={item} />
          case 'streak':
            return <StreakCard key={item.id} item={item} kudosGiven={kudosGiven} onKudos={onKudos} />
          case 'top3':
            return <Top3Card key={item.id} item={item} />
          default:
            return null
        }
      })}
    </div>
  )
}

// ── Trouve tes amis card (nouveau joueur) ────────────────────
function FindFriendsCard() {
  const avatarColors = ['#2563EB','#059669','#7C3AED','#D97706']
  const avatarInitials = ['MD','SL','PT','RB']
  return (
    <>
      <div style={{ fontSize:13, fontWeight:500, color:'#111827', marginBottom:8 }}>Retrouve tes amis</div>
      <div style={{ background:'#fff', borderRadius:13, border:'.5px solid #E5E7EB', overflow:'hidden', marginBottom:14 }}>
        <div style={{ padding:'12px 14px 10px', borderBottom:'.5px solid #F3F4F6' }}>
          <div style={{ fontSize:13, fontWeight:500, color:'#111827', marginBottom:3 }}>Vos amis jouent peut-être déjà ici</div>
          <div style={{ fontSize:11, color:'#9CA3AF', lineHeight:1.4 }}>Retrouve des joueurs que tu connais et rejoins-les sur le terrain.</div>
        </div>
        <div style={{ padding:'12px 14px' }}>
          <div style={{ display:'flex', alignItems:'center', marginBottom:12 }}>
            <div style={{ display:'flex' }}>
              {avatarInitials.map((init, i) => (
                <div key={i} style={{
                  width:36, height:36, borderRadius:11, border:'2px solid #fff',
                  background: avatarColors[i], display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:12, fontWeight:600, color:'#fff', flexShrink:0,
                  marginLeft: i === 0 ? 0 : -10,
                }}>{init}</div>
              ))}
              <div style={{
                width:36, height:36, borderRadius:11, border:'2px solid #fff',
                background:'#F3F4F6', display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:10, fontWeight:600, color:'#6B7280', marginLeft:-10, flexShrink:0,
              }}>+12</div>
            </div>
            <div style={{ marginLeft:10, lineHeight:1.35 }}>
              <div style={{ fontSize:12, fontWeight:500, color:'#111827' }}>15 joueurs actifs</div>
              <div style={{ fontSize:11, color:'#9CA3AF' }}>dans la communauté</div>
            </div>
          </div>
          <Link to="/community"
            style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              padding:10, background:'#F0FDF4', border:'.5px solid #BBF7D0', borderRadius:10,
              fontSize:12, fontWeight:500, color:'#14532d', textDecoration:'none',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
            Parcourir les membres
          </Link>
        </div>
      </div>
    </>
  )
}

// ── Premiers pas card (nouveau joueur) ───────────────────────
function FirstStepsCard({ hasJoinedSession, hasFriends }) {
  const steps = [
    { icon:'✅', label:'Créer ton compte',               sub:'Bienvenue sur PadelMates !',             done:true,             link:null },
    { icon:'🎾', label:'Rejoindre ta première partie',   sub:'Inscris-toi à une partie à venir',       done:hasJoinedSession, link:'/sessions' },
    { icon:'👥', label:'Ajouter un ami',                  sub:'Retrouve des joueurs que tu connais',    done:hasFriends,       link:'/community' },
    { icon:'🏆', label:'Enregistrer ton premier score',  sub:'Apparais dans le classement',             done:false,            link:'/sessions' },
  ]
  return (
    <>
      <div style={{ fontSize:13, fontWeight:500, color:'#111827', marginBottom:8 }}>Premiers pas</div>
      <div style={{ background:'#fff', borderRadius:13, border:'.5px solid #E5E7EB', padding:'12px 14px', marginBottom:14 }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom: i < steps.length - 1 ? 10 : 0 }}>
            <div style={{
              width:28, height:28, borderRadius:9, flexShrink:0,
              background: step.done ? '#DCFCE7' : '#F3F4F6',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:13,
            }}>{step.icon}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{
                fontSize:12, fontWeight:500, marginBottom:1,
                color: step.done ? '#14532d' : '#111827',
                textDecoration: step.done ? 'line-through' : 'none',
                opacity: step.done ? 0.6 : 1,
              }}>{step.label}</div>
              <div style={{ fontSize:10, color:'#9CA3AF' }}>{step.sub}</div>
            </div>
            <div style={{ flexShrink:0, marginTop:2 }}>
              {step.done
                ? <span style={{ fontSize:11, color:'#14532d' }}>✓</span>
                : step.link
                  ? <Link to={step.link} style={{ fontSize:11, color:'#9CA3AF', textDecoration:'none' }}>›</Link>
                  : null
              }
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Photo nudge banner ────────────────────────────────────────
function PhotoNudge() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return (
    <div style={{
      background: '#fff', borderRadius: 13, border: '0.5px solid #E5E7EB',
      padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 10,
      marginBottom: 14, position: 'relative',
    }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: '#F3F4F6', border: '1.5px dashed #D1D5DB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div style={{ position: 'absolute', bottom: -4, right: -4, width: 16, height: 16, background: '#4ade80', borderRadius: '50%', border: '2px solid #F5F4F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#14532d" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginBottom: 1 }}>Ajoute ta photo de profil</div>
        <div style={{ fontSize: 10, color: '#9CA3AF', lineHeight: 1.35 }}>Tes coéquipiers te reconnaîtront mieux.</div>
      </div>
      <Link to="/profile" style={{ background: '#14532d', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, textDecoration: 'none' }}>
        Ajouter →
      </Link>
      <button
        onClick={() => setDismissed(true)}
        style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 5, background: '#F3F4F6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#9CA3AF' }}
      >✕</button>
    </div>
  )
}

// ── Inline SVG Chart ──────────────────────────────────────────
function EvoChart({ points }) {
  if (!points || points.length < 2) return (
    <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#9CA3AF' }}>
      Jouez votre premier match pour voir votre évolution
    </div>
  )
  const W = 308, H = 80, padL = 6, padR = 6, padT = 10, padB = 18
  const innerW = W - padL - padR, innerH = H - padT - padB
  const mn = Math.min(...points), mx = Math.max(...points)
  const range = mx - mn || 1
  const xs = points.map((_, i) => padL + i * innerW / (points.length - 1))
  const ys = points.map(v => padT + innerH - ((v - mn) / range) * innerH)
  const polyline = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const areaPath = `M${xs[0].toFixed(1)},${ys[0].toFixed(1)} ` +
    xs.slice(1).map((x, i) => `L${x.toFixed(1)},${ys[i + 1].toFixed(1)}`).join(' ') +
    ` L${xs[xs.length - 1].toFixed(1)},${(H - padB).toFixed(1)} L${xs[0].toFixed(1)},${(H - padB).toFixed(1)} Z`
  const lastX = xs[xs.length - 1], lastY = ys[ys.length - 1]
  const lastVal = points[points.length - 1]
  const labelX = lastX > W - 56 ? lastX - 38 : lastX + 6

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'hidden' }}>
      <defs>
        <clipPath id="cc"><rect x={padL} y={padT} width={innerW} height={innerH + 2} /></clipPath>
      </defs>
      <path d={areaPath} fill="rgba(20,83,45,0.07)" clipPath="url(#cc)" />
      <polyline points={polyline} fill="none" stroke="#14532d" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" clipPath="url(#cc)" />
      {xs.slice(0, -1).map((x, i) => (
        <circle key={i} cx={x.toFixed(1)} cy={ys[i].toFixed(1)} r="2" fill="#14532d" opacity="0.5" />
      ))}
      <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r="6" fill="rgba(20,83,45,0.12)" />
      <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r="3.5" fill="#14532d" />
      <rect x={labelX} y={lastY - 9} width="36" height="14" rx="4" fill="#14532d" />
      <text x={labelX + 18} y={lastY + 1} textAnchor="middle" fontSize="9" fill="white" fontWeight="500">{lastVal} pts</text>
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="#E5E7EB" strokeWidth="0.5" />
      <text x={padL} y={H - 4} fontSize="8" fill="#9CA3AF">M1</text>
      <text x={W - padR} y={H - 4} fontSize="8" fill="#9CA3AF" textAnchor="end">M{points.length}</text>
    </svg>
  )
}

// ── Session Card ──────────────────────────────────────────────
function SessionCard({ session, userId }) {
  const date       = new Date(`${session.date}T${session.time}`)
  const count      = session.session_participants?.length ?? 0
  const max        = session.max_players
  const isFull     = count >= max
  const isPastSess = isPast(date)
  const registered = (session.session_participants || []).some(p => p.user_id === userId)
  const pct        = Math.min(100, Math.round((count / max) * 100))

  let dayLabel = format(date, 'EEE', { locale: fr }).toUpperCase().replace('.', '')
  if (isToday(date))    dayLabel = 'AUJ.'
  if (isTomorrow(date)) dayLabel = 'DEM.'

  return (
    <Link to={`/sessions/${session.id}`}
      className="block bg-white rounded-2xl mb-2 active:scale-[0.99] transition-transform"
      style={{ border: '0.5px solid #E5E7EB' }}
    >
      <div className="flex items-center">
        <div className="bg-primary rounded-xl m-2 flex flex-col items-center justify-center py-2 shrink-0" style={{ width: 52 }}>
          <span className="text-[#6B9B7A] text-[10px] font-semibold tracking-widest uppercase leading-none">{dayLabel}</span>
          <span className="text-white text-[26px] font-bold leading-tight mt-0.5">{format(date, 'd')}</span>
          <span className="text-[#6B9B7A] text-[10px] uppercase tracking-wide leading-none">{format(date, 'MMM', { locale: fr }).toUpperCase().replace('.', '')}</span>
          <span className="text-accent font-bold text-[12px] mt-1 leading-none">{format(date, 'HH:mm')}</span>
        </div>
        <div className="flex-1 pr-3 py-2.5 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <span className="font-bold text-gray-900 text-[14px] leading-snug">{session.title}</span>
            {registered && (
              <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#DCFCE7', color: '#166534' }}>Inscrit</span>
            )}
            {!isPastSess && isFull && !registered && (
              <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#FEE2E2', color: '#B91C1C' }}>Complet</span>
            )}
          </div>
          <div className="flex items-center gap-1 text-gray-400 text-[10px] mb-1.5">
            <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {session.location}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 bg-gray-100 rounded-[2px] h-[3px]" style={{ overflow: 'hidden' }}>
              <div className="h-[3px] rounded-[2px]"
                style={{ width: `${pct}%`, background: isFull ? '#EF4444' : '#4ade80' }} />
            </div>
            <span className="text-[9px] shrink-0" style={{ color: isFull ? '#EF4444' : '#15803d', fontWeight: 500 }}>
              {isFull ? 'Complet' : `${max - count} dispo`}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ── Page ─────────────────────────────────────────────────────
export default function Home() {
  const { user, profile, signOut } = useAuth()

  const [upcomingSessions, setUpcomingSessions] = useState([])
  const [totalUpcoming, setTotalUpcoming]       = useState(0)
  const [myStats, setMyStats]     = useState({ wins: 0, losses: 0, played: 0, points: 0 })
  const [eloRank, setEloRank]     = useState(null)
  const [recentForm, setRecentForm]   = useState([])
  const [topPartners, setTopPartners] = useState([])
  const [topRivals, setTopRivals]     = useState([])
  const [eloHistory, setEloHistory]   = useState([])
  const [ptsHistory, setPtsHistory]   = useState([])
  const [chartTab, setChartTab]       = useState('elo')
  const [playersTab, setPlayersTab]   = useState('partners')
  const [loading, setLoading]         = useState(true)

  // Feed
  const [feedItems, setFeedItems]     = useState([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [kudosGiven, setKudosGiven]   = useState({})
  const [hasFriends, setHasFriends]   = useState(false)

  useEffect(() => {
    if (profile?.id) {
      fetchData()
      fetchFeedData()
    }
  }, [profile?.id])

  // ── Phase 1: user's own stats & sessions ─────────────────
  async function fetchData() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    const [
      { data: myParticipations },
      { data: rawMatches },
      { data: allMatchRows },
    ] = await Promise.all([
      supabase
        .from('session_participants')
        .select('session_id')
        .eq('user_id', profile.id),
      supabase
        .from('valid_matches')
        .select('*')
        .or(`team1_player1.eq.${profile.id},team1_player2.eq.${profile.id},team2_player1.eq.${profile.id},team2_player2.eq.${profile.id}`)
        .not('winner_team', 'is', null)
        .order('played_at', { ascending: true }),
      supabase
        .from('valid_matches')
        .select('team1_player1,team1_player2,team2_player1,team2_player2')
        .not('winner_team', 'is', null),
    ])

    const mySessionIds = (myParticipations || []).map(p => p.session_id)
    const allPlayerIds = [...new Set(
      (allMatchRows || [])
        .flatMap(m => [m.team1_player1, m.team1_player2, m.team2_player1, m.team2_player2])
        .filter(Boolean)
    )]

    const [
      { data: sessions },
      { count: total },
      { data: rankedProfiles },
    ] = await Promise.all([
      mySessionIds.length > 0
        ? supabase
            .from('sessions')
            .select('*, session_participants(id, user_id)')
            .in('id', mySessionIds)
            .gte('date', today)
            .neq('status', 'cancelled')
            .order('date', { ascending: true })
            .order('time', { ascending: true })
            .limit(5)
        : Promise.resolve({ data: [] }),
      mySessionIds.length > 0
        ? supabase
            .from('sessions')
            .select('*', { count: 'exact', head: true })
            .in('id', mySessionIds)
            .gte('date', today)
            .neq('status', 'cancelled')
        : Promise.resolve({ count: 0 }),
      allPlayerIds.length > 0
        ? supabase.from('profiles').select('id, rank_score').in('id', allPlayerIds)
        : Promise.resolve({ data: [] }),
    ])

    setUpcomingSessions(sessions || [])
    setTotalUpcoming(total ?? 0)

    const sortedElo = (rankedProfiles || []).sort((a, b) => (b.rank_score ?? 1000) - (a.rank_score ?? 1000))
    const myEloIdx  = sortedElo.findIndex(p => p.id === profile.id)
    setEloRank(myEloIdx >= 0 ? myEloIdx + 1 : null)

    const matches = rawMatches || []
    let wins = 0, losses = 0
    matches.forEach(m => {
      const isT1 = m.team1_player1 === profile.id || m.team1_player2 === profile.id
      const won  = (isT1 && m.winner_team === 1) || (!isT1 && m.winner_team === 2)
      if (won) wins++; else losses++
    })
    const played = matches.length
    const points = wins * 3 + losses * 1
    setMyStats({ wins, losses, played, points })

    setRecentForm(
      [...matches].reverse().slice(0, 5).reverse().map(m => {
        const isT1 = m.team1_player1 === profile.id || m.team1_player2 === profile.id
        return (isT1 && m.winner_team === 1) || (!isT1 && m.winner_team === 2) ? 'W' : 'L'
      })
    )

    if (matches.length >= 2) {
      let elo = 1000, pts = 0
      const eloH = [elo], ptsH = [pts]
      matches.forEach(m => {
        const isT1 = m.team1_player1 === profile.id || m.team1_player2 === profile.id
        const won  = (isT1 && m.winner_team === 1) || (!isT1 && m.winner_team === 2)
        const ws   = m.winner_team === 1 ? m.team1_score : m.team2_score
        const ls   = m.winner_team === 1 ? m.team2_score : m.team1_score
        const diff = (ws ?? 0) - (ls ?? 0)
        let eloPts = diff === 1 ? 17 : diff <= 2 ? 20 : diff <= 4 ? 23 : 26
        elo = Math.max(100, elo + (won ? eloPts : -eloPts))
        pts += won ? 3 : 1
        eloH.push(elo)
        ptsH.push(pts)
      })
      const realElo = profile.rank_score ?? 1000
      const offset  = realElo - eloH[eloH.length - 1]
      setEloHistory(eloH.map(v => v + offset))
      setPtsHistory(ptsH)
    }

    const partnerMap = {}, rivalMap = {}
    const getOrCreate = (map, id) => {
      if (!map[id]) map[id] = { id, games: 0, wins: 0 }
      return map[id]
    }
    matches.forEach(m => {
      const isT1 = m.team1_player1 === profile.id || m.team1_player2 === profile.id
      const won  = (isT1 && m.winner_team === 1) || (!isT1 && m.winner_team === 2)
      const partnerIds = (isT1
        ? [m.team1_player1, m.team1_player2]
        : [m.team2_player1, m.team2_player2]
      ).filter(id => id && id !== profile.id)
      const rivalIds = (isT1
        ? [m.team2_player1, m.team2_player2]
        : [m.team1_player1, m.team1_player2]
      ).filter(Boolean)
      partnerIds.forEach(id => { const p = getOrCreate(partnerMap, id); p.games++; if (won) p.wins++ })
      rivalIds.forEach(id   => { const p = getOrCreate(rivalMap,   id); p.games++; if (won) p.wins++ })
    })
    const topP = Object.values(partnerMap).sort((a, b) => b.games - a.games).slice(0, 4)
    const topR = Object.values(rivalMap).sort((a, b) => b.games - a.games).slice(0, 4)
    const allIds = [...new Set([...topP, ...topR].map(p => p.id).filter(Boolean))]
    if (allIds.length > 0) {
      const { data: profileData } = await supabase.from('profiles').select('id, name').in('id', allIds)
      const nameMap = Object.fromEntries((profileData || []).map(p => [p.id, p.name]))
      topP.forEach(p => { p.name = nameMap[p.id] ?? 'Joueur' })
      topR.forEach(p => { p.name = nameMap[p.id] ?? 'Joueur' })
    }
    setTopPartners(topP)
    setTopRivals(topR)
    setLoading(false)
  }

  // ── Phase 2: feed (friends + recent results + streaks) ───
  async function fetchFeedData() {
    setFeedLoading(true)

    // 1. Get friend IDs
    const { data: fs } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)

    const friendIds = (fs || []).map(f =>
      f.requester_id === profile.id ? f.addressee_id : f.requester_id
    )
    setHasFriends(friendIds.length > 0)

    const allParticipantIds = [profile.id, ...friendIds]

    // 2. Parallel fetches
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    const today    = new Date().toISOString().split('T')[0]
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)

    // Build OR clause for up to 20 participants
    const orParts = allParticipantIds.slice(0, 20).flatMap(id => [
      `team1_player1.eq.${id}`,
      `team1_player2.eq.${id}`,
      `team2_player1.eq.${id}`,
      `team2_player2.eq.${id}`,
    ])

    const [
      { data: recentMatches },
      { data: friendProfiles },
      { data: upcomingSessions },
      { data: topProfiles },
    ] = await Promise.all([
      supabase
        .from('valid_matches')
        .select('*')
        .or(orParts.join(','))
        .gte('played_at', twoWeeksAgo.toISOString())
        .not('winner_team', 'is', null)
        .order('played_at', { ascending: false })
        .limit(60),
      friendIds.length > 0
        ? supabase.from('profiles').select('id, name, avatar_url').in('id', friendIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from('sessions')
        .select('id, date, time, location, title, max_players, session_participants(user_id)')
        .gte('date', today)
        .lte('date', nextWeek.toISOString().split('T')[0])
        .neq('status', 'cancelled')
        .order('date')
        .order('time'),
      supabase
        .from('profiles')
        .select('id, name, avatar_url, rank_score')
        .not('rank_score', 'is', null)
        .order('rank_score', { ascending: false })
        .limit(3),
    ])

    // 3. Enrich: player names + session infos
    const playerIds = [...new Set(
      (recentMatches || []).flatMap(m =>
        [m.team1_player1, m.team1_player2, m.team2_player1, m.team2_player2].filter(Boolean)
      )
    )]
    const sessionIds = [...new Set((recentMatches || []).map(m => m.session_id).filter(Boolean))]

    const [{ data: playerData }, { data: sessionInfos }] = await Promise.all([
      playerIds.length > 0
        ? supabase.from('profiles').select('id, name, avatar_url').in('id', playerIds)
        : Promise.resolve({ data: [] }),
      sessionIds.length > 0
        ? supabase.from('sessions').select('id, date, time, location, title').in('id', sessionIds)
        : Promise.resolve({ data: [] }),
    ])

    const profileMap    = Object.fromEntries((playerData    || []).map(p => [p.id, p]))
    const friendMap     = Object.fromEntries((friendProfiles|| []).map(p => [p.id, p]))
    const sessionInfoMap= Object.fromEntries((sessionInfos  || []).map(s => [s.id, s]))

    const items = []

    // 4. Match result items — grouped by session
    const matchesBySession = {}
    ;(recentMatches || []).forEach(m => {
      const key = m.session_id || `solo-${m.id}`
      if (!matchesBySession[key]) {
        matchesBySession[key] = {
          matches:     [],
          session:     m.session_id ? sessionInfoMap[m.session_id] : null,
          timestamp:   m.played_at,
          isMySession: false,
        }
      }
      matchesBySession[key].matches.push({
        ...m,
        t1p1: profileMap[m.team1_player1] ?? null,
        t1p2: profileMap[m.team1_player2] ?? null,
        t2p1: profileMap[m.team2_player1] ?? null,
        t2p2: profileMap[m.team2_player2] ?? null,
      })
      if ([m.team1_player1, m.team1_player2, m.team2_player1, m.team2_player2].includes(profile.id)) {
        matchesBySession[key].isMySession = true
      }
    })
    // Max 3 sessions de résultats, les plus récentes d'abord
    Object.entries(matchesBySession)
      .map(([key, data]) => ({ id: `match-${key}`, type: 'match_result', ...data }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 3)
      .forEach(item => items.push(item))

    // 5. Friend upcoming session items — groupées par session, sans les parties complètes, max 3
    const myUpcomingIds = new Set(
      (upcomingSessions || [])
        .filter(s => s.session_participants?.some(p => p.user_id === profile.id))
        .map(s => s.id)
    )
    const sessToFriends = {}
    friendIds.forEach(friendId => {
      const friend = friendMap[friendId]
      if (!friend) return
      const sess = (upcomingSessions || []).find(s =>
        s.session_participants?.some(p => p.user_id === friendId)
      )
      if (!sess) return
      const isFull = (sess.session_participants?.length ?? 0) >= sess.max_players
      if (isFull || myUpcomingIds.has(sess.id)) return
      if (!sessToFriends[sess.id]) sessToFriends[sess.id] = { session: sess, friends: [] }
      sessToFriends[sess.id].friends.push({ id: friendId, name: friend.name, avatarUrl: friend.avatar_url })
    })
    Object.values(sessToFriends)
      .sort((a, b) => new Date(`${a.session.date}T${a.session.time}`) - new Date(`${b.session.date}T${b.session.time}`))
      .slice(0, 3)
      .forEach(({ session, friends }) => {
        items.push({
          id:       `friend-sess-${session.id}`,
          type:     'friend_session',
          friends,
          session,
          timestamp: new Date(`${session.date}T${session.time}`).toISOString(),
        })
      })

    // 6. Streak items (user + friends, ≥ 3 consecutive wins)
    const computeStreak = (pid, matches) => {
      const mine = matches
        .filter(m => [m.team1_player1, m.team1_player2, m.team2_player1, m.team2_player2].includes(pid))
        .slice(0, 5)
      if (mine.length < 3) return null
      const results = mine.map(m => {
        const isT1 = m.team1_player1 === pid || m.team1_player2 === pid
        return (isT1 && m.winner_team === 1) || (!isT1 && m.winner_team === 2)
      })
      const last = results[0]
      let count = 0
      for (const r of results) { if (r === last) count++; else break }
      return count >= 3 ? { count, isWin: last, timestamp: mine[0]?.played_at } : null
    }

    const myStreak = computeStreak(profile.id, recentMatches || [])
    if (myStreak && myStreak.isWin) {
      items.push({
        id:        `streak-${profile.id}`,
        type:      'streak',
        player:    { id: profile.id, name: profile.name, avatarUrl: profile.avatar_url },
        isMine:    true,
        ...myStreak,
      })
    }
    friendIds.forEach(friendId => {
      const s = computeStreak(friendId, recentMatches || [])
      if (!s || !s.isWin) return
      const friend = friendMap[friendId]
      items.push({
        id:     `streak-${friendId}`,
        type:   'streak',
        player: { id: friendId, name: friend?.name ?? 'Joueur', avatarUrl: friend?.avatar_url ?? null },
        isMine: false,
        ...s,
      })
    })

    // 7. Top 3 card (always, pinned at end)
    if ((topProfiles || []).length >= 3) {
      items.push({
        id:        'top3',
        type:      'top3',
        players:   topProfiles.slice(0, 3),
        timestamp: new Date(0).toISOString(), // pin to bottom
      })
    }

    // 8. Sort: friend_session first (soonest date), then recency, top3 last
    items.sort((a, b) => {
      if (a.type === 'top3') return 1
      if (b.type === 'top3') return -1
      if (a.type === 'friend_session' && b.type !== 'friend_session') return -1
      if (b.type === 'friend_session' && a.type !== 'friend_session') return  1
      return new Date(b.timestamp) - new Date(a.timestamp)
    })

    setFeedItems(items)
    setFeedLoading(false)
  }

  const handleKudos = (id) => setKudosGiven(prev => ({ ...prev, [id]: !prev[id] }))

  const eloScore  = profile?.rank_score ?? 1000
  const eloDelta  = profile?.rank_score_delta ?? 0
  const winRate   = myStats.played > 0 ? Math.round((myStats.wins / myStats.played) * 100) : 0
  const levelLabel = LEVEL_SHORT[profile?.level] ?? ''
  const myFirstName = profile?.name?.split(' ')[0] ?? 'Joueur'

  const chartPoints = chartTab === 'elo' ? eloHistory : ptsHistory
  const playersList = playersTab === 'partners' ? topPartners : topRivals

  return (
    <div className="-mx-4 -mt-6">

      {/* ── Banner ─────────────────────────────────────── */}
      <div style={{ background: '#14532d', padding: '28px 20px 44px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position:'absolute', borderRadius:'50%', width:210, height:210, right:-50, top:-70, background:'rgba(255,255,255,0.04)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', borderRadius:'50%', width:100, height:100, right:30, top:5,   background:'rgba(255,255,255,0.04)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', borderRadius:'50%', width:150, height:150, right:10, bottom:-90, background:'rgba(255,255,255,0.03)', pointerEvents:'none' }} />
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:12, color:'#6B9B7A', fontWeight:500, letterSpacing:'0.05em', marginBottom:4 }}>Bonjour,</div>
              <div style={{ fontSize:34, fontWeight:500, color:'#fff', lineHeight:1.05 }}>{myFirstName}</div>
            </div>
            <div style={{ width:48, height:48, background:'rgba(255,255,255,0.08)', borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>🎾</div>
          </div>
          <div style={{ display:'flex', gap:7, marginTop:12, flexWrap:'wrap' }}>
            {levelLabel && (
              <div style={{ background:'rgba(255,255,255,0.1)', color:'#90C9A0', fontSize:11, fontWeight:500, padding:'5px 11px', borderRadius:999, display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ width:5, height:5, borderRadius:'50%', background:'#4ade80' }} />
                {levelLabel}
              </div>
            )}
            {eloRank && myStats.played > 0 && (
              <div style={{ background:'rgba(251,191,36,0.15)', color:'#fbbf24', fontSize:11, fontWeight:500, padding:'5px 11px', borderRadius:999 }}>
                ✦ #{eloRank} ELO
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Sheet ──────────────────────────────────────── */}
      <div style={{ background:'#F5F4F0', borderRadius:'24px 24px 0 0', marginTop:-20, padding:'18px 14px 32px', minHeight:'100vh', position:'relative', zIndex:2 }}>

        {/* Buttons */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8, marginBottom:18 }}>
          <Link to="/sessions/new"
            style={{ background:'#14532d', color:'#fff', fontSize:13, fontWeight:500, border:'none', borderRadius:13, padding:'12px 14px', display:'flex', alignItems:'center', gap:7, textDecoration:'none' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Organiser une partie
          </Link>
          <Link to="/sessions"
            style={{ background:'#fff', color:'#374151', fontSize:13, fontWeight:500, border:'0.5px solid #E5E7EB', borderRadius:13, padding:'12px 14px', textDecoration:'none', whiteSpace:'nowrap', display:'flex', alignItems:'center' }}
          >
            Voir tout
          </Link>
        </div>

        {/* Photo nudge */}
        {!profile?.avatar_url && <PhotoNudge />}

        {/* Mes prochaines parties */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ fontSize:13, fontWeight:500, color:'#111827' }}>Mes prochaines parties</div>
        </div>

        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'32px 0' }}>
            <div className="w-6 h-6 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : upcomingSessions.length === 0 ? (
          <div style={{ background:'#fff', borderRadius:14, border:'0.5px dashed #D1D5DB', padding:16, textAlign:'center', marginBottom:14 }}>
            <div style={{ fontSize:20, marginBottom:5 }}>📅</div>
            <div style={{ fontSize:12, color:'#6B7280', marginBottom:6 }}>Vous n'êtes inscrit à aucune partie à venir</div>
            <Link to="/sessions"
              style={{ fontSize:11, fontWeight:500, color:'#14532d', background:'#DCFCE7', border:'none', borderRadius:999, padding:'6px 14px', textDecoration:'none', display:'inline-block' }}
            >Rejoindre une partie →</Link>
          </div>
        ) : (
          <div style={{ marginBottom:14 }}>
            {upcomingSessions.map(s => <SessionCard key={s.id} session={s} userId={user?.id} />)}
            {totalUpcoming > 5 && (
              <Link to="/sessions"
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 0', fontSize:11, color:'#6B7280', textDecoration:'none' }}
              >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                {totalUpcoming - 5} autre{totalUpcoming - 5 > 1 ? 's' : ''} à venir
              </Link>
            )}
          </div>
        )}

        {/* ── Fil d'actu ─────────────────────────────────── */}
        <ActivityFeed
          items={feedItems}
          loading={feedLoading}
          myId={profile?.id}
          kudosGiven={kudosGiven}
          onKudos={handleKudos}
        />

        {/* ── Sections nouveau joueur (0 partie jouée) ─────── */}
        {!loading && myStats.played === 0 && !hasFriends && <FindFriendsCard />}
        {!loading && myStats.played === 0 && (
          <FirstStepsCard
            hasJoinedSession={upcomingSessions.length > 0}
            hasFriends={hasFriends}
          />
        )}

        {/* Mes stats 2×2 */}
        {!loading && myStats.played > 0 && (
          <>
            <div style={{ fontSize:13, fontWeight:500, color:'#111827', marginBottom:8 }}>Mes stats</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,minmax(0,1fr))', gap:8, marginBottom:14 }}>
              {[
                {
                  val: eloScore,
                  lbl: 'Score ELO',
                  badge: eloDelta !== 0 ? `${eloDelta > 0 ? '+' : ''}${eloDelta} dernier match` : `${myStats.played} partie${myStats.played > 1 ? 's' : ''}`,
                  badgeGood: eloDelta > 0,
                },
                {
                  val: `${winRate}%`,
                  lbl: 'Taux de victoire',
                  badge: myStats.played > 0 ? `sur ${myStats.played} partie${myStats.played > 1 ? 's' : ''}` : '—',
                  badgeGood: winRate >= 50,
                },
                {
                  val: eloRank ? `#${eloRank}` : '—',
                  lbl: 'Classement ELO',
                  badge: myStats.played > 0 ? 'classement général' : 'après 1ère partie',
                  badgeGood: false,
                },
                {
                  val: myStats.points,
                  lbl: 'Points classiques',
                  badge: myStats.played > 0 ? `${myStats.wins}V / ${myStats.losses}D` : '—',
                  badgeGood: false,
                },
              ].map((s, i) => (
                <div key={i} style={{ background:'#fff', borderRadius:13, border:'0.5px solid #E5E7EB', padding:12 }}>
                  <div style={{ fontSize:22, fontWeight:500, color:'#111827', lineHeight:1 }}>{s.val}</div>
                  <div style={{ fontSize:10, color:'#6B7280', marginTop:3 }}>{s.lbl}</div>
                  <div style={{ fontSize:9, fontWeight:500, padding:'2px 6px', borderRadius:999, marginTop:5, display:'inline-block',
                    background: s.badgeGood ? '#DCFCE7' : '#F3F4F6',
                    color:      s.badgeGood ? '#166534' : '#6B7280',
                  }}>{s.badge}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Évolution */}
        {!loading && myStats.played > 0 && (
          <div style={{ background:'#fff', borderRadius:13, border:'0.5px solid #E5E7EB', padding:'12px 12px 8px', marginBottom:14, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <div style={{ fontSize:13, fontWeight:500, color:'#111827' }}>Évolution</div>
              <div style={{ display:'flex', gap:3 }}>
                {['elo','pts'].map(t => (
                  <button key={t} onClick={() => setChartTab(t)}
                    style={{
                      fontSize:10, fontWeight:500, padding:'4px 10px', borderRadius:999,
                      border: `0.5px solid ${chartTab === t ? '#14532d' : '#E5E7EB'}`,
                      background: chartTab === t ? '#14532d' : 'none',
                      color:      chartTab === t ? '#fff' : '#6B7280',
                      cursor:'pointer',
                    }}
                  >{t === 'elo' ? 'ELO' : 'Points'}</button>
                ))}
              </div>
            </div>
            <EvoChart points={chartPoints} />
          </div>
        )}

        {/* Partenaires & Rivaux */}
        {!loading && myStats.played > 0 && (
          <>
            <div style={{ fontSize:13, fontWeight:500, color:'#111827', marginBottom:8 }}>Partenaires &amp; Rivaux</div>
            <div style={{ background:'#fff', borderRadius:13, border:'0.5px solid #E5E7EB', overflow:'hidden', marginBottom:14 }}>
              <div style={{ display:'flex', borderBottom:'0.5px solid #E5E7EB' }}>
                {[['partners','Partenaires'],['rivals','Rivaux']].map(([key, label]) => (
                  <button key={key} onClick={() => setPlayersTab(key)}
                    style={{
                      flex:1, padding:9, fontSize:11, fontWeight:500, background:'none', border:'none', cursor:'pointer',
                      color:        playersTab === key ? '#14532d' : '#6B7280',
                      borderBottom: `2px solid ${playersTab === key ? '#14532d' : 'transparent'}`,
                      marginBottom: '-1px',
                    }}
                  >{label}</button>
                ))}
              </div>
              {playersList.length === 0 ? (
                <div style={{ padding:20, textAlign:'center', fontSize:11, color:'#9CA3AF' }}>
                  Jouez des parties pour voir vos stats ici
                </div>
              ) : playersList.map((p, i) => {
                const pWinRate = p.games > 0 ? Math.round((p.wins / p.games) * 100) : 0
                const pLosses  = p.games - p.wins
                const initials = (p.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 1)
                const color    = avatarColor(p.id || '')
                return (
                  <Link key={p.id} to={`/players/${p.id}`}
                    style={{ display:'flex', alignItems:'center', gap:9, padding:'9px 12px', borderBottom: i < playersList.length - 1 ? '0.5px solid #E5E7EB' : 'none', textDecoration:'none' }}
                  >
                    <div style={{ fontSize:11, color:'#9CA3AF', width:14, textAlign:'center', flexShrink:0 }}>{i + 1}</div>
                    <div style={{ width:30, height:30, borderRadius:9, background:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:500, color:'#fff', flexShrink:0 }}>
                      {initials}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:'#111827' }}>{p.name}</div>
                      <div style={{ fontSize:10, color:'#6B7280', marginTop:1 }}>
                        {playersTab === 'partners'
                          ? `${p.games} partie${p.games > 1 ? 's' : ''} ensemble`
                          : `${p.games} confrontation${p.games > 1 ? 's' : ''}`}
                      </div>
                    </div>
                    {playersTab === 'partners' ? (
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:12, fontWeight:500, color:'#14532d' }}>{pWinRate}%</div>
                        <div style={{ fontSize:9, color:'#9CA3AF', marginTop:1 }}>victoires</div>
                        <div style={{ width:44, height:4, background:'#E5E7EB', borderRadius:2, overflow:'hidden', marginTop:3 }}>
                          <div style={{ width:`${pWinRate}%`, height:'100%', background:'#14532d', borderRadius:2 }} />
                        </div>
                      </div>
                    ) : (
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', flexShrink:0 }}>
                        <div style={{ display:'flex', gap:3 }}>
                          <span style={{ fontSize:9, fontWeight:500, padding:'1px 5px', borderRadius:999, background:'#DCFCE7', color:'#166534' }}>{p.wins}V</span>
                          <span style={{ fontSize:9, fontWeight:500, padding:'1px 5px', borderRadius:999, background:'#FEE2E2', color:'#B91C1C' }}>{pLosses}D</span>
                        </div>
                        <div style={{ fontSize:9, color:'#9CA3AF', marginTop:3 }}>
                          {p.wins > pLosses ? 'Avantage' : p.wins === pLosses ? 'Égalité' : 'Défavorable'}
                        </div>
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          </>
        )}

        {/* Sign out */}
        <div style={{ textAlign:'center', paddingTop:4 }}>
          <button onClick={signOut} style={{ fontSize:11, color:'#9CA3AF', background:'none', border:'none', cursor:'pointer' }}>
            Se déconnecter
          </button>
        </div>

      </div>
    </div>
  )
}
