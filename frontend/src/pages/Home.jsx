import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import useFetch from '../hooks/useFetch';
import useReveal from '../hooks/useReveal';
import { homeApi, productsApi, imageUrl } from '../services/api';
import { useAuth, homeFor } from '../context/AuthContext';
import { ProductCard, SkeletonGrid, Stars } from '../components/Common';
import { DAYS, cap, categoryEmoji, daysText, farmerPath, marketPath, nextOpenLabel } from '../utils';
import { IconBasket, IconCash, IconChevronLeft, IconChevronRight, IconClock, IconMap } from '../components/Icons';

// Wraps a section in a scroll-reveal; visible immediately for prefers-reduced-motion.
function Reveal({ as: Tag = 'div', className = '', children, ...rest }) {
  const [ref, visible] = useReveal();
  return (
    <Tag ref={ref} className={`reveal ${visible ? 'in' : ''} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

const STEPS = [
  ['Discover', 'Find the farmers markets near you and see exactly who is selling this week.'],
  ['Reserve', 'Pre-order against real weekly stock and choose the pickup slot that suits you.'],
  ['Collect', 'Meet the grower, pick up your order and pay in person. No sold-out surprises.'],
];

const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`;
};
const hours = (m) => (m.openTime && m.closeTime ? `${fmtTime(m.openTime)} – ${fmtTime(m.closeTime)}` : '');
const todayName = () => DAYS[(new Date().getDay() + 6) % 7];

function Hero() {
  const { user } = useAuth();
  return (
    <section className="hero hero-cinematic">
      <div className="hero-bg hero-bg-settle" aria-hidden />
      <div className="hero-copy">
        <span className="kicker hero-anim" style={{ '--d': '.05s' }}>From our farms to your table</span>
        <h1 className="hero-anim" style={{ '--d': '.16s' }}>
          Freshness
          <br />
          in <em>every</em> step.
        </h1>
        <p className="hero-anim" style={{ '--d': '.28s' }}>We connect local farmers with you — bringing fresh, seasonal produce from our fields to your home.</p>
        <div className="row-gap hero-anim" style={{ '--d': '.38s' }}>
          {user ? (
            <Link className="btn btn-xl btn-glass" to={homeFor(user)}>
              Go to my dashboard <span aria-hidden>→</span>
            </Link>
          ) : (
            <Link className="btn btn-xl btn-glass" to="/products">
              Shop the harvest <span aria-hidden>→</span>
            </Link>
          )}
        </div>
      </div>
      <span className="hero-mark hero-anim" style={{ '--d': '.5s' }} aria-hidden>
        Real Farmers
        <br />
        Real Food
        <br />
        Real People
      </span>
      <div className="hero-scroll hero-anim" style={{ '--d': '.6s' }} aria-hidden>
        <span className="hero-scroll-dot" />
        <small>Scroll to explore</small>
      </div>
    </section>
  );
}

const FEATURES = [
  [IconBasket, 'Straight from growers', 'Every item is listed by the farmer who grew it.'],
  [IconClock, 'Your pickup slot', 'Reserve now and collect on market day.'],
  [IconCash, 'Pay in person', 'No online payment, no delivery fees.'],
  [IconMap, 'Markets near you', 'Find stalls on the map with directions.'],
];

function Features() {
  return (
    <Reveal as="section" className="features" aria-label="Why MarketLink">
      <div className="wrap features-grid">
        {FEATURES.map(([Icon, t, d], index) => (
          <div className="feature feature-anim" style={{ '--d': `${index * 0.08}s` }} key={t}>
            <span className="feature-ico">
              <Icon />
            </span>
            <span>
              <strong>{t}</strong>
              <small>{d}</small>
            </span>
          </div>
        ))}
      </div>
    </Reveal>
  );
}

function Marquee({ categories }) {
  if (!categories.length) return null;
  return (
    <div className="marquee" aria-hidden>
      <div className="marquee-track">
        {[0, 1].map((k) => (
          <div className="marquee-group" key={k}>
            {[...categories, ...categories].map((c, index) => (
              <span key={`${c._id}${index}`}>
                {c.name} <i>✦</i>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekCalendar({ markets }) {
  const today = todayName();
  return (
    <Reveal as="section" className="block week">
      <div className="wrap">
        <div className="block-head">
          <div>
            <span className="kicker dark">This week</span>
            <h2>Where the market is open</h2>
          </div>
          <Link className="arrow-link" to="/markets">
            Find a market near you →
          </Link>
        </div>
        <div className="week-grid">
          {DAYS.map((day) => {
            const open = markets.filter((market) => market.operatingDays.includes(day));
            return (
              <div key={day} className={`week-day ${day === today ? 'today' : ''} ${open.length ? '' : 'closed'}`}>
                <div className="wd-name">
                  {cap(day.slice(0, 3))}
                  {day === today && <em>Today</em>}
                </div>
                {open.length ? (
                  open.map((m) => (
                    <Link key={m._id} to={marketPath(m)} className="wd-market">
                      <strong>{m.name}</strong>
                      <small>{hours(m)}</small>
                    </Link>
                  ))
                ) : (
                  <span className="wd-none">No markets</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Reveal>
  );
}

function CategoryBento({ tiles: raw, loading }) {
  const tiles = raw.slice(0, 9).map((c) => ({ ...c, img: imageUrl(c.image, 320) }));
  if (!tiles.length && !loading) return null;
  return (
    <Reveal as="section" className="block">
      <div className="wrap">
        <div className="block-head">
          <div>
            <span className="kicker dark">Shop by category</span>
            <h2>Everything the season has to offer</h2>
          </div>
          <Link className="arrow-link" to="/products">
            Browse all products →
          </Link>
        </div>
        <div className="bento">
          {!tiles.length && Array.from({ length: 9 }).map((_, index) => <div key={index} className={`bento-tile skeleton ${index === 0 ? 'big' : ''}`} aria-hidden />)}
          {tiles.map((tile, index) => (
            <Link key={tile._id} to={`/products?category=${tile._id}`} className={`bento-tile ${index === 0 ? 'big' : ''}`} style={tile.img ? { backgroundImage: `url(${tile.img})` } : undefined}>
              {!tile.img && <span className="bento-emoji">{categoryEmoji(tile.name)}</span>}
              <span className="bento-label">
                <strong>{tile.name}</strong>
                <small>
                  {tile.count} {tile.count === 1 ? 'item' : 'items'}
                </small>
              </span>
              <span className="bento-go" aria-hidden>
                ↗
              </span>
            </Link>
          ))}
        </div>
      </div>
    </Reveal>
  );
}

function Rail({ products }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ start: true, end: false, pct: 0 });

  // Keeps the arrows honest: dimmed at either end, plus a thin progress line for how far you have scrolled.
  const measure = () => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setPos({ start: el.scrollLeft <= 4, end: el.scrollLeft >= max - 4, pct: max > 0 ? Math.min(100, Math.round((el.scrollLeft / max) * 100)) : 100 });
  };
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [products.length]);

  const scroll = (d) => {
    const el = ref.current;
    if (!el) return;
    const card = el.querySelector('.rail-item');
    const step = card ? (card.getBoundingClientRect().width + 22) * Math.max(1, Math.floor(el.clientWidth / (card.getBoundingClientRect().width + 22)) - 0) : 640;
    el.scrollBy({ left: d * step, behavior: 'smooth' });
  };

  return (
    <Reveal as="section" className="block rail-block">
      <div className="wrap">
        <div className="block-head">
          <div>
            <span className="kicker dark">Just in</span>
            <h2>Fresh this week</h2>
          </div>
          <div className="rail-nav">
            <button aria-label="Previous products" onClick={() => scroll(-1)} disabled={pos.start}>
              <IconChevronLeft width={24} height={24} strokeWidth={2.2} />
            </button>
            <button aria-label="Next products" onClick={() => scroll(1)} disabled={pos.end}>
              <IconChevronRight width={24} height={24} strokeWidth={2.2} />
            </button>
          </div>
        </div>
        <div className="rail-progress" aria-hidden>
          <span style={{ width: `${Math.max(8, pos.pct)}%` }} />
        </div>
      </div>
      <div className="rail" ref={ref} onScroll={measure}>
        {products.map((product) => (
          <div className="rail-item" key={product._id}>
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </Reveal>
  );
}

function Story() {
  return (
    <Reveal as="section" className="story">
      <div className="story-photo" aria-hidden />
      <div className="story-copy">
        <span className="kicker">How it works</span>
        <h2>From the soil to your bag, in three steps.</h2>
        <ol>
          {STEPS.map(([t, d], index) => (
            <li key={t}>
              <span className="step-no">0{index + 1}</span>
              <span>
                <strong>{t}</strong>
                <span>{d}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="story-note">Pickup only · Pay in person · No delivery fees</p>
      </div>
    </Reveal>
  );
}

function Growers({ growers, ready }) {
  const list = growers.map((grower) => ({ f: grower, count: grower.productCount, img: imageUrl(grower.image, 640) }));
  if (!list.length) return null;
  return (
    <Reveal as="section" className="block">
      <div className="wrap">
        <div className="block-head">
          <div>
            <span className="kicker dark">Meet the growers</span>
            <h2>The people behind the stalls</h2>
          </div>
        </div>
        <div className="growers">
          {list.map(({ f, count, img }) => (
            <Link key={f._id} to={farmerPath(f)} className="grower">
              <span className="grower-img" style={img ? { backgroundImage: `url(${img})` } : undefined}>
                {!img && <span>{f.farmerProfile.stallName?.[0]}</span>}
                <span className="grower-days">{daysText(f.farmerProfile.operatingDays)}</span>
              </span>
              <span className="grower-body">
                <strong>{f.farmerProfile.stallName}</strong>
                <span className="muted small">{f.farmerProfile.markets?.map((m) => m.name).join(' · ') || 'Local grower'}</span>
                <span className="grower-meta">
                  <Stars value={f.farmerProfile.ratingAvg} count={f.farmerProfile.ratingCount} />
                  <span>{ready ? `${count} product${count === 1 ? '' : 's'}` : ' '}</span>
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </Reveal>
  );
}

function Harvest({ categories }) {
  const [tab, setTab] = useState('');
  const { data, loading } = useFetch(() => productsApi.list({ category: tab, limit: 10, sort: 'rating' }), [tab]);
  const products = data?.products || [];
  return (
    <Reveal as="section" className="block">
      <div className="wrap">
        <div className="block-head">
          <div>
            <span className="kicker dark">The full harvest</span>
            <h2>Picked for you</h2>
          </div>
          <div className="pills" role="tablist">
            <button role="tab" aria-selected={tab === ''} className={tab === '' ? 'active' : ''} onClick={() => setTab('')}>
              All
            </button>
            {categories.map((category) => (
              <button key={category._id} role="tab" aria-selected={tab === category._id} className={tab === category._id ? 'active' : ''} onClick={() => setTab(category._id)}>
                {category.name}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <SkeletonGrid count={5} className="grid grid-5" />
        ) : products.length ? (
          <div className="grid grid-5">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        ) : (
          <p className="muted">Nothing in stock in this category right now.</p>
        )}
      </div>
    </Reveal>
  );
}

function Markets({ markets }) {
  if (!markets.length) return null;
  return (
    <Reveal as="section" className="block markets-block">
      <div className="wrap">
        <div className="block-head">
          <div>
            <span className="kicker dark">Our markets</span>
            <h2>Pick a market, pick a day</h2>
          </div>
          <Link className="arrow-link" to="/markets">
            View on the map →
          </Link>
        </div>
        <ul className="market-rows">
          {markets.map((market, index) => (
            <li key={market._id}>
              <Link to={marketPath(market)}>
                <span className="mr-no">0{index + 1}</span>
                <span className="mr-name">{market.name}</span>
                <span className="mr-info">
                  <span>{daysText(market.operatingDays)}</span>
                  <span>{hours(market)}</span>
                </span>
                <span className="mr-next">{nextOpenLabel(market.operatingDays)}</span>
                <span className="mr-go" aria-hidden>
                  ↗
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}

function Duo() {
  const { user } = useAuth();
  return (
    <Reveal as="section" className="duo">
      <div className="duo-a">
        <span className="kicker">For shoppers</span>
        <h2>Eat what the season grows.</h2>
        <p>Save favourites, get restock alerts and track every pre-order.</p>
        <Link className="btn btn-xl btn-tomato" to={user ? '/products' : '/register'}>
          {user ? 'Start shopping' : 'Create free account'} <span aria-hidden>→</span>
        </Link>
      </div>
      <div className="duo-b">
        <span className="kicker">For growers</span>
        <h2>Sell your harvest, keep your margin.</h2>
        <p>Publish weekly stock, take pre-orders and meet customers face to face.</p>
        <Link className="btn btn-xl btn-glass" to={user?.role === 'farmer' ? '/farmer/products' : '/register?role=farmer'}>
          {user?.role === 'farmer' ? 'Manage stock' : 'Become a seller'} <span aria-hidden>→</span>
        </Link>
      </div>
    </Reveal>
  );
}

export default function Home() {
  const home = useFetch(() => homeApi.get(), []);
  const d = home.data;
  const categories = d?.categories || [];
  const marketList = d?.markets || [];

  return (
    <div className="home">
      {home.error && (
        <p className="alert alert-error home-error" role="alert">
          We could not load the latest harvest. Check your connection and <button onClick={() => window.location.reload()}>try again</button>.
        </p>
      )}
      <Hero />
      <Marquee categories={categories} />
      <Features />
      <CategoryBento tiles={d?.categoryTiles || []} loading={home.loading} />
      {d?.newest?.length > 0 && <Rail products={d.newest} />}
      <Story />
      <WeekCalendar markets={marketList} />
      <Growers growers={d?.growers || []} ready={!home.loading} />
      <Harvest categories={categories} />
      <Markets markets={marketList.slice(0, 5)} />
      <Duo />
    </div>
  );
}
