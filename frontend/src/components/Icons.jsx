// Small inline icon set (stroke icons, inherit currentColor) so the UI needs no emoji or icon font.
const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

const make = (children) =>
  function Icon(props) {
    return (
      <svg {...base} {...props}>
        {children}
      </svg>
    );
  };

export const IconSearch = make(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const IconMic = make(<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" /><path d="M12 18v3" /></>);
export const IconCart = make(<><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2" /><circle cx="9.5" cy="20" r="1.3" /><circle cx="17" cy="20" r="1.3" /></>);
export const IconHeart = make(<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z" />);
export const IconHome = make(<><path d="M4 11 12 4l8 7" /><path d="M6 10v10h12V10" /></>);
export const IconStore = make(<><path d="M4 9l1.5-5h13L20 9" /><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9" /><path d="M5 12v8h14v-8" /></>);
export const IconMap = make(<><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>);
export const IconUser = make(<><circle cx="12" cy="8" r="4" /><path d="M4 20c1-4 4-6 8-6s7 2 8 6" /></>);
// Two long, crisp bars (modern minimal menu icon).
export const IconMenu = make(<><path d="M3.5 8.5h17" strokeWidth="2" /><path d="M3.5 15.5h17" strokeWidth="2" /></>);
export const IconClose = make(<><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>);
export const IconChevron = make(<path d="m6 9 6 6 6-6" />);
export const IconArrow = make(<><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>);
export const IconFilter = make(<><path d="M4 6h16" /><path d="M7 12h10" /><path d="M10 18h4" /></>);
export const IconLeaf = make(<><path d="M5 19c0-8 5-14 15-14 0 9-6 15-14 15" /><path d="M5 19c2-4 5-7 9-9" /></>);
export const IconClock = make(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>);
export const IconCash = make(<><rect x="3" y="6.5" width="18" height="11" rx="2" /><circle cx="12" cy="12" r="2.3" /></>);
export const IconBasket = make(<><path d="M4 10h16l-1.6 9H5.6L4 10z" /><path d="M8 10l3-5" /><path d="M16 10l-3-5" /></>);
export const IconBell = make(<><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z" /><path d="M10 20a2 2 0 0 0 4 0" /></>);
export const IconMail = make(<><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="m4 7 8 6 8-6" /></>);
export const IconPhone = make(<path d="M6.5 4h3l1.5 4-2 1.3a11 11 0 0 0 5.7 5.7L16 13l4 1.5v3a2 2 0 0 1-2 2A14 14 0 0 1 4.5 6a2 2 0 0 1 2-2z" />);
export const IconEye = make(<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>);
export const IconEyeOff = make(<><path d="M10.6 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.7" /><path d="M6.6 6.9A15.6 15.6 0 0 0 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 4.3-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="m3 3 18 18" /></>);
export const IconGrid = make(<><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>);
export const IconUsers = make(<><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 19c.8-3.4 3.3-5 6.5-5s5.7 1.6 6.5 5" /><path d="M16 5.2a3.3 3.3 0 0 1 0 6.6" /><path d="M18 14.3c1.7.6 2.9 2 3.5 4.7" /></>);
export const IconShield = make(<><path d="M12 3 5 6v5.5c0 4.3 2.9 7.6 7 9.5 4.1-1.9 7-5.2 7-9.5V6l-7-3z" /><path d="m9 12 2.2 2.2L15.5 10" /></>);
export const IconChart = make(<><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>);
export const IconSettings = make(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>);
export const IconLog = make(<><path d="M8 4h9a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2V6" /><path d="M6 6H5a1 1 0 0 0-1 1v2" /><path d="M10 9h6" /><path d="M10 13h6" /><path d="M10 17h4" /></>);
export const IconExternal = make(<><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>);
export const IconDownload = make(<><path d="M12 4v11" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></>);
export const IconCheck = make(<path d="m5 12.5 4.5 4.5L19 7.5" />);
export const IconRefresh = make(<><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>);
export const IconFlag = make(<><path d="M5 21V4" /><path d="M5 4h11l-1.5 4L16 12H5" /></>);
export const IconBox = make(<><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9z" /><path d="M3.5 7.5 12 12l8.5-4.5" /><path d="M12 12v9" /></>);
export const IconCommand = make(<path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6z" />);
export const IconStar = make(<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8L12 3.5z" />);
export const IconShare = make(<><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="m8.2 10.8 7.6-4" /><path d="m8.2 13.2 7.6 4" /></>);
export const IconTrend = make(<><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>);
export const IconSprout = make(<><path d="M12 21v-8" /><path d="M12 13c0-4-3-6-7-6 0 4 3 6 7 6z" /><path d="M12 11c0-3.5 2.5-6 7-6 0 3.5-2.5 6-7 6z" /></>);
export const IconTagPrice = make(<><path d="M3 12V4h8l10 10-8 8L3 12z" /><circle cx="7.5" cy="8.5" r="1.3" /></>);
export const IconChevronLeft = make(<path d="m14.5 5.5-6.5 6.5 6.5 6.5" />);
export const IconChevronRight = make(<path d="m9.5 5.5 6.5 6.5-6.5 6.5" />);

export const IconCalendar = make(<><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17" /><path d="M8 3v4" /><path d="M16 3v4" /></>);
