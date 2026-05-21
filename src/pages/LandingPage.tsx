import { useNavigate } from 'react-router-dom'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div style={{ background: '#FFFBF5', minHeight: '100vh', fontFamily: 'Nunito, sans-serif' }}>

      {/* NAVBAR */}
      <nav style={{ background: 'white', borderBottom: '1.5px solid #FED7AA', padding: '12px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'Fredoka One, cursive', fontSize: '26px', color: '#C2410C' }}>
          Animéaux 🐾
        </div>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#92400E', cursor: 'pointer' }} onClick={() => navigate('/search')}>Trouver un praticien</span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#92400E', cursor: 'pointer' }} onClick={() => navigate('/login')}>Connexion</span>
          <button onClick={() => navigate('/register')} style={{ background: '#F97316', color: 'white', border: 'none', borderRadius: '12px', padding: '10px 20px', fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: '14px', cursor: 'pointer' }}>
            Inscription
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ background: '#FFF7ED', padding: '60px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '40px' }}>
        <div style={{ flex: 1, maxWidth: '560px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'white', border: '1.5px solid #FED7AA', borderRadius: '999px', padding: '6px 16px', fontSize: '13px', fontWeight: 800, color: '#C2410C', marginBottom: '20px' }}>
            ⭐ Plus de 500 praticiens animaliers
          </div>
          <h1 style={{ fontFamily: 'Fredoka One, cursive', fontSize: '52px', lineHeight: 1.1, color: '#C2410C', marginBottom: '16px' }}>
            La santé de votre<br />
            <span style={{ color: '#F97316' }}>animal</span>, en 2 clics
          </h1>
          <p style={{ fontSize: '16px', color: '#92400E', lineHeight: 1.7, marginBottom: '28px', maxWidth: '460px' }}>
            Vétérinaires, toiletteurs, ostéopathes, comportementalistes… Trouvez le bon praticien et prenez rendez-vous facilement.
          </p>

          {/* BARRE DE RECHERCHE */}
          <div style={{ background: 'white', border: '1.5px solid #FED7AA', borderRadius: '16px', padding: '14px 18px', display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '18px' }}>🔍</span>
            <input placeholder="Vétérinaire, toiletteur..." style={{ flex: 1, border: 'none', outline: 'none', fontSize: '15px', color: '#92400E', background: 'transparent', fontFamily: 'Nunito, sans-serif' }} />
            <input placeholder="Paris, Lyon..." style={{ flex: 1, border: 'none', borderLeft: '1.5px solid #FED7AA', outline: 'none', fontSize: '15px', color: '#92400E', background: 'transparent', fontFamily: 'Nunito, sans-serif', paddingLeft: '12px' }} />
            <button onClick={() => navigate('/search')} style={{ background: '#F97316', color: 'white', border: 'none', borderRadius: '12px', padding: '10px 20px', fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: '14px', cursor: 'pointer' }}>
              Rechercher
            </button>
          </div>

          {/* PILLS ANIMAUX */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['🐕 Chien', '🐈 Chat', '🐇 Lapin', '🐦 Oiseau', '🐹 NAC'].map(a => (
              <button key={a} style={{ background: '#FFEDD5', border: 'none', borderRadius: '999px', padding: '8px 16px', fontFamily: 'Nunito, sans-serif', fontSize: '13px', fontWeight: 800, color: '#C2410C', cursor: 'pointer' }}>
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* STATS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { n: '500+', l: 'Praticiens' },
            { n: '4.8 ⭐', l: 'Note moyenne' },
            { n: '24h', l: 'Délai moyen' },
          ].map(s => (
            <div key={s.l} style={{ background: 'white', border: '1.5px solid #FED7AA', borderRadius: '16px', padding: '16px 24px', textAlign: 'center', minWidth: '110px' }}>
              <div style={{ fontFamily: 'Fredoka One, cursive', fontSize: '28px', color: '#F97316' }}>{s.n}</div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#92400E' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SPÉCIALITÉS */}
      <section style={{ padding: '60px 40px', background: 'white' }}>
        <h2 style={{ fontFamily: 'Fredoka One, cursive', fontSize: '36px', color: '#C2410C', textAlign: 'center', marginBottom: '36px' }}>
          Toutes les spécialités 🐾
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
          {[
            { icon: '🩺', name: 'Vétérinaire généraliste', count: '210' },
            { icon: '🚨', name: 'Vétérinaire urgentiste', count: '45' },
            { icon: '✂️', name: 'Toiletteur', count: '98' },
            { icon: '🖐️', name: 'Ostéopathe', count: '54' },
            { icon: '🧠', name: 'Comportementaliste', count: '72' },
            { icon: '🥗', name: 'Nutritionniste', count: '38' },
            { icon: '🦷', name: 'Dentiste vétérinaire', count: '29' },
            { icon: '🎓', name: 'Éducateur canin', count: '61' },
          ].map(s => (
            <div key={s.name} onClick={() => navigate('/search')} style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: '16px', padding: '20px 16px', textAlign: 'center', cursor: 'pointer', transition: 'transform 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>{s.icon}</div>
              <div style={{ fontWeight: 800, fontSize: '13px', color: '#C2410C', marginBottom: '4px' }}>{s.name}</div>
              <div style={{ fontSize: '11px', color: '#92400E' }}>{s.count} praticiens</div>
            </div>
          ))}
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section style={{ padding: '60px 40px', background: '#FFF7ED' }}>
        <h2 style={{ fontFamily: 'Fredoka One, cursive', fontSize: '36px', color: '#C2410C', textAlign: 'center', marginBottom: '40px' }}>
          Comment ça marche ?
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', maxWidth: '800px', margin: '0 auto' }}>
          {[
            { step: '1', icon: '🔍', title: 'Cherchez', desc: 'Trouvez le praticien idéal selon la spécialité et votre ville' },
            { step: '2', icon: '📅', title: 'Réservez', desc: 'Choisissez le créneau qui vous convient en quelques clics' },
            { step: '3', icon: '🐾', title: 'Consultez', desc: 'Votre animal est entre de bonnes pattes !' },
          ].map(s => (
            <div key={s.step} style={{ background: 'white', border: '1.5px solid #FED7AA', borderRadius: '16px', padding: '28px 20px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'Fredoka One, cursive', fontSize: '40px', color: '#F97316', marginBottom: '8px' }}>{s.icon}</div>
              <div style={{ fontFamily: 'Fredoka One, cursive', fontSize: '20px', color: '#C2410C', marginBottom: '8px' }}>{s.title}</div>
              <div style={{ fontSize: '13px', color: '#92400E', lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ padding: '60px 40px', background: '#F97316', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Fredoka One, cursive', fontSize: '40px', color: 'white', marginBottom: '16px' }}>
          Prêt à prendre soin de votre animal ? 🐾
        </h2>
        <p style={{ fontSize: '16px', color: '#FFEDD5', marginBottom: '28px' }}>
          Rejoignez des milliers de propriétaires qui font confiance à Animéaux
        </p>
        <button onClick={() => navigate('/register')} style={{ background: 'white', color: '#F97316', border: 'none', borderRadius: '14px', padding: '16px 36px', fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: '16px', cursor: 'pointer' }}>
          Créer mon compte gratuitement
        </button>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#78350F', padding: '24px 40px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Fredoka One, cursive', fontSize: '22px', color: '#FED7AA', marginBottom: '8px' }}>Animéaux 🐾</div>
        <div style={{ fontSize: '13px', color: '#FFEDD5' }}>La santé de vos animaux, entre de bonnes pattes</div>
      </footer>

    </div>
  )
}