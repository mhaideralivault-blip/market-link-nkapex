import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, homeFor } from '../context/AuthContext';
import { errorMessage } from '../services/api';
import AuthShell from '../components/AuthShell';
import PasswordInput from '../components/PasswordInput';
import { isValidEmail, isValidName, isValidPhone, passwordIssues } from '../utils';

const EMPTY = { name: '', stallName: '', email: '', phone: '', address: '', password: '', confirm: '' };

// Returns { field: message } for every invalid field; an empty object means the form is ready to submit.
const validate = (form, role) => {
  const errors = {};
  if (role === 'farmer' && !isValidName(form.stallName)) errors.stallName = 'Enter your stall or business name (at least 2 characters).';
  if (!isValidName(form.name)) errors.name = 'Enter a name of at least 2 letters.';
  if (!isValidEmail(form.email)) errors.email = 'Enter a valid e-mail address.';
  if (!isValidPhone(form.phone)) errors.phone = 'Enter a valid contact number (at least 7 digits).';
  if (!form.address.trim()) errors.address = 'Address is required.';
  const pwIssues = passwordIssues(form.password);
  if (pwIssues.length) errors.password = `Password needs: ${pwIssues.join(', ').toLowerCase()}.`;
  if (form.confirm !== form.password) errors.confirm = 'Passwords do not match.';
  return errors;
};

export default function Register() {
  const { user, registerCustomer, registerFarmer } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const role = params.get('role') === 'farmer' ? 'farmer' : 'customer';
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user)} replace />;

  const set = (k) => (event) => {
    const next = { ...form, [k]: event.target.value };
    setForm(next);
    if (Object.keys(touched).length) setErrors(validate(next, role));
  };
  const blur = (k) => () => {
    setTouched({ ...touched, [k]: true });
    setErrors(validate(form, role));
  };
  const fieldError = (k) => touched[k] && errors[k];

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const nextErrors = validate(form, role);
    setErrors(nextErrors);
    setTouched(Object.fromEntries(Object.keys(form).map((k) => [k, true])));
    if (Object.keys(nextErrors).length) return setError('Please fix the highlighted fields.');

    setBusy(true);
    try {
      const { name, stallName, email, phone, address, password } = form;
      const u =
        role === 'farmer'
          ? await registerFarmer({ stallName, contactPerson: name, email, phone, address, password })
          : await registerCustomer({ name, email, phone, address, password });
      navigate(homeFor(u), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" sub={role === 'farmer' ? 'List your harvest and take pre-orders for market-day pickup.' : 'Save favourites, get restock alerts and reserve fresh produce.'}>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={role === 'customer'} className={role === 'customer' ? 'active' : ''} onClick={() => setParams({})}>
          I am a customer
        </button>
        <button type="button" role="tab" aria-selected={role === 'farmer'} className={role === 'farmer' ? 'active' : ''} onClick={() => setParams({ role: 'farmer' })}>
          I am a farmer
        </button>
      </div>

      <form onSubmit={submit} noValidate>
        {role === 'farmer' && (
          <label>
            Stall / business name
            <input required aria-invalid={!!fieldError('stallName')} value={form.stallName} onChange={set('stallName')} onBlur={blur('stallName')} />
            {fieldError('stallName') && <span className="field-error">{errors.stallName}</span>}
          </label>
        )}
        <label>
          {role === 'farmer' ? 'Contact person' : 'Full name'}
          <input required autoComplete="name" aria-invalid={!!fieldError('name')} value={form.name} onChange={set('name')} onBlur={blur('name')} />
          {fieldError('name') && <span className="field-error">{errors.name}</span>}
        </label>
        <label>
          E-mail
          <input type="email" required autoComplete="email" aria-invalid={!!fieldError('email')} value={form.email} onChange={set('email')} onBlur={blur('email')} />
          {fieldError('email') && <span className="field-error">{errors.email}</span>}
        </label>
        <label>
          Contact number
          <input type="tel" required autoComplete="tel" aria-invalid={!!fieldError('phone')} value={form.phone} onChange={set('phone')} onBlur={blur('phone')} />
          {fieldError('phone') && <span className="field-error">{errors.phone}</span>}
        </label>
        <label>
          Address
          <textarea required rows={2} autoComplete="street-address" aria-invalid={!!fieldError('address')} value={form.address} onChange={set('address')} onBlur={blur('address')} />
          {fieldError('address') && <span className="field-error">{errors.address}</span>}
        </label>
        <label>
          Password
          <PasswordInput required autoComplete="new-password" aria-invalid={!!fieldError('password')} value={form.password} onChange={set('password')} onBlur={blur('password')} />
          {fieldError('password') ? (
            <span className="field-error">{errors.password}</span>
          ) : (
            <span className="field-hint">Use 8+ characters with upper &amp; lower case, a number and a symbol.</span>
          )}
        </label>
        <label>
          Confirm password
          <PasswordInput required autoComplete="new-password" aria-invalid={!!fieldError('confirm')} value={form.confirm} onChange={set('confirm')} onBlur={blur('confirm')} />
          {fieldError('confirm') && <span className="field-error">{errors.confirm}</span>}
        </label>

        {role === 'farmer' && <p className="alert alert-info">New farmer accounts must be approved by an admin before you can list products.</p>}
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <button className="btn btn-block" disabled={busy}>
          {busy ? 'Creating account...' : 'Register'}
        </button>
      </form>
      <p className="muted center">
        Already registered? <Link to="/login">Login</Link>
      </p>
    </AuthShell>
  );
}
