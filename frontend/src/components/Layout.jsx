import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useFetch from '../hooks/useFetch';
import { categoriesApi, homeApi, imageUrl, marketsApi, searchApi } from '../services/api';
import { useCart } from '../context/CartContext';
import { useNotifications } from '../context/NotificationsContext';
import Chatbot from './Chatbot';
import { DAYS, cap, farmerPath, marketPath, money, productPath } from '../utils';
import { IconBell, IconCart, IconChevron, IconClose, IconHeart, IconHome, IconMap, IconMenu, IconMic, IconSearch, IconStore, IconUser } from './Icons';

function Logo() {
  return <img className="logo" src="/logo-mark.png" srcSet="/logo-mark.png 1x, /logo-mark@2x.png 2x" width="26" height="42" alt="" aria-hidden />;
}

const LINKS = {
  guest: [
    ['/', 'Home'],
    ['/markets', 'Markets'],
    ['/products', 'Products'],
    ['/harvest', 'Harvest'],
    ['/about', 'About'],
    ['/contact', 'Contact'],
  ],
  customer: [
    ['/', 'Home'],
    ['/markets', 'Markets'],
    ['/products', 'Products'],
    ['/harvest', 'Harvest'],
    ['/orders', 'My Orders'],
    ['/favorites', 'Favorites'],
    ['/family', 'Family'],
    ['/notifications', 'Alerts'],
    ['/about', 'About'],
    ['/contact', 'Contact'],
  ],
  farmer: [
    ['/farmer', 'Dashboard'],
    ['/farmer/products', 'My Products'],
    ['/farmer/orders', 'Orders'],
    ['/farmer/harvest', 'Harvest'],
    ['/farmer/reviews', 'Reviews'],
    ['/farmer/profile', 'Profile'],
    ['/notifications', 'Alerts'],
  ],
  admin: [
    ['/admin', 'Dashboard'],
    ['/admin/users', 'Users'],
    ['/admin/markets', 'Markets'],
    ['/admin/moderation', 'Moderation'],
    ['/admin/reports', 'Reports'],
    ['/admin/settings', 'Settings'],
    ['/notifications', 'Alerts'],
  ],
};

const DESKTOP_HIDE = ['/favorites', '/family', '/notifications', '/about', '/contact'];

const RECENT_KEY = 'marketlink_recent_searches';
const readRecent = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    return [];
  }
};
const saveRecent = (term) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([term, ...readRecent().filter((t) => t.toLowerCase() !== term.toLowerCase())].slice(0, 5)));
  } catch {
    /* storage unavailable */
  }
};

