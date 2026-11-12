import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { initials } from '../lib/format';
import { Icon } from './Icons';

const NAV = [
  { to: '/', label: 'Today', icon: 'home', end: true },
  { to: '/practice', label: 'Practice', icon: 'mic' },
  { to: '/lessons', label: 'Lessons', icon: 'book' },
  { to: '/roleplay', label: 'Roleplay', icon: 'users' },
  { to: '/progress', label: 'Progress', icon: 'chart' },
  { to: '/settings', label: 'Settings', icon: 'settings' }
];

export function AppShell() {
  const { profile, user } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark">V</div>
          <span className="brand-name">VOICEUP AI</span>
        </div>

        <nav className="side-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <NavLink to="/settings" className="user-chip">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="" className="avatar avatar-img" />
            ) : (
              <span className="avatar">{initials(profile?.displayName ?? user?.email)}</span>
            )}
            <span className="user-chip-text">
              <strong>{profile?.displayName ?? 'Speaker'}</strong>
              <small>{profile?.targetLanguage ?? 'en-IN'}</small>
            </span>
          </NavLink>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>

      <nav className="bottom-nav">
        {NAV.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `bottom-item ${isActive ? 'is-active' : ''}`}
          >
            <Icon name={item.icon} size={22} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
