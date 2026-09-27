import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, homeFor } from '../context/AuthContext';
import { errorMessage } from '../services/api';
import AuthShell from '../components/AuthShell';
import PasswordInput from '../components/PasswordInput';
import { isValidEmail } from '../utils';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user)} replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const errors = {};
    if (!isValidEmail(form.email)) errors.email = 'Enter a valid e-mail address.';
    if (!form.password) errors.password = 'Enter your password.';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setBusy(true);
    try {
      const u = await login(form);
      navigate(location.state?.from || homeFor(u), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back" sub="Log in to reserve produce, track orders and manage your stall.">
      <form onSubmit={submit} noValidate>
        <label>
          E-mail
          <input type="email" required autoComplete="email" aria-invalid={!!fieldErrors.email} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
        </label>
        <label>
          Password
          <PasswordInput required autoComplete="current-password" aria-invalid={!!fieldErrors.password} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
        </label>
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <button className="btn btn-block" disabled={busy}>
          {busy ? 'Signing in...' : 'Login'}
        </button>
      </form>
      <p className="muted center">
        New here? <Link to="/register">Create an account</Link>
      </p>
    </AuthShell>
  );
}
