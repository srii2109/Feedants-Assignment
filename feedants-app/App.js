import * as Clipboard from 'expo-clipboard';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const USER_ID = 'user-intern-demo';

const P = {
  teal:      '#087f88',
  tealDark:  '#065f68',
  tealLight: '#e0f7f8',
  navy:      '#0c1e38',
  navyLight: '#1a3358',
  white:     '#ffffff',
  bg:        '#f0f4f8',
  card:      '#ffffff',
  border:    '#dde6ed',
  muted:     '#64748b',
  green:     '#059669',
  greenBg:   '#d1fae5',
  amber:     '#d97706',
  amberBg:   '#fef3c7',
  gold:      '#f59e0b',
  purple:    '#7c3aed',
};

const money = (n) => `\u20B9\u00A0${n.toLocaleString('en-IN')}`;
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

// ─── Small reusable components ────────────────────────────────────────────────

function Divider() {
  return <View style={s.divider} />;
}

function Card({ children, style }) {
  return <View style={[s.card, style]}>{children}</View>;
}

function SectionTitle({ children }) {
  return <Text style={s.sectionTitle}>{children}</Text>;
}

function Avatar({ initials, color, size = 56 }) {
  return (
    <View style={[s.avatar, { backgroundColor: color, width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[s.avatarTxt, { fontSize: size * 0.32 }]}>{initials}</Text>
    </View>
  );
}

function DateCell({ icon, label, iso, color, right, bottom }) {
  return (
    <View style={[s.dateCell, right && { borderRightWidth: 1, borderRightColor: P.border }, bottom && { borderBottomWidth: 1, borderBottomColor: P.border }]}>
      <View style={[s.dateIcon, { backgroundColor: color + '20' }]}>
        <Text style={{ fontSize: 17 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.dateLabel}>{label}</Text>
        <Text style={[s.dateValue, { color }]}>{fmtDate(iso)}</Text>
        <Text style={s.dateTime}>{fmtTime(iso)}</Text>
      </View>
    </View>
  );
}

function NavItem({ icon, label, active }) {
  return (
    <TouchableOpacity style={s.navItem}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={[s.navLabel, active && { color: P.teal, fontWeight: '700' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [comp, setComp] = useState(null);
  const [registered, setRegistered] = useState(false);
  const [regOpen, setRegOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [tab, setTab] = useState('about');
  const [expanded, setExpanded] = useState(false);
  const [lang, setLang] = useState('ENG');
  const [copied, setCopied] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const [modal, setModal] = useState({ visible: false, title: '', body: '' });
  const [showTestimonials, setShowTestimonials] = useState(false);

  // Animated pulse for hurry badge
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 600, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulse, { toValue: 1,    duration: 600, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, []);

  // Load data from MySQL backend
  useEffect(() => {
    fetch(`${API_URL}/competitions/classical-dance?userId=${USER_ID}`)
      .then(r => { if (!r.ok) throw new Error('bad response'); return r.json(); })
      .then(data => {
        setComp(data.competition);
        setRegistered(data.registered ?? false);
        setRegOpen(data.registrationOpen ?? true);
      })
      .catch(err => console.warn('API unavailable:', err.message))
      .finally(() => setLoading(false));
  }, []);

  // Countdown tick every second
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const countdown = useMemo(() => {
    if (!comp) return '--d : --h : --m : --s';
    const diff = Math.max(0, new Date(comp.registrationClosesAt).getTime() - tick);
    const sec = Math.floor(diff / 1000);
    const p = (n) => String(n).padStart(2, '0');
    return [
      { val: p(Math.floor(sec / 86400)),               unit: 'd' },
      { val: p(Math.floor((sec % 86400) / 3600)),       unit: 'h' },
      { val: p(Math.floor((sec % 3600) / 60)),          unit: 'm' },
      { val: p(sec % 60),                               unit: 's' },
    ];
  }, [comp, tick]);

  const openModal = useCallback((title, body) => setModal({ visible: true, title, body }), []);
  const closeModal = useCallback(() => setModal(m => ({ ...m, visible: false })), []);

  const handleRegister = async () => {
    if (!comp || registered || !regOpen || registering) return;
    setRegistering(true);
    try {
      const r = await fetch(`${API_URL}/competitions/${comp.id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER_ID }),
      });
      const data = await r.json();
      if (!r.ok) { Alert.alert('Notice', data.message ?? 'Registration failed.'); return; }
      setRegistered(true);
      setComp(prev => prev ? { ...prev, booked: data.booked ?? prev.booked + 1 } : prev);
      openModal('🎉 Registration Successful!', 'Your spot is reserved! Upload your submission when the window opens on ' + fmtDate(comp.submissionStartsAt) + '.');
    } catch {
      Alert.alert('Error', 'Cannot reach server. Is the backend running on port 4000?');
    } finally {
      setRegistering(false);
    }
  };

  const copyLink = async () => {
    if (!comp) return;
    await Clipboard.setStringAsync(comp.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.loadScreen}>
        <View style={s.loadCard}>
          <ActivityIndicator size="large" color={P.teal} />
          <Text style={s.loadTitle}>Loading Competition...</Text>
          <Text style={s.loadSub}>Fetching live data from MySQL server</Text>
        </View>
      </View>
    );
  }

  // ── Error screen ────────────────────────────────────────────────────────────
  if (!comp) {
    return (
      <View style={s.loadScreen}>
        <Text style={{ fontSize: 48 }}>⚠️</Text>
        <Text style={{ color: P.navy, fontWeight: '800', fontSize: 17, marginTop: 16 }}>Competition unavailable</Text>
        <Text style={{ color: P.muted, marginTop: 8, textAlign: 'center', paddingHorizontal: 30 }}>Make sure the backend server is running on port 4000 and MySQL is connected.</Text>
      </View>
    );
  }

  const isHIN = lang === 'HIN';
  const spotsLeft = Math.max(0, comp.capacity - comp.booked);
  const fillPct = Math.min(100, (comp.booked / comp.capacity) * 100);

  const tabContent = {
    about:   comp.description,
    judging: comp.judgingParameters,
    rules:   comp.rulesEligibility,
  };
  const tabLabels = isHIN
    ? { about: 'प्रतियोगिता के बारे में', judging: 'निर्णय के मानदंड', rules: 'नियम और पात्रता' }
    : { about: 'About Competition',       judging: 'Judging Parameters',  rules: 'Rules & Eligibility' };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.page}>

        {/* ══ HERO HEADER ══════════════════════════════════════════════════════ */}
        <View style={s.hero}>
          {/* Top nav */}
          <View style={s.heroNav}>
            <TouchableOpacity style={s.backRow}>
              <Text style={s.backArrow}>←</Text>
              <Text style={s.backTxt}>{isHIN ? 'वापस' : 'Go back'}</Text>
            </TouchableOpacity>
            <View style={s.langRow}>
              {['ENG', 'HIN'].map(l => (
                <TouchableOpacity key={l} onPress={() => setLang(l)} style={[s.langPill, lang === l && s.langPillOn]}>
                  <Text style={[s.langTxt, lang === l && s.langTxtOn]}>{l === 'ENG' ? 'ENG' : 'हिंदी'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Badges */}
          <View style={s.heroBadges}>
            <View style={s.heroBadge}><Text style={s.heroBadgeTxt}>{comp.category}</Text></View>
            <View style={s.heroBadge}><Text style={s.heroBadgeTxt}>{comp.type}</Text></View>
            {comp.hasCertificate && <View style={[s.heroBadge, { backgroundColor: 'rgba(255,215,0,0.25)' }]}><Text style={s.heroBadgeTxt}>🏆 Certificate</Text></View>}
          </View>

          {/* Title */}
          <Text style={s.heroTitle}>{comp.title}</Text>

          {/* Stats row */}
          <View style={s.heroStats}>
            <View style={{ flex: 1 }}>
              <Text style={s.heroStatLabel}>{isHIN ? 'पुरस्कार राशि' : 'Prize Pool'}</Text>
              <Text style={s.heroStatValue}>{money(comp.prizePool)}</Text>
            </View>
            <View style={s.heroStatSep} />
            <View style={{ flex: 1 }}>
              <Text style={s.heroStatLabel}>{isHIN ? 'प्रवेश शुल्क' : 'Entry Fee'}</Text>
              <Text style={s.heroStatValue}>{money(comp.entryFee)}</Text>
            </View>
            <View style={s.heroStatSep} />
            <View style={{ flex: 1.3 }}>
              <Text style={s.heroStatLabel}>{isHIN ? `केवल ${spotsLeft} स्थान शेष` : `Only ${spotsLeft} spots left`}</Text>
              <View style={s.miniBar}><View style={[s.miniBarFill, { width: `${fillPct}%` }]} /></View>
              <Text style={s.heroStatSub}>{comp.booked}/{comp.capacity} {isHIN ? 'बुक' : 'Booked'}</Text>
            </View>
          </View>

          {registered && (
            <View style={s.regBanner}>
              <Text style={s.regBannerTxt}>✓ {isHIN ? 'आप पंजीकृत हैं!' : 'You are registered!'}</Text>
            </View>
          )}
        </View>

        {/* ══ COUNTDOWN ════════════════════════════════════════════════════════ */}
        <Card style={s.countdownCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 20 }}>⏳</Text>
            <Text style={s.countdownLabel}>{isHIN ? 'पंजीकरण समाप्त होने में' : 'Registration closes in'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
            {countdown.map((item, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                <View style={{ alignItems: 'center' }}>
                  <View style={s.countBlock}>
                    <Text style={s.countNum}>{item.val}</Text>
                  </View>
                  <Text style={s.countUnit}>{item.unit}</Text>
                </View>
                {i < 3 && <Text style={s.countSep}>:</Text>}
              </View>
            ))}
            <Animated.View style={{ transform: [{ scale: pulse }], marginLeft: 8 }}>
              <View style={s.hurryBadge}>
                <Text style={s.hurryTxt}>⏰ {isHIN ? 'जल्दी करें!' : 'Hurry up!'}</Text>
              </View>
            </Animated.View>
          </View>
        </Card>

        {/* ══ JUDGE ════════════════════════════════════════════════════════════ */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Avatar initials={comp.judge.avatarInitials} color={comp.judge.avatarColor} size={68} />
            <View style={{ flex: 1 }}>
              <Text style={s.judgeRole}>{isHIN ? 'न्यायाधीश' : 'Judge'}</Text>
              <Text style={s.judgeName}>{comp.judge.name}</Text>
              <Text style={s.muted}>{comp.judge.specialty}</Text>
              <Text style={s.muted}>{comp.judge.experience}</Text>
            </View>
            <TouchableOpacity style={{ alignItems: 'center', gap: 5 }}
              onPress={() => openModal(`🎥 ${comp.judge.name}`, comp.judge.bio)}>
              <View style={s.playBtn}>
                <Text style={s.playIcon}>▶</Text>
              </View>
              <Text style={[s.muted, { textAlign: 'center', fontSize: 10 }]}>{isHIN ? 'परिचय\nवीडियो' : 'Intro\nVideo'}</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* ══ IMPORTANT DATES ══════════════════════════════════════════════════ */}
        <Card>
          <SectionTitle>{isHIN ? '📅 महत्वपूर्ण तिथियां' : '📅 Important Dates'}</SectionTitle>
          <View style={s.dateGrid}>
            <DateCell icon="📋" label={isHIN ? 'पहले पंजीकृत करें' : 'Register Before'} iso={comp.registrationClosesAt} color={P.teal}   right bottom />
            <DateCell icon="🚀" label={isHIN ? 'सबमिशन शुरू' : 'Submission Starts'}     iso={comp.submissionStartsAt}   color={P.green}         bottom />
            <DateCell icon="📤" label={isHIN ? 'सबमिशन समाप्त' : 'Submission Ends'}     iso={comp.submissionEndsAt}     color={P.amber}  right />
            <DateCell icon="🏆" label={isHIN ? 'परिणाम तिथि' : 'Result Date'}           iso={comp.resultDate}           color={P.purple} />
          </View>
        </Card>

        {/* ══ PREVIOUS WINNERS ═════════════════════════════════════════════════ */}
        <View style={{ paddingHorizontal: 14 }}>
          <SectionTitle>{isHIN ? '🏅 पिछले विजेता' : '🏅 Previous Winners'}</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {comp.winners.map((w, i) => (
              <TouchableOpacity key={i} style={s.winCard} activeOpacity={0.85}
                onPress={() => openModal(`🏅 ${w.name}`, `${w.place} — ${w.edition} Edition\n\nCongratulations to ${w.name} for their outstanding performance!`)}>
                <View style={[s.winBanner, { backgroundColor: w.avatarColor }]}>
                  <Text style={s.winInitials}>{w.avatarInitials}</Text>
                  <View style={s.winPlayBubble}><Text style={{ color: P.white, fontSize: 8 }}>▶</Text></View>
                </View>
                <View style={s.winInfo}>
                  <Text style={s.winName} numberOfLines={1}>{w.name}</Text>
                  <Text style={s.winPlace}>{w.place}</Text>
                  <Text style={[s.muted, { fontSize: 10 }]}>{w.edition}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ══ DETAILS TABS ═════════════════════════════════════════════════════ */}
        <Card>
          <View style={s.tabsRow}>
            {['about', 'judging', 'rules'].map(k => (
              <TouchableOpacity key={k} onPress={() => { setTab(k); setExpanded(false); }}
                style={[s.tabBtn, tab === k && s.tabBtnOn]}>
                <Text style={[s.tabTxt, tab === k && s.tabTxtOn]}>{tabLabels[k]}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.tabBody} numberOfLines={expanded ? undefined : 5}>{tabContent[tab]}</Text>
          <TouchableOpacity style={{ marginTop: 10, alignItems: 'center' }} onPress={() => setExpanded(e => !e)}>
            <Text style={{ color: P.teal, fontWeight: '700', fontSize: 13 }}>
              {expanded ? (isHIN ? 'कम देखें ∧' : 'View less ∧') : (isHIN ? 'और देखें ∨' : 'View more ∨')}
            </Text>
          </TouchableOpacity>
        </Card>

        {/* ══ REWARDS ══════════════════════════════════════════════════════════ */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Text style={s.sectionTitle}>{isHIN ? '🎁 पुरस्कार' : '🎁 Rewards'}</Text>
            <Text style={s.muted}>({isHIN ? 'सभी स्थान' : 'All Positions'})</Text>
          </View>
          {comp.rewards.map((r, i) => (
            <View key={i} style={[s.rewardRow, i === comp.rewards.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={{ fontSize: 20, width: 30 }}>{r.icon}</Text>
              <Text style={s.rewardPlace}>{r.place}</Text>
              <View style={[s.rewardBadge, i === 0 && { backgroundColor: P.amberBg }]}>
                <Text style={[s.rewardAmt, i === 0 && { color: P.amber }]}>{money(r.amount)}</Text>
              </View>
            </View>
          ))}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>{isHIN ? 'कुल पुरस्कार राशि' : 'Total Prize Pool'}</Text>
            <Text style={s.totalValue}>{money(comp.prizePool)}</Text>
          </View>
        </Card>

        {/* ══ DISCLAIMER ═══════════════════════════════════════════════════════ */}
        <View style={s.disclaimer}>
          <Text style={{ fontSize: 16, color: P.amber }}>ⓘ</Text>
          <Text style={s.disclaimerTxt}>
            <Text style={{ fontWeight: '800', color: P.navy }}>Disclaimer: </Text>
            {comp.disclaimer}
          </Text>
        </View>

        {/* ══ PAYMENT & TRUST ══════════════════════════════════════════════════ */}
        <Card>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            onPress={() => openModal('💰 ' + (isHIN ? 'पुरस्कार राशि' : 'Prize Money'), comp.paymentInfo?.prizeTransferMethod ?? 'Prize money transferred via UPI/Bank within 48 hours of result.')}>
            <View style={s.trustPlayBtn}><Text style={{ color: P.white, fontSize: 13 }}>▶</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: P.navy, fontSize: 13 }}>
                {isHIN ? 'पुरस्कार राशि कैसे मिलेगी?' : 'How will you receive prize money?'}
              </Text>
              <Text style={s.muted}>{isHIN ? 'वीडियो देखें' : 'Watch video to know more'}</Text>
            </View>
            <Text style={{ color: P.teal, fontSize: 20 }}>›</Text>
          </TouchableOpacity>

          <Divider />

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              onPress={() => openModal('🛡️ ' + (isHIN ? 'रिफंड नीति' : 'Refund Policy'), comp.paymentInfo?.refundPolicy ?? 'Full refund if competition is cancelled.')}>
              <Text style={{ fontSize: 22 }}>🛡️</Text>
              <Text style={{ fontSize: 12, color: P.muted }}>{isHIN ? 'रिफंड नीति' : 'Refund policy'}</Text>
            </TouchableOpacity>
            <View style={{ width: 1, height: 32, backgroundColor: P.border, marginHorizontal: 12 }} />
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 22 }}>🔒</Text>
              <View>
                <Text style={{ fontSize: 11, color: P.muted }}>{isHIN ? 'सुरक्षित भुगतान' : 'Secure payments'}</Text>
                <Text style={{ fontWeight: '900', fontSize: 13, color: P.navy }}>{comp.paymentInfo?.gateway ?? 'Razorpay'}</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* ══ REFER & EARN ═════════════════════════════════════════════════════ */}
        <View style={s.referCard}>
          <Text style={{ fontSize: 32 }}>📣</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.referTitle}>{isHIN ? 'रेफर करें और छूट पाएं' : 'Refer & Earn more discount'}</Text>
            <View style={s.referLinkRow}>
              <Text style={s.referLink} numberOfLines={1}>{comp.referralLink}</Text>
              <TouchableOpacity onPress={copyLink} style={s.copyBtn}>
                <Text style={s.copyTxt}>{copied ? '✓ Copied!' : 'Copy Link'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={s.referBtn}
            onPress={() => openModal('🎁 Referral Program', `Earn ${money(comp.referralEarning)} for every signup using your link!\n\nYour link:\n${comp.referralLink}`)}>
            <Text style={s.referBtnTxt}>{isHIN ? 'अभी रेफर करें' : 'Refer Now'}</Text>
            <Text style={s.referBtnSub}>{money(comp.referralEarning)}{isHIN ? ' / साइनअप' : ' / signup'}</Text>
          </TouchableOpacity>
        </View>

        {/* ══ TESTIMONIALS ═════════════════════════════════════════════════════ */}
        <TouchableOpacity style={s.testimonialsRow} activeOpacity={0.8} onPress={() => setShowTestimonials(v => !v)}>
          <Text style={{ fontSize: 22 }}>💬</Text>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ fontWeight: '800', color: P.navy, fontSize: 14 }}>
              {isHIN ? 'उपयोगकर्ताओं से सुनें' : 'Hear From Our Users'}
            </Text>
            <Text style={s.muted}>
              {isHIN ? 'प्रतिभागी क्या कहते हैं' : `${comp.testimonials.length} participant reviews`}
            </Text>
          </View>
          <Text style={{ fontSize: 22, color: P.teal, fontWeight: '700' }}>{showTestimonials ? '∧' : '›'}</Text>
        </TouchableOpacity>

        {showTestimonials && comp.testimonials.map((t, i) => (
          <Card key={i}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontWeight: '800', color: P.navy }}>{t.name}</Text>
              <Text style={{ color: P.gold, fontSize: 13 }}>{stars(t.rating)}</Text>
            </View>
            <Text style={{ color: P.muted, fontSize: 13, lineHeight: 20, fontStyle: 'italic' }}>"{t.text}"</Text>
          </Card>
        ))}

        {/* Ad slot */}
        <View style={s.adSlot}>
          <Text style={s.muted}>📢 Ad Here</Text>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ══ STICKY FOOTER CTA ════════════════════════════════════════════════ */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.ctaBtn, registered ? s.ctaReg : (!regOpen && s.ctaClosed)]}
          onPress={registered
            ? () => openModal('📤 Upload Submission', `Upload your classical dance video (MP4/MOV, max 500MB).\nSubmission window opens: ${fmtDate(comp.submissionStartsAt)}.`)
            : handleRegister}
          disabled={registering || (!registered && !regOpen)}
          activeOpacity={0.88}
        >
          {registering
            ? <ActivityIndicator color={P.white} />
            : (
              <>
                <Text style={s.ctaTxt}>
                  {registered
                    ? (isHIN ? '📤 सबमिशन अपलोड करें' : '📤 Upload Submission')
                    : regOpen
                      ? (isHIN ? '🎯 अभी रजिस्टर करें' : '🎯 Register Now')
                      : (isHIN ? 'पंजीकरण बंद' : 'Registration Closed')}
                </Text>
                <Text style={s.ctaSub}>
                  {registered
                    ? (isHIN ? 'पंजीकृत ✓' : 'Registered ✓')
                    : regOpen
                      ? (isHIN ? `प्रवेश शुल्क ${money(comp.entryFee)}` : `Entry fee ${money(comp.entryFee)}`)
                      : (isHIN ? 'अब प्रविष्टियां नहीं' : 'No more entries accepted')}
                </Text>
              </>
            )}
        </TouchableOpacity>

        {/* Bottom nav bar */}
        <View style={s.navBar}>
          <NavItem icon="🏠" label={isHIN ? 'होम' : 'Home'} />
          <NavItem icon="🔍" label={isHIN ? 'खोजें' : 'Explore'} />
          <View style={s.navAdd}>
            <Text style={s.navAddTxt}>＋</Text>
          </View>
          <NavItem icon="🏆" label={isHIN ? 'प्रतियोगिता' : 'Competitions'} active />
          <NavItem icon="👤" label={isHIN ? 'प्रोफ़ाइल' : 'Profile'} />
        </View>
      </View>

      {/* ══ BOTTOM SHEET MODAL ═══════════════════════════════════════════════ */}
      <Modal visible={modal.visible} transparent animationType="slide">
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{modal.title}</Text>
            <ScrollView style={{ maxHeight: 260 }}>
              <Text style={s.modalBody}>{modal.body}</Text>
            </ScrollView>
            <TouchableOpacity style={s.modalClose} onPress={closeModal}>
              <Text style={{ color: P.white, fontWeight: '800', fontSize: 15 }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: P.bg },
  page: { gap: 12, paddingBottom: 20 },
  muted: { color: P.muted, fontSize: 12 },
  divider: { height: 1, backgroundColor: P.border, marginVertical: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: P.navy },

  // Load / error screens
  loadScreen: { flex: 1, backgroundColor: P.bg, justifyContent: 'center', alignItems: 'center', padding: 30 },
  loadCard: { backgroundColor: P.white, borderRadius: 20, padding: 32, alignItems: 'center', gap: 12, width: '100%' },
  loadTitle: { fontSize: 16, fontWeight: '700', color: P.navy },
  loadSub: { fontSize: 12, color: P.muted },

  // Card
  card: { backgroundColor: P.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: P.border, marginHorizontal: 14, elevation: 2 },

  // Avatar
  avatar: { justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { color: P.white, fontWeight: '900' },

  // ── Hero ──
  hero: { backgroundColor: P.navy, paddingTop: 16, paddingBottom: 30, paddingHorizontal: 16 },
  heroNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backArrow: { fontSize: 22, color: P.white, fontWeight: '700' },
  backTxt: { fontSize: 15, fontWeight: '700', color: P.white },
  langRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 22, padding: 3, gap: 2 },
  langPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18 },
  langPillOn: { backgroundColor: P.teal },
  langTxt: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.65)' },
  langTxtOn: { color: P.white },
  heroBadges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
  heroBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  heroBadgeTxt: { color: P.white, fontSize: 11, fontWeight: '700' },
  heroTitle: { fontSize: 26, fontWeight: '900', color: P.white, marginBottom: 22, lineHeight: 32 },
  heroStats: { flexDirection: 'row', alignItems: 'flex-start' },
  heroStatLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 4 },
  heroStatValue: { color: P.white, fontSize: 20, fontWeight: '900' },
  heroStatSub: { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 2 },
  heroStatSep: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 10, marginTop: 4, height: 38 },
  miniBar: { height: 5, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden', marginVertical: 5 },
  miniBarFill: { height: '100%', backgroundColor: P.teal, borderRadius: 3 },
  regBanner: { marginTop: 16, backgroundColor: P.green, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 14, alignSelf: 'flex-start' },
  regBannerTxt: { color: P.white, fontWeight: '800', fontSize: 13 },

  // ── Countdown ──
  countdownCard: { gap: 0 },
  countdownLabel: { fontSize: 13, fontWeight: '700', color: P.navy, flex: 1 },
  countBlock: { backgroundColor: P.teal, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minWidth: 48, alignItems: 'center' },
  countNum: { color: P.white, fontSize: 22, fontWeight: '900' },
  countUnit: { color: P.muted, fontSize: 10, marginTop: 3, textAlign: 'center' },
  countSep: { color: P.teal, fontSize: 26, fontWeight: '900', marginBottom: 16 },
  hurryBadge: { backgroundColor: '#fff3cd', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: '#ffc107' },
  hurryTxt: { color: P.amber, fontWeight: '800', fontSize: 12 },

  // ── Judge ──
  judgeRole: { color: P.muted, fontSize: 11 },
  judgeName: { fontSize: 17, fontWeight: '800', color: P.navy, marginTop: 1 },
  playBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: P.tealLight, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: P.teal },
  playIcon: { color: P.teal, fontSize: 14, marginLeft: 2 },

  // ── Dates ──
  dateGrid: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: P.border, borderRadius: 12, overflow: 'hidden' },
  dateCell: { width: '50%', padding: 12, flexDirection: 'row', gap: 10, minHeight: 78 },
  dateIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  dateLabel: { color: P.muted, fontSize: 11 },
  dateValue: { fontWeight: '800', fontSize: 14, marginTop: 1 },
  dateTime: { color: P.muted, fontSize: 11 },

  // ── Winners ──
  winCard: { width: 126, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: P.border, backgroundColor: P.card },
  winBanner: { height: 72, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  winInitials: { color: P.white, fontSize: 24, fontWeight: '900' },
  winPlayBubble: { position: 'absolute', bottom: 5, right: 5, width: 18, height: 18, borderRadius: 9, backgroundColor: P.teal, justifyContent: 'center', alignItems: 'center' },
  winInfo: { padding: 8 },
  winName: { fontSize: 12, fontWeight: '800', color: P.navy },
  winPlace: { fontSize: 11, fontWeight: '700', color: P.teal, marginTop: 2 },

  // ── Tabs ──
  tabsRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: P.border, marginBottom: 12 },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 4, marginRight: 10, marginBottom: -1 },
  tabBtnOn: { borderBottomWidth: 3, borderBottomColor: P.teal },
  tabTxt: { fontSize: 11, color: P.muted, fontWeight: '600' },
  tabTxtOn: { color: P.teal, fontWeight: '800' },
  tabBody: { color: P.muted, fontSize: 13, lineHeight: 21 },

  // ── Rewards ──
  rewardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 10 },
  rewardPlace: { flex: 1, fontSize: 14, fontWeight: '700', color: P.navy },
  rewardBadge: { backgroundColor: P.tealLight, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  rewardAmt: { fontSize: 14, fontWeight: '900', color: P.teal },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: P.border },
  totalLabel: { fontSize: 13, fontWeight: '700', color: P.navy },
  totalValue: { fontSize: 16, fontWeight: '900', color: P.teal },

  // ── Disclaimer ──
  disclaimer: { marginHorizontal: 14, backgroundColor: '#fff8e1', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderColor: '#ffe082' },
  disclaimerTxt: { flex: 1, fontSize: 12, color: P.navy, lineHeight: 17 },

  // ── Trust ──
  trustPlayBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: P.teal, justifyContent: 'center', alignItems: 'center' },

  // ── Refer ──
  referCard: { marginHorizontal: 14, backgroundColor: P.greenBg, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#a7f3d0' },
  referTitle: { fontSize: 13, fontWeight: '800', color: P.navy, marginBottom: 6 },
  referLinkRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: P.white, borderRadius: 8, paddingLeft: 8, paddingVertical: 3, gap: 6, borderWidth: 1, borderColor: '#a7f3d0' },
  referLink: { flex: 1, fontSize: 10, color: P.teal },
  copyBtn: { backgroundColor: P.tealLight, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  copyTxt: { color: P.teal, fontWeight: '800', fontSize: 10 },
  referBtn: { backgroundColor: P.teal, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  referBtnTxt: { color: P.white, fontWeight: '900', fontSize: 12 },
  referBtnSub: { color: '#d1fae5', fontSize: 9, marginTop: 2 },

  // ── Testimonials ──
  testimonialsRow: { marginHorizontal: 14, backgroundColor: P.card, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: P.border },

  // ── Ad ──
  adSlot: { marginHorizontal: 14, backgroundColor: P.card, borderRadius: 12, borderWidth: 1, borderColor: P.border, borderStyle: 'dashed', padding: 16, alignItems: 'center' },

  // ── Footer ──
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: P.white, borderTopWidth: 1, borderTopColor: P.border, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  ctaBtn: { backgroundColor: P.teal, borderRadius: 12, paddingVertical: 12, alignItems: 'center', elevation: 4 },
  ctaReg: { backgroundColor: P.navyLight },
  ctaClosed: { backgroundColor: P.muted },
  ctaTxt: { color: P.white, fontSize: 16, fontWeight: '900' },
  ctaSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },
  navBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingHorizontal: 6 },
  navItem: { alignItems: 'center', paddingHorizontal: 2 },
  navLabel: { fontSize: 10, color: P.muted, marginTop: 2 },
  navAdd: { width: 46, height: 46, borderRadius: 23, backgroundColor: P.teal, justifyContent: 'center', alignItems: 'center', marginTop: -18, elevation: 4 },
  navAddTxt: { color: P.white, fontSize: 26 },

  // ── Modal ──
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: P.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: P.navy, marginBottom: 12 },
  modalBody: { fontSize: 14, color: P.muted, lineHeight: 22, marginBottom: 20 },
  modalClose: { backgroundColor: P.teal, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
});