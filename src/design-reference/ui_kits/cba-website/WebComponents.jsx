// Chase Bliss Audio — Website UI Kit Components
// chasebliss.com recreation
// Font: Poppins (Google Fonts) — confirmed

const LOGO_H = "https://images.squarespace-cdn.com/content/v1/622176a9b8d15d57ffbf5700/dc30d122-ba24-4732-a3cd-eaa2744c6b40/Chase+Bliss_Logo_Horizontal.png?format=750w";
const LOGOMARK = "https://www.chasebliss.com/s/Chase-Bliss_Logomark.svg";
const DBAH_SVG = "https://www.chasebliss.com/s/Chase-Bliss_Digital-brain-Analog-Heart.svg";

const PEDALS = [
  { name: "Brothers AM", tagline: "Twins of Tone", img: "https://images.squarespace-cdn.com/content/v1/622176a9b8d15d57ffbf5700/70f63cde-c41b-4812-97e0-fabf6038e2b3/Brothers+AM_Pedal_Chase+Bliss.jpg", href: "#" },
  { name: "Clean", tagline: "Creative Compressor", img: "https://images.squarespace-cdn.com/content/v1/622176a9b8d15d57ffbf5700/d7887652-68bb-4b1d-9950-c33f797daafc/Clean_Pedal_Chase+Bliss.jpg", href: "#" },
  { name: "Onward", tagline: "Dynamic Sampler", img: "https://images.squarespace-cdn.com/content/v1/622176a9b8d15d57ffbf5700/1715698764952-064VO3AOOUSG11NO6EZA/Onward_Pedal_Chase+Bliss.jpg", href: "#" },
  { name: "Lossy", tagline: "Artifacts on Demand", img: "https://images.squarespace-cdn.com/content/v1/622176a9b8d15d57ffbf5700/4bc76f1e-4496-4d6a-bf64-5f29d31557e5/Lossy_Pedal_Chase+Bliss_Goodhertz.jpg", href: "#" },
  { name: "MOOD MKII", tagline: "Instant Ambience", img: "https://images.squarespace-cdn.com/content/v1/622176a9b8d15d57ffbf5700/d5aa0de1-8bd9-4a68-98e1-ef053dd27e43/MOOD+MKII_Pedal_Chase+Bliss.jpg", href: "#mood" },
  { name: "Generation Loss MKII", tagline: "VHS Duplicator", img: "https://images.squarespace-cdn.com/content/v1/622176a9b8d15d57ffbf5700/9af770d6-2029-4a56-a13a-2f41ef6a72d6/Generation+Loss+MKII_Pedal_Chase+Bliss.jpg", href: "#" },
  { name: "blooper", tagline: "Bottomless Looper", img: "https://images.squarespace-cdn.com/content/v1/622176a9b8d15d57ffbf5700/699c5aa7-9de2-4461-9fa1-96f7b8dc8733/Blooper_Pedal_Chase+Bliss_2023.jpg", href: "#" },
  { name: "CXM 1978", tagline: "Vintage Studioverb", img: "https://images.squarespace-cdn.com/content/v1/622176a9b8d15d57ffbf5700/4b81257a-cccd-4bf1-b92e-b2183b441ec5/CXM+1978_Automatone_Pedal_Chase+Bliss.jpg", href: "#" },
];

const LIMITED = [
  { name: "Brothers AM", edition: "Monochrome Edition", img: "https://images.squarespace-cdn.com/content/v1/622176a9b8d15d57ffbf5700/c89d3fdf-1cb0-40ff-bc0f-43563ba55a0b/Brothers+AM_LE_Pedal_Chase+Bliss.jpg" },
  { name: "Lossy", edition: "Monochrome Edition", img: "https://images.squarespace-cdn.com/content/v1/622176a9b8d15d57ffbf5700/1d9df356-1c1e-467b-a396-0e77e5aec52e/Lossy_LE_Pedal_Chase+Bliss.jpg" },
];