// Wraps the letters the visitor typed in <mark> so it is obvious why a result matched.
function Mark({ text, q }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

// Search box with live, relevance-ranked suggestions (products, categories, growers, markets) from the first letter.
// Debounced (180ms) so typing does not fire a request per keystroke; recent searches show when the box is empty.
function SearchForm({ onDone, className = '', autoFocus = false }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [open, setOpen] = useState(autoFocus);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState(() => (autoFocus ? readRecent() : []));
  const box = useRef(null);
  const term = q.trim();
  const [listening, setListening] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState('');
  const recognition = useRef(null);
  const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

  useEffect(() => {
    if (!term) {
      setRes(null);
      return undefined;
    }
    let stale = false;
    const timer = setTimeout(() => {
      searchApi
        .suggest(term)
        .then((response) => !stale && (setRes(response.data), setActive(-1)))
        .catch(() => !stale && setRes(null));
    }, 180);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [term]);

  useEffect(() => {
    const away = (event) => !box.current?.contains(event.target) && setOpen(false);
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  // One flat list drives both the rendering order and the arrow-key navigation.
  const rows = [];
  if (term && res) {
    res.products.forEach((product) => rows.push({ kind: 'product', key: `p${product._id}`, to: productPath(product), p: product }));
    res.categories.forEach((category) => rows.push({ kind: 'category', key: `c${category._id}`, to: `/products?category=${category._id}`, label: category.name }));
    res.farmers.forEach((farmer) => rows.push({ kind: 'farmer', key: `f${farmer._id}`, to: farmerPath(farmer), label: farmer.name, sub: farmer.markets.join(' · ') }));
    res.markets.forEach((market) => rows.push({ kind: 'market', key: `m${market._id}`, to: marketPath(market), label: market.name, sub: market.address }));
  } else if (!term) {
    recent.forEach((r) => rows.push({ kind: 'recent', key: `r${r}`, to: `/products?search=${encodeURIComponent(r)}`, label: r }));
  }

  const finish = () => {
    setOpen(false);
    onDone?.();
  };
  const go = (to, remember) => {
    if (remember) saveRecent(remember);
    navigate(to);
    finish();
  };
  const submit = (event) => {
    event.preventDefault();
    if (active >= 0 && rows[active]) return go(rows[active].to, rows[active].kind === 'recent' ? rows[active].label : term || undefined);
    if (term) saveRecent(term);
    go(term ? `/products?search=${encodeURIComponent(term)}` : '/products');
  };
  const onKey = (event) => {
    if (!rows.length) return;
    if (event.key === 'ArrowDown') (event.preventDefault(), setActive((previousActive) => (previousActive + 1) % rows.length));
    if (event.key === 'ArrowUp') (event.preventDefault(), setActive((previousActive) => (previousActive <= 0 ? rows.length - 1 : previousActive - 1)));
    if (event.key === 'Escape') setOpen(false);
  };

  // Voice search (English): uses the browser's built-in Web Speech API, so no API key or backend is needed.
  const VOICE_ERRORS = {
    'not-allowed': 'Microphone blocked. Allow it in the browser to use voice search.',
    'service-not-allowed': 'Microphone blocked. Allow it in the browser to use voice search.',
    'no-speech': "Didn't catch that. Tap the mic and try again.",
    'audio-capture': 'No microphone found.',
    network: 'Voice search needs an internet connection.',
  };
  const stopVoice = () => {
    recognition.current?.abort?.();
    recognition.current = null;
    setListening(false);
  };
  const toggleVoice = () => {
    if (listening) return stopVoice();
    setVoiceMsg('');
    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let heard = '';
    rec.onresult = (event) => {
      heard = Array.from(event.results, (result) => result[0].transcript).join(' ').trim();
      setQ(heard);
      setOpen(true);
    };
    rec.onerror = (event) => {
      if (event.error !== 'aborted') setVoiceMsg(VOICE_ERRORS[event.error] || 'Voice search failed. Please try again.');
    };
    rec.onend = () => {
      recognition.current = null;
      setListening(false);
      const spoken = heard.replace(/[.?!]+$/, '').trim();
      if (spoken) go(`/products?search=${encodeURIComponent(spoken)}`, spoken);
    };
    try {
      rec.start();
      recognition.current = rec;
      setListening(true);
    } catch {
      setVoiceMsg('Voice search could not start. Please try again.');
    }
  };
  useEffect(() => () => recognition.current?.abort?.(), []);

  const showList = open && (rows.length > 0 || (term && res));
  const GROUP = { product: 'Products', category: 'Categories', farmer: 'Growers', market: 'Markets', recent: 'Recent searches' };
  let last = '';

  return (
    <form className={`header-search ${className}`} role="search" onSubmit={submit} ref={box}>
      <IconSearch width={19} height={19} />
      <input
        type="search"
        value={q}
        onChange={(event) => {
          setQ(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setRecent(readRecent());
          setOpen(true);
        }}
        onKeyDown={onKey}
        placeholder={listening ? 'Listening... say a product name' : voiceMsg || 'Search fresh produce, growers, markets...'}
        aria-label="Search products"
        autoFocus={autoFocus}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={!!showList}
        autoComplete="off"
      />
      {SpeechRecognition && (
        <button type="button" className={`mic-btn ${listening ? 'on' : ''}`} onClick={toggleVoice} aria-label={listening ? 'Stop voice search' : 'Search by voice'} aria-pressed={listening} title="Search by voice">
          <IconMic width={18} height={18} />
        </button>
      )}
      <button aria-label="Search">Search</button>
      {showList && (
        <ul className="suggest" role="listbox">
          {rows.map((row, index) => {
            const head = row.kind !== last ? GROUP[row.kind] : null;
            last = row.kind;
            return (
              <li key={row.key} role="option" aria-selected={index === active}>
                {head && <span className="sg-group">{head}</span>}
                <Link to={row.to} className={index === active ? 'on' : ''} onClick={() => (row.kind === 'recent' ? saveRecent(row.label) : null) || finish()}>
                  {row.kind === 'product' ? (
                    <>
                      <span className="sg-img">{row.p.image ? <img src={imageUrl(row.p.image)} alt="" /> : row.p.name[0]}</span>
                      <span className="sg-text">
                        <strong>
                          <Mark text={row.p.name} q={term} />
                        </strong>
                        <small>
                          {row.p.category?.name} · {row.p.farmer?.farmerProfile?.stallName}
                        </small>
                      </span>
                      <span className="sg-price">{money(row.p.price)}</span>
                    </>
                  ) : (
                    <>
                      <span className={`sg-badge sg-${row.kind}`} aria-hidden>
                        {row.kind === 'category' ? '#' : row.kind === 'farmer' ? '★' : row.kind === 'market' ? '⌖' : '↺'}
                      </span>
                      <span className="sg-text">
                        <strong>{row.kind === 'recent' ? row.label : <Mark text={row.label} q={term} />}</strong>
                        {row.sub && <small>{row.sub}</small>}
                      </span>
                    </>
                  )}
                </Link>
              </li>
            );
          })}
          {term && res && !rows.length && <li className="sg-none">No matches for “{term}”. Try another spelling.</li>}
          {term && (
            <li className="sg-all">
              <Link to={`/products?search=${encodeURIComponent(term)}`} onClick={() => { saveRecent(term); finish(); }}>
                See all results for “{term}” →
              </Link>
            </li>
          )}
        </ul>
      )}
    </form>
  );
}

// Wide "shop" menu: photo tiles for every category with live counts, what just arrived, and quick pickup-day filters.
function MegaMenu({ home, guest, onClose, onEnter, onLeave }) {
  const tiles = new Map((home?.categoryTiles || []).map((t) => [t._id, t]));
  const cats = (home?.categories || [])
    .map((c) => ({ ...c, ...(tiles.get(c._id) || {}) }))
    .sort((first, second) => (second.count || 0) - (first.count || 0) || first.name.localeCompare(second.name));
  const newest = (home?.newest || []).slice(0, 3);
  return (
    <div className="mega" onMouseEnter={onEnter} onMouseLeave={onLeave} role="region" aria-label="Shop menu">
      <div className="container mega-inner">
        <div className="mega-main">
          <div className="mega-head">
            <span className="kicker dark">Shop by category</span>
            <Link to="/products" onClick={onClose} className="arrow-link">
              Browse all {home?.stats?.products ?? ''} products →
            </Link>
          </div>
          <div className="mega-grid">
            {cats.map((cat) => (
              <Link key={cat._id} to={`/products?category=${cat._id}`} className="mega-cat" onClick={onClose}>
                <span className="mc-img" style={cat.image ? { backgroundImage: `url(${imageUrl(cat.image)})` } : undefined}>
                  {!cat.image && cat.name[0]}
                </span>
                <span className="mc-text">
                  <strong>{cat.name}</strong>
                  <small>{cat.count ? `${cat.count} item${cat.count === 1 ? '' : 's'} in stock` : 'Coming soon'}</small>
                </span>
                <span className="mc-go" aria-hidden>
                  →
                </span>
              </Link>
            ))}
            {!cats.length && Array.from({ length: 9 }).map((_, index) => <span key={index} className="skeleton" style={{ height: 84, borderRadius: 18 }} />)}
          </div>
        </div>

        <aside className="mega-side">
          <span className="kicker dark">Just in</span>
          <ul className="mega-new">
            {newest.map((p) => (
              <li key={p._id}>
                <Link to={productPath(p)} onClick={onClose}>
                  <span className="mc-img sm" style={p.image ? { backgroundImage: `url(${imageUrl(p.image)})` } : undefined}>
                    {!p.image && p.name[0]}
                  </span>
                  <span className="mc-text">
                    <strong>{p.name}</strong>
                    <small>{p.farmer?.farmerProfile?.stallName}</small>
                  </span>
                  <b>{money(p.price)}</b>
                </Link>
              </li>
            ))}
          </ul>

          <span className="kicker dark">Shop by pickup day</span>
          <div className="mega-days">
            {DAYS.map((day) => (
              <Link key={day} to={`/products?day=${day}`} onClick={onClose}>
                {cap(day.slice(0, 3))}
              </Link>
            ))}
          </div>

          {guest && (
            <Link to="/register?role=farmer" className="mega-sell" onClick={onClose}>
              <strong>Grow it? Sell it here.</strong>
              <span>Open your stall on MarketLink →</span>
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}

function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const { unread } = useNotifications();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const home = useFetch(() => homeApi.get(), []);
  const categories = home.data?.categories || [];
  const hoverTimer = useRef(null);
  const headerRef = useRef(null);
  const [backTop, setBackTop] = useState(0);
  const isHome = pathname === '/';
  const [atHeroTop, setAtHeroTop] = useState(isHome);
  useEffect(() => {
    if (!isHome) return undefined;
    const onScroll = () => setAtHeroTop(window.scrollY < window.innerHeight * 0.72);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isHome]);
  const openMega = () => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      setBackTop(headerRef.current?.getBoundingClientRect().bottom || 0);
      setCatOpen(true);
    }, 90);
  };
  const closeMega = () => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setCatOpen(false), 200);
  };
  const role = user?.role || 'guest';
  const canShop = role === 'guest' || role === 'customer';
  const links = LINKS[role];
  const desktopLinks = role === 'admin' ? [] : role === 'customer' ? links.filter(([to]) => !DESKTOP_HIDE.includes(to)) : links;
  const close = () => {
    setOpen(false);
    setCatOpen(false);
    setSearchOpen(false);
  };

  useEffect(close, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open || searchOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open, searchOpen]);
  useEffect(() => {
    if (!catOpen && !open) return;
    const onKey = (event) => event.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [catOpen, open]);

  const handleLogout = () => {
    logout();
    close();
    navigate('/');
  };

  return (
    <>
      <header className={`site-header ${isHome && atHeroTop ? 'hdr-on-hero' : ''}`} ref={headerRef}>
        <div className="topbar">
          <div className="container topbar-inner">
            <span>Fresh from local growers · Pickup at the market · Pay in person</span>
            <span className="topbar-links">
              <Link to="/markets">Find a market</Link>
              {!user && <Link to="/register?role=farmer">Sell on MarketLink</Link>}
              <Link to="/about">About</Link>
              <Link to="/contact">Contact</Link>
            </span>
          </div>
        </div>

        <div className="navbar">
          <div className="container navbar-inner">
            <Link to="/" className="brand" onClick={close}>
              <Logo />
              <span className="brand-word">
                Market<span>Link</span>
              </span>
            </Link>

            <nav className="nav-links" aria-label="Main">
              {desktopLinks.map(([to, label]) => (
                <NavLink key={to} to={to} end={['/', '/farmer', '/admin'].includes(to)}>
                  {label}
                  {to === '/notifications' && unread > 0 && <span className="badge">{unread}</span>}
                </NavLink>
              ))}
              {canShop && (
                <span className="cat-menu" onMouseEnter={openMega} onMouseLeave={closeMega}>
                  <button
                    className="cat-btn"
                    aria-expanded={catOpen}
                    aria-haspopup="true"
                    onClick={() => {
                      clearTimeout(hoverTimer.current);
                      setBackTop(headerRef.current?.getBoundingClientRect().bottom || 0);
                      setCatOpen((previousCatOpen) => !previousCatOpen);
                    }}
                  >
                    Categories <IconChevron width={16} height={16} />
                  </button>
                </span>
              )}
            </nav>

            {canShop && <SearchForm className="desk-only" />}

            <div className="header-actions">
              {role === 'customer' && (
                <>
                  <Link className="icon-btn" to="/favorites" aria-label="Favorites">
                    <IconHeart />
                  </Link>
                  <Link className="icon-btn" to="/notifications" aria-label={`Alerts${unread ? `, ${unread} unread` : ''}`}>
                    <IconBell />
                    {unread > 0 && <span className="dot-badge">{unread}</span>}
                  </Link>
                  <Link className="icon-btn" to="/cart" aria-label={`Cart, ${count} items`}>
                    <IconCart />
                    {count > 0 && <span className="dot-badge">{count}</span>}
                  </Link>
                </>
              )}
              <span className="auth-actions">
                {user ? (
                  <button className="btn btn-outline btn-sm" onClick={handleLogout}>
                    Logout ({user.name.split(' ')[0]})
                  </button>
                ) : (
                  <>
                    <Link className="btn btn-outline btn-sm" to="/login">
                      Login
                    </Link>
                    <Link className="btn btn-sm" to="/register">
                      Register
                    </Link>
                  </>
                )}
              </span>
              {canShop && (
                <button className="icon-btn search-toggle" aria-label="Search" onClick={() => setSearchOpen(true)}>
                  <IconSearch />
                </button>
              )}
              <button className="icon-btn nav-toggle" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
                <IconMenu />
              </button>
            </div>
          </div>
        </div>
        {catOpen && (
          <>
            <div className="mega-back" style={{ top: backTop }} onClick={() => setCatOpen(false)} />
            <MegaMenu home={home.data} guest={!user} onClose={() => setCatOpen(false)} onEnter={() => clearTimeout(hoverTimer.current)} onLeave={closeMega} />
          </>
        )}
      </header>

      {open && (
        <div className="drawer" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="drawer-head">
            <Link to="/" className="brand" onClick={close}>
              <Logo />
              <span className="brand-word">
                Market<span>Link</span>
              </span>
            </Link>
            <button className="icon-btn" aria-label="Close menu" onClick={close}>
              <IconClose />
            </button>
          </div>
          {canShop && <SearchForm onDone={close} />}
          <nav className="drawer-links" aria-label="Menu">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} end={['/', '/farmer', '/admin'].includes(to)}>
                {label}
                {to === '/notifications' && unread > 0 && <span className="badge">{unread}</span>}
              </NavLink>
            ))}
          </nav>
          {canShop && categories.length > 0 && (
            <div className="drawer-cats">
              <h3>Shop by category</h3>
              <div className="chips">
                {categories.map((category) => (
                  <Link key={category._id} className="chip" to={`/products?category=${category._id}`}>
                    {category.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
          <div className="drawer-actions">
            {user ? (
              <button className="btn btn-block" onClick={handleLogout}>
                Logout ({user.name.split(' ')[0]})
              </button>
            ) : (
              <>
                <Link className="btn btn-block" to="/register">
                  Create free account
                </Link>
                <Link className="btn btn-outline btn-block" to="/login">
                  Login
                </Link>
                <Link className="drawer-sell" to="/register?role=farmer">
                  Sell as a grower →
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {searchOpen && (
        <div className="search-sheet" role="dialog" aria-modal="true" aria-label="Search">
          <div className="ss-top">
            <SearchForm autoFocus className="in-sheet" onDone={() => setSearchOpen(false)} />
            <button className="ss-cancel" onClick={() => setSearchOpen(false)}>
              Cancel
            </button>
          </div>
          <div className="ss-body">
            <span className="sg-group">Popular categories</span>
            <div className="chips">
              {categories.slice(0, 9).map((category) => (
                <Link key={category._id} className="chip" to={`/products?category=${category._id}`} onClick={() => setSearchOpen(false)}>
                  {category.name}
                </Link>
              ))}
            </div>
            <span className="sg-group">Pickup this week</span>
            <div className="chips">
              {DAYS.map((day) => (
                <Link key={day} className="chip" to={`/products?day=${day}`} onClick={() => setSearchOpen(false)}>
                  {cap(day)}
                </Link>
              ))}
            </div>
            <Link className="ss-map" to="/markets" onClick={() => setSearchOpen(false)}>
              <IconMap width={20} height={20} /> Find a market near you →
            </Link>
          </div>
        </div>
      )}

      {canShop && (
        <nav className="tabbar" aria-label="Quick navigation">
          <NavLink to="/" end>
            <IconHome />
            <span>Home</span>
          </NavLink>
          <NavLink to="/products">
            <IconStore />
            <span>Shop</span>
          </NavLink>
          <NavLink to="/markets">
            <IconMap />
            <span>Markets</span>
          </NavLink>
          {role === 'customer' ? (
            <NavLink to="/cart">
              <span className="tab-ico">
                <IconCart />
                {count > 0 && <span className="dot-badge">{count}</span>}
              </span>
              <span>Cart</span>
            </NavLink>
          ) : (
            <NavLink to="/login">
              <IconUser />
              <span>Login</span>
            </NavLink>
          )}
          <button onClick={() => setOpen(true)}>
            <IconMenu />
            <span>Menu</span>
          </button>
        </nav>
      )}
    </>
  );
}

function Footer() {
  const { user } = useAuth();
  const cats = useFetch(() => categoriesApi.list(), []);
  const markets = useFetch(() => marketsApi.list({ limit: 5 }), []);
  const categories = (cats.data?.categories || []).slice(0, 6);
  const marketList = (markets.data?.markets || []).slice(0, 5);
  return (
    <footer className="footer">
      <div className="footer-perks">
        <div className="container footer-perks-inner">
          {[
            ['🌾', 'Straight from farmers'],
            ['🕒', 'Choose your pickup slot'],
            ['💵', 'Pay in person'],
            ['📍', 'Markets near you'],
          ].map(([i, t]) => (
            <span key={t}>
              <span aria-hidden>{i}</span> {t}
            </span>
          ))}
        </div>
      </div>
      <div className="container footer-grid">
        <div>
          <p className="brand foot-brand">
            <Logo />
            <span className="brand-word">
              Market<span>Link</span>
            </span>
          </p>
          <p className="small foot-about">Farm fresh, just a click away. Discover local farmers markets, reserve produce and pick it up in person from the people who grew it.</p>
          <Link className="btn btn-sm btn-pill foot-cta" to={user ? '/products' : '/register'}>
            {user ? 'Shop now' : 'Create free account'}
          </Link>
        </div>
        <div>
          <h3>Shop by category</h3>
          <ul className="plain small">
            {categories.map((category) => (
              <li key={category._id}>
                <Link to={`/products?category=${category._id}`}>{category.name}</Link>
              </li>
            ))}
            <li>
              <Link to="/products">All products</Link>
            </li>
          </ul>
        </div>
        <div>
          <h3>Our markets</h3>
          <ul className="plain small">
            {marketList.map((m) => (
              <li key={m._id}>
                <Link to={marketPath(m)}>{m.name}</Link>
              </li>
            ))}
            <li>
              <Link to="/markets">All markets</Link>
            </li>
          </ul>
        </div>
        <div>
          <h3>Farmers</h3>
          <ul className="plain small">
            <li><Link to="/register?role=farmer">Sell on MarketLink</Link></li>
            <li><Link to="/login">Farmer login</Link></li>
            {user?.role === 'customer' && <li><Link to="/orders">My orders</Link></li>}
            {user?.role === 'customer' && <li><Link to="/favorites">Favorites</Link></li>}
            {user?.role === 'customer' && <li><Link to="/family">Family account</Link></li>}
          </ul>
        </div>
        <div>
          <h3>Company</h3>
          <ul className="plain small">
            <li><Link to="/about">About us</Link></li>
            <li><Link to="/contact">Contact us</Link></li>
          </ul>
        </div>
      </div>
      <div className="foot-mark" aria-hidden />
      <div className="footer-bottom-wrap">
        <div className="container footer-bottom">
          <span className="fb-copy">© {new Date().getFullYear()} MarketLink. Pickup only, no delivery. Payment is made in person.</span>
          <nav className="fb-links" aria-label="Footer">
            <Link to="/about">About</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/register?role=farmer">Sell on MarketLink</Link>
          </nav>
          <a
            className="to-top"
            href="#top"
            onClick={(event) => {
              event.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            Back to top <span aria-hidden>↑</span>
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function Layout() {
  const { pathname } = useLocation();

  // Move focus to the page content on navigation and keep the tab title meaningful.
  useEffect(() => {
    document.getElementById('main')?.focus({ preventScroll: true });
    const timer = setTimeout(() => {
      const h1 = document.querySelector('main h1')?.textContent;
      document.title = h1 ? `${h1} | MarketLink` : 'MarketLink - Farm Fresh Just a Click Away';
    }, 400);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <Navbar />
      <main id="main" tabIndex={-1} className={['/', '/login', '/register'].includes(pathname) || pathname.startsWith('/admin') ? 'main-full' : 'container main'}>
        <Suspense fallback={<p className="page-message">Loading...</p>}>
          <Outlet />
        </Suspense>
      </main>
      {!pathname.startsWith('/admin') && <Footer />}
      {!pathname.startsWith('/admin') && <Chatbot />}
    </>
  );
}
