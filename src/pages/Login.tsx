import { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { LogIn, Mail, Lock, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Email atau password salah.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      backgroundColor: 'var(--bg-secondary)'
    }}>
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: '400px' }}>

        {/* Back to Landing */}
        <div style={{ marginBottom: '1.5rem' }}>
          <Link to="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 500,
            transition: 'color 0.2s'
          }}>
            <ArrowLeft size={16} /> Kembali ke Beranda
          </Link>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-xl)',
          padding: '2.5rem 2rem',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)'
        }}>
          {/* Logo & Title */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              width: 64, height: 64,
              margin: '0 auto 1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img src={logo} alt="RIS Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              Masuk ke Semengu
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.35rem' }}>
              Silakan masuk dengan akun yang terdaftar.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '0.75rem 1rem',
              background: 'var(--danger-bg)',
              color: 'var(--danger)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1.25rem',
              fontSize: '0.8rem',
              fontWeight: 500,
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Mail size={14} color="var(--text-muted)" /> Email
              </label>
              <input
                required
                type="email"
                className="input-field"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="nama@email.com"
              />
            </div>

            <div className="input-group">
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Lock size={14} color="var(--text-muted)" /> Password
              </label>
              <input
                required
                type="password"
                className="input-field"
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={6}
                placeholder="Masukkan password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '1.25rem', padding: '0.8rem', fontSize: '0.95rem', fontWeight: 700 }}
              disabled={loading}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                  <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Memproses...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                  <LogIn size={18} /> Masuk
                </span>
              )}
            </button>
          </form>

          {/* Info */}
          <div style={{
            marginTop: '1.5rem', padding: '0.85rem 1rem',
            background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
            fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6, textAlign: 'center'
          }}>
            Belum punya akun? Hubungi <strong style={{ color: 'var(--primary-color)' }}>Admin</strong> untuk didaftarkan ke dalam sistem.
          </div>
        </div>
      </div>
    </div>
  );
}