const TEAM = [
  { name: "Joel Korte", role: "Founder", img: "https://images.squarespace-cdn.com/content/v1/622176a9b8d15d57ffbf5700/4e5cb177-d2e3-4163-a31b-b45e5cf7a243/Joel+Korte_Chase+Bliss.jpg" },
  { name: "Eric Nyffeler", role: "Art Director", img: "https://images.squarespace-cdn.com/content/v1/622176a9b8d15d57ffbf5700/a11a84a3-7a52-4a53-9d2c-86cae02b7133/Eric+Nyffeler_Chase+Bliss.jpg" },
  { name: "Courtney Berndt", role: "Community Manager", img: "https://images.squarespace-cdn.com/content/v1/622176a9b8d15d57ffbf5700/a9fd0330-dd2a-436b-a753-7b33038f5ae2/Courtney+Berndt_Chase+Bliss_2025.jpg" },
  { name: "Zack Warpinski", role: "Director of Operations", img: "https://images.squarespace-cdn.com/content/v1/622176a9b8d15d57ffbf5700/ea0af7e9-ab4d-4da3-ae57-5e5782876fe5/Zack+Warpinski_Chase+Bliss.jpg" },
  { name: "Charlie Carbiener", role: "Engineer", img: "https://images.squarespace-cdn.com/content/v1/622176a9b8d15d57ffbf5700/82f2e9da-dd5e-4ae1-90f2-b632a93f824f/Charlie+Carbiener_Chase+Bliss.jpg" },
  { name: "Paul Uhl", role: "MIDI Expert", img: "https://images.squarespace-cdn.com/content/v1/622176a9b8d15d57ffbf5700/98ef89cd-a51b-4003-bb07-fb44305b9892/Paul+Uhl_Chase+Bliss.jpg" },
];

// ── SiteNav ──────────────────────────────────────────────────
function SiteNav({ onNavigate, active }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const links = [
    { label: "Pedals", id: "pedals" },
    { label: "CHOMPI", id: "chompi" },
    { label: "Utility", id: "utility" },
    { label: "Merch", id: "merch" },
    { label: "Support", id: "support" },
    { label: "About", id: "about" },
  ];
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50, background: '#fff', borderBottom: '1px solid #e8e4dd' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72 }}>
        {/* Logo */}
        <a href="#" onClick={e => { e.preventDefault(); onNavigate('home'); }} style={{ display: 'flex', alignItems: 'center' }}>
          <img src={LOGO_H} alt="Chase Bliss" style={{ height: 28, width: 'auto' }} />
        </a>
        {/* Nav links */}
        <nav style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          {links.map(l => (
            <a key={l.id} href="#" onClick={e => { e.preventDefault(); onNavigate(l.id); }}
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14, fontWeight: 500, textDecoration: 'none',
                color: active === l.id ? '#000' : '#555',
                letterSpacing: '0.01em',
                borderBottom: active === l.id ? '1.5px solid #000' : '1.5px solid transparent',
                paddingBottom: 2,
              }}>
              {l.label}
            </a>
          ))}
        </nav>
        {/* Cart */}
        <a href="#" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, color: '#000', textDecoration: 'none' }}>0</a>
      </div>
    </header>
  );
}

// ── PedalCard ─────────────────────────────────────────────────
function PedalCard({ pedal, onClick, wide }) {
  const [hov, setHov] = React.useState(false);
  return (
    <div onClick={() => onClick && onClick(pedal)}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ overflow: 'hidden', background: '#f5f2ee' }}>
        <img src={pedal.img} alt={pedal.name}
          style={{ width: '100%', display: 'block', transition: 'transform 0.4s ease', transform: hov ? 'scale(1.03)' : 'scale(1)' }} />
      </div>
      <div>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: wide ? 22 : 18, color: '#000', lineHeight: 1.2 }}>{pedal.name}</div>
        {pedal.tagline && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#777', marginTop: 3 }}>{pedal.tagline}</div>}
        {pedal.edition && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: '#999', marginTop: 2 }}>{pedal.edition}</div>}
      </div>
    </div>
  );
}

// ── SiteFooter ────────────────────────────────────────────────
function SiteFooter() {
  const cols = [
    { heading: "Support", links: ["Manuals", "FAQs", "Policies", "Blog"] },
    { heading: "Company", links: ["Small Batch Bliss", "Bliss + Mortar", "Assets", "Newsletter sign up"] },
    { heading: "Social", links: ["YouTube", "Instagram", "TikTok", "Facebook", "Discord", "Twitter", "Bandcamp", "Soundcloud"] },
  ];
  return (
    <footer style={{ borderTop: '1px solid #e8e4dd', padding: '64px 32px 48px', background: '#fff' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 48, marginBottom: 64 }}>
          {cols.map(col => (
            <div key={col.heading}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#000', marginBottom: 16 }}>{col.heading}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {col.links.map(l => <a key={l} href="#" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: '#555', textDecoration: 'none' }}>{l}</a>)}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <img src={DBAH_SVG} alt="Digital Brain Analog Heart" style={{ height: 24, opacity: 0.7 }} />
          <a href="#"><img src={LOGOMARK} alt="Chase Bliss" style={{ height: 36, opacity: 0.5 }} /></a>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: '#aaa' }}>copyright 2026</div>
        </div>
      </div>
    </footer>
  );
}

// Export
Object.assign(window, {
  SiteNav, PedalCard, SiteFooter,
  PEDALS, LIMITED, TEAM,
  LOGO_H, LOGOMARK, DBAH_SVG,
});
